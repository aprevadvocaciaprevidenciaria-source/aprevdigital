import { createClient } from '@supabase/supabase-js'
import { sendWhatsappText } from '../../../lib/server/whatsapp'

// Rota pública (sem autenticação) - é chamada pelo formulário de contato do
// site público (seolocalbrasil.com), não pelo painel. Por isso usa a service
// role direto: quem preenche o formulário não tem sessão no Supabase.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const { nome, empresa, telefone, email, mensagem, website } = req.body || {}

  // Honeypot: campo invisível no formulário real. Bots costumam preencher
  // todo campo que encontram; gente de verdade nunca vê esse campo.
  if (website) {
    return res.status(200).json({ ok: true })
  }

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório.' })
  }
  if (!telefone && !email) {
    return res.status(400).json({ error: 'Informe telefone ou e-mail pra contato.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // App de escritório único por enquanto: o lead é atribuído ao primeiro
  // usuário cadastrado (o dono da APREV).
  const { data: dono } = await supabaseAdmin.from('users').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!dono) {
    return res.status(500).json({ error: 'Nenhum usuário dono cadastrado no painel.' })
  }

  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .insert({
      user_id: dono.id,
      nome: String(nome).trim(),
      empresa: empresa ? String(empresa).trim() : null,
      telefone: telefone ? String(telefone).trim() : null,
      email: email ? String(email).trim() : null,
      mensagem: mensagem ? String(mensagem).trim() : null,
      origem: 'site',
    })
    .select('id')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Aviso por WhatsApp é best-effort: se a WAME não estiver configurada
  // ainda, ou der erro, o lead já foi salvo mesmo assim.
  try {
    const { data: donoCompleto } = await supabaseAdmin
      .from('users')
      .select('telefone_notificacao')
      .eq('id', dono.id)
      .maybeSingle()
    const numeroAviso = donoCompleto?.telefone_notificacao
    if (numeroAviso) {
      await sendWhatsappText(
        numeroAviso,
        `Novo lead pelo site! 🎯\n${nome}${empresa ? ` (${empresa})` : ''}\n${telefone || email}`
      )
    }
  } catch (err) {
    // silencioso de propósito
  }

  return res.status(200).json({ ok: true, id: lead.id })
}
