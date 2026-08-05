import { createClient } from '@supabase/supabase-js'
import { gerarSlotsDoDia, diaEstaAberto } from '../../../../lib/agendamento'
import { sendWhatsappText } from '../../../../lib/server/whatsapp'
import { sendPushToCliente } from '../../../../lib/server/push'

// Rota pública (sem autenticação) usada pelo widget de agendamento embutido
// nas páginas de cada cliente. Só expõe o mínimo necessário pra montar o
// calendário - nada de dados internos do cliente (telefone, plano, etc.).
// CORS liberado: o widget roda em domínios de terceiros (a página de cada
// cliente, fora do painel), não faz sentido restringir origem aqui.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const { slug } = req.query
  if (!slug) {
    return res.status(400).json({ error: 'Slug não informado.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select(
      'id, user_id, nome, status, agendamento_ativo, dias_funcionamento, horario_abertura, horario_fechamento, intervalo_almoco_inicio, intervalo_almoco_fim, duracao_padrao_servico'
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!cliente || cliente.status !== 'ativo' || !cliente.agendamento_ativo) {
    return res.status(404).json({ error: 'Página de agendamento não encontrada.' })
  }

  if (req.method === 'GET') {
    const mes = /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : new Date().toISOString().slice(0, 7)
    const inicio = `${mes}-01`
    const fimDate = new Date(`${inicio}T00:00:00Z`)
    fimDate.setUTCMonth(fimDate.getUTCMonth() + 1)
    const fim = fimDate.toISOString().slice(0, 10)

    const { data: agendados } = await supabaseAdmin
      .from('agendamentos')
      .select('data_agendada, horario_agendado')
      .eq('cliente_id', cliente.id)
      .gte('data_agendada', inicio)
      .lt('data_agendada', fim)
      .neq('status', 'cancelado')

    const ocupados = {}
    for (const a of agendados || []) {
      ocupados[a.data_agendada] = ocupados[a.data_agendada] || []
      ocupados[a.data_agendada].push(String(a.horario_agendado).slice(0, 5))
    }

    return res.status(200).json({
      cliente: { nome: cliente.nome, diasFuncionamento: cliente.dias_funcionamento },
      horariosPadrao: gerarSlotsDoDia(cliente),
      ocupados,
    })
  }

  if (req.method === 'POST') {
    const { nome, whatsapp, veiculo, placa, servico, data, horario, observacoes } = req.body || {}
    if (!nome?.trim() || !whatsapp?.trim() || !data || !horario) {
      return res.status(400).json({ error: 'Preencha nome, WhatsApp, data e horário.' })
    }

    const slotsValidos = gerarSlotsDoDia(cliente)
    if (!diaEstaAberto(cliente, data) || !slotsValidos.includes(horario)) {
      return res.status(400).json({ error: 'Esse dia ou horário não está mais disponível.' })
    }

    const hoje = new Date().toISOString().slice(0, 10)
    if (data < hoje) {
      return res.status(400).json({ error: 'Não é possível agendar em uma data passada.' })
    }

    const { data: inserido, error } = await supabaseAdmin
      .from('agendamentos')
      .insert([
        {
          user_id: cliente.user_id,
          cliente_id: cliente.id,
          nome_solicitante: nome.trim(),
          whatsapp_solicitante: whatsapp.trim(),
          veiculo_modelo: veiculo?.trim() || null,
          veiculo_placa: placa?.trim() || null,
          servico: servico?.trim() || null,
          data_agendada: data,
          horario_agendado: horario,
          observacoes: observacoes?.trim() || null,
          origem: 'site',
        },
      ])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.' })
      }
      return res.status(500).json({ error: 'Não foi possível confirmar o agendamento.' })
    }

    const dataFormatada = new Date(`${data}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

    try {
      await sendWhatsappText(
        whatsapp,
        `Olá ${nome}! Seu agendamento na ${cliente.nome} está confirmado para ${dataFormatada} às ${horario}. Pra cancelar ou remarcar: https://painel.seolocalbrasil.com/agendamento/${inserido.token_cancelamento}`
      )
    } catch (err) {
      // best-effort - o agendamento já foi salvo, WhatsApp é um bônus
    }

    try {
      await sendPushToCliente(supabaseAdmin, cliente.id, {
        title: 'Novo agendamento! 📅',
        body: `${nome} agendou ${servico || 'um atendimento'} para ${dataFormatada} às ${horario}.`,
        url: '/portal',
      })
    } catch (err) {
      // best-effort - idem
    }

    return res.status(200).json({ ok: true, token: inserido.token_cancelamento })
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
