import { createClient } from '@supabase/supabase-js'
import { sendWhatsappText } from '../../../lib/server/whatsapp'

// Repassa o JWT do usuário logado pro Supabase - RLS (sou_equipe_de) já garante
// que só é possível mandar mensagem em conversas da própria equipe.
// Não grava em mensagens_conversa aqui: a Z-API dispara um webhook "ao enviar"
// que já cai no n8n (workflow "Coletor de Histórico") e de lá no painel
// (pages/api/webhooks/zapi.js), então gravar aqui também duplicaria a mensagem.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { conversaId, mensagem } = req.body || {}
  if (!conversaId || !mensagem || !String(mensagem).trim()) {
    return res.status(400).json({ error: 'conversaId e mensagem são obrigatórios.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: conversa, error: loadError } = await supabase
    .from('conversas_whatsapp')
    .select('id, telefone')
    .eq('id', conversaId)
    .single()

  if (loadError || !conversa) {
    return res.status(404).json({ error: 'Conversa não encontrada ou sem permissão de acesso.' })
  }

  try {
    await sendWhatsappText(conversa.telefone, String(mensagem).trim())
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
