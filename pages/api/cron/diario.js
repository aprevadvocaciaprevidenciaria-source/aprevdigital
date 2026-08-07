import { createClient } from '@supabase/supabase-js'
import { sendWhatsappText } from '../../../lib/server/whatsapp'
import { applyTemplate, clienteTemplateData, leadTemplateData } from '../../../lib/templates'
import { buildTotaisMetricas } from '../../../lib/relatorio'
import { gerarMensalidadesDoMes } from '../../../lib/server/financeiro'
import { sendPushToCliente } from '../../../lib/server/push'

function todayInfo() {
  // O cron roda às 12:00 UTC (09:00 em Brasília) - dentro desse horário o dia em
  // UTC já coincide com o dia no fuso do Brasil, então dá pra usar Date direto.
  const now = new Date()
  const dia = now.getUTCDate()
  const jsWeekday = now.getUTCDay() // 0 = domingo .. 6 = sábado
  const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday // 1 = segunda .. 7 = domingo
  const dataStr = now.toISOString().slice(0, 10)
  return { dia, isoWeekday, dataStr }
}

async function jaExisteHoje(supabaseAdmin, { userId, clienteId, tipo, dataStr }) {
  const { data } = await supabaseAdmin
    .from('mensagens_fila')
    .select('id')
    .eq('user_id', userId)
    .eq('cliente_id', clienteId)
    .eq('tipo', tipo)
    .eq('agendado_para', dataStr)
    .in('status', ['enviado', 'pendente'])
    .limit(1)
  return (data || []).length > 0
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { dia, isoWeekday, dataStr } = todayInfo()
  const resumo = {
    relatorios_enviados: 0,
    cobrancas_geradas: 0,
    imagens_enviadas: 0,
    leads_followup_gerados: 0,
    mensalidades_geradas: 0,
    tarefas_recorrentes_geradas: 0,
    erros: 0,
  }

  const { data: configs } = await supabaseAdmin
    .from('automacao_config')
    .select('*')
    .or('relatorio_mensal_ativo.eq.true,cobranca_ativa.eq.true,imagens_ativa.eq.true,leads_followup_ativo.eq.true')

  for (const config of configs || []) {
    const { data: clientes } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('user_id', config.user_id)
      .eq('status', 'ativo')

    for (const cliente of clientes || []) {
      // 1. Relatório mensal automático
      if (config.relatorio_mensal_ativo && dia === config.relatorio_mensal_dia) {
        const jaEnviado = await jaExisteHoje(supabaseAdmin, {
          userId: config.user_id,
          clienteId: cliente.id,
          tipo: 'relatorio_mensal',
          dataStr,
        })
        if (!jaEnviado) {
          const desde6Meses = new Date()
          desde6Meses.setUTCDate(1)
          desde6Meses.setUTCMonth(desde6Meses.getUTCMonth() - 5)
          const { data: metricas } = await supabaseAdmin
            .from('metricas_gbp')
            .select('*')
            .eq('cliente_id', cliente.id)
            .gte('mes', desde6Meses.toISOString().slice(0, 10))
          const totais = buildTotaisMetricas(metricas)
          const texto = applyTemplate(config.relatorio_template, clienteTemplateData(cliente, totais))

          try {
            await sendWhatsappText(cliente.contato_whatsapp, texto)
            await supabaseAdmin.from('mensagens_fila').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'relatorio_mensal',
                mensagem: texto,
                status: 'enviado',
                agendado_para: dataStr,
                enviado_em: new Date().toISOString(),
              },
            ])
            await supabaseAdmin.from('relatorios').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'cliente',
                mes: dataStr.slice(0, 8) + '01',
                dados: { cliente, metricas, totais, geradoEm: new Date().toISOString() },
                status: 'enviado_automatico',
              },
            ])
            resumo.relatorios_enviados += 1
            await sendPushToCliente(supabaseAdmin, cliente.id, {
              title: 'Novo relatório disponível 📄',
              body: 'Seu relatório mensal já está disponível no portal.',
              url: '/portal',
            }).catch(() => {})
          } catch (err) {
            await supabaseAdmin.from('mensagens_fila').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'relatorio_mensal',
                mensagem: texto,
                status: 'erro',
                agendado_para: dataStr,
                erro_detalhe: err.message,
              },
            ])
            resumo.erros += 1
          }
        }
      }

      // 2. Cobrança - só prepara na fila de aprovação, não envia sozinho
      if (config.cobranca_ativa && cliente.dia_vencimento) {
        const diaAlvo = cliente.dia_vencimento - (config.cobranca_dias_antecedencia || 0)
        if (diaAlvo === dia) {
          const jaExiste = await jaExisteHoje(supabaseAdmin, {
            userId: config.user_id,
            clienteId: cliente.id,
            tipo: 'cobranca',
            dataStr,
          })
          if (!jaExiste) {
            const texto = applyTemplate(config.cobranca_template, clienteTemplateData(cliente))
            await supabaseAdmin.from('mensagens_fila').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'cobranca',
                mensagem: texto,
                status: 'pendente',
                agendado_para: dataStr,
              },
            ])
            resumo.cobrancas_geradas += 1
          }
        }
      }

      // 3. Solicitação de fotos
      if (config.imagens_ativa && (config.imagens_dias_semana || []).includes(isoWeekday)) {
        const jaEnviado = await jaExisteHoje(supabaseAdmin, {
          userId: config.user_id,
          clienteId: cliente.id,
          tipo: 'solicitacao_imagens',
          dataStr,
        })
        if (!jaEnviado) {
          const texto = applyTemplate(
            config.imagens_template,
            clienteTemplateData(cliente, { qtd_minima: config.imagens_qtd_minima })
          )
          try {
            await sendWhatsappText(cliente.contato_whatsapp, texto)
            await supabaseAdmin.from('mensagens_fila').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'solicitacao_imagens',
                mensagem: texto,
                status: 'enviado',
                agendado_para: dataStr,
                enviado_em: new Date().toISOString(),
              },
            ])
            resumo.imagens_enviadas += 1
          } catch (err) {
            await supabaseAdmin.from('mensagens_fila').insert([
              {
                user_id: config.user_id,
                cliente_id: cliente.id,
                tipo: 'solicitacao_imagens',
                mensagem: texto,
                status: 'erro',
                agendado_para: dataStr,
                erro_detalhe: err.message,
              },
            ])
            resumo.erros += 1
          }
        }
      }
    }

    // 4. Follow-up de leads - só prepara na fila de aprovação, não envia sozinho
    if (config.leads_followup_ativo) {
      const diasFollowup = config.leads_followup_dias || 3
      const limite = Date.now() - diasFollowup * 24 * 60 * 60 * 1000

      const { data: leadsAtivos } = await supabaseAdmin
        .from('leads_manuais')
        .select('*')
        .eq('user_id', config.user_id)
        .in('status', ['novo', 'contatado'])

      for (const lead of leadsAtivos || []) {
        const referencia = new Date(lead.ultimo_followup_em || lead.created_at).getTime()
        if (referencia > limite) continue

        const { data: pendente } = await supabaseAdmin
          .from('mensagens_fila')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('tipo', 'lead_followup')
          .eq('status', 'pendente')
          .limit(1)
        if ((pendente || []).length > 0) continue

        const texto = applyTemplate(config.leads_followup_template, leadTemplateData(lead))
        await supabaseAdmin.from('mensagens_fila').insert([
          {
            user_id: config.user_id,
            lead_id: lead.id,
            tipo: 'lead_followup',
            mensagem: texto,
            status: 'pendente',
            agendado_para: dataStr,
          },
        ])
        await supabaseAdmin.from('leads_manuais').update({ ultimo_followup_em: new Date().toISOString() }).eq('id', lead.id)
        resumo.leads_followup_gerados += 1
      }
    }
  }

  // 5. Tarefas recorrentes do plano Gestão - checklist fixo, sem toggle:
  // todo modelo ativo gera a tarefa pra cada cliente do plano Gestão quando
  // a periodicidade bate com o dia de hoje. template_id evita duplicar a
  // mesma tarefa recorrente se o cron rodar mais de uma vez no dia.
  const { data: templatesAtivos } = await supabaseAdmin.from('tarefa_templates').select('*').eq('ativo', true)

  const templatesPorDono = {}
  for (const t of templatesAtivos || []) {
    templatesPorDono[t.user_id] = templatesPorDono[t.user_id] || []
    templatesPorDono[t.user_id].push(t)
  }

  for (const [donoId, templates] of Object.entries(templatesPorDono)) {
    const templatesDeHoje = templates.filter((t) => {
      if (t.periodicidade === 'diaria') return true
      if (t.periodicidade === 'semanal') return (t.dias_semana || []).includes(isoWeekday)
      if (t.periodicidade === 'mensal') return t.dia_mes === dia
      return false
    })
    if (templatesDeHoje.length === 0) continue

    const { data: clientesGestao } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('user_id', donoId)
      .eq('status', 'ativo')
      .eq('plano_gestao', true)

    for (const template of templatesDeHoje) {
      for (const cliente of clientesGestao || []) {
        const { data: existente } = await supabaseAdmin
          .from('tarefas')
          .select('id')
          .eq('template_id', template.id)
          .eq('cliente_id', cliente.id)
          .eq('vencimento', dataStr)
          .limit(1)
        if ((existente || []).length > 0) continue

        await supabaseAdmin.from('tarefas').insert([
          {
            user_id: donoId,
            cliente_id: cliente.id,
            titulo: template.titulo,
            descricao: template.descricao,
            status: 'a-fazer',
            prioridade: template.prioridade,
            vencimento: dataStr,
            template_id: template.id,
          },
        ])
        resumo.tarefas_recorrentes_geradas += 1
      }
    }
  }

  // 6. Mensalidade do mês (financeiro) - independe dos toggles de automação
  // de WhatsApp acima: todo cliente ativo com plano_valor e dia_vencimento
  // definidos gera o lançamento pendente no dia do vencimento dele.
  const { data: clientesComVencimentoHoje } = await supabaseAdmin
    .from('clientes')
    .select('id, user_id, status, plano_valor, dia_vencimento')
    .eq('status', 'ativo')
    .eq('dia_vencimento', dia)
    .not('plano_valor', 'is', null)

  const clientesPorDono = {}
  for (const c of clientesComVencimentoHoje || []) {
    clientesPorDono[c.user_id] = clientesPorDono[c.user_id] || []
    clientesPorDono[c.user_id].push(c)
  }
  for (const [donoId, clientesDono] of Object.entries(clientesPorDono)) {
    try {
      const { geradas } = await gerarMensalidadesDoMes(supabaseAdmin, {
        userId: donoId,
        clientes: clientesDono,
        referencia: new Date(),
      })
      resumo.mensalidades_geradas += geradas
    } catch (err) {
      resumo.erros += 1
    }
  }

  return res.status(200).json({ ok: true, data: dataStr, ...resumo })
}
