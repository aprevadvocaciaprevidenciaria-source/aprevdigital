import { createClient } from '@supabase/supabase-js'
import { sendWhatsappText } from '../../../lib/server/whatsapp'

// Rota pública (sem autenticação) - recebe o formulário de onboarding
// preenchido pelo cliente (Criação ou Otimização de perfil), pelo link
// que o admin manda no WhatsApp a partir da tela do cliente. Usa a
// service role porque quem preenche não tem sessão no painel - mesmo
// padrão de /api/leads/capturar.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const { clienteId, tipo, dados } = req.body || {}

  if (!clienteId) {
    return res.status(400).json({ error: 'clienteId é obrigatório.' })
  }
  if (tipo !== 'criacao' && tipo !== 'otimizacao') {
    return res.status(400).json({ error: 'tipo inválido.' })
  }
  if (!dados || typeof dados !== 'object') {
    return res.status(400).json({ error: 'dados é obrigatório.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, user_id')
    .eq('id', clienteId)
    .maybeSingle()

  if (clienteError || !cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado.' })
  }

  const { data: submission, error } = await supabaseAdmin
    .from('onboarding_submissions')
    .insert({
      user_id: cliente.user_id,
      cliente_id: cliente.id,
      tipo,
      dados,
    })
    .select('id')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Aviso por WhatsApp é best-effort: se a WAME não estiver configurada
  // ainda, ou der erro, a resposta já foi salva mesmo assim.
  try {
    const { data: dono } = await supabaseAdmin
      .from('users')
      .select('telefone_notificacao')
      .eq('id', cliente.user_id)
      .maybeSingle()
    const numeroAviso = dono?.telefone_notificacao
    if (numeroAviso) {
      const tipoLabel = tipo === 'criacao' ? 'Criação de perfil' : 'Otimização de perfil'
      await sendWhatsappText(
        numeroAviso,
        `Formulário de onboarding respondido! 📋\n${cliente.nome} · ${tipoLabel}\nVeja no painel, na aba Onboarding do cliente.`
      )
    }
  } catch (err) {
    // silencioso de propósito
  }

  return res.status(200).json({ ok: true, id: submission.id })
}
