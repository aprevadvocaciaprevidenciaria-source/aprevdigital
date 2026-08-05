import { createClient } from '@supabase/supabase-js'

// Rota pública: o token já É a autenticação (só quem recebeu o link do
// WhatsApp o conhece). Não expõe nada além do necessário pra confirmar
// os detalhes do agendamento antes de cancelar.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const { token } = req.query
  if (!token) {
    return res.status(400).json({ error: 'Token não informado.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: agendamento } = await supabaseAdmin
    .from('agendamentos')
    .select('id, nome_solicitante, servico, data_agendada, horario_agendado, status, clientes(nome)')
    .eq('token_cancelamento', token)
    .maybeSingle()

  if (!agendamento) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' })
  }

  if (req.method === 'GET') {
    return res.status(200).json({ agendamento })
  }

  if (req.method === 'POST') {
    if (agendamento.status === 'cancelado') {
      return res.status(200).json({ ok: true, agendamento })
    }
    if (agendamento.status === 'concluido') {
      return res.status(400).json({ error: 'Esse atendimento já foi concluído, não é possível cancelar.' })
    }
    const { data: atualizado, error } = await supabaseAdmin
      .from('agendamentos')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('token_cancelamento', token)
      .select('id, nome_solicitante, servico, data_agendada, horario_agendado, status, clientes(nome)')
      .single()
    if (error) {
      return res.status(500).json({ error: 'Não foi possível cancelar o agendamento.' })
    }
    return res.status(200).json({ ok: true, agendamento: atualizado })
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
