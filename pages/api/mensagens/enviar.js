import { createClient } from '@supabase/supabase-js'
import { sendWhatsappText } from '../../../lib/server/whatsapp'

// Aprova e envia uma mensagem pendente (hoje só usado para a fila de cobrança).
// Repassa o JWT do usuário logado para o Supabase, então o RLS já garante que
// só é possível enviar mensagens da própria conta - nenhum uso de service role aqui.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { id } = req.body || {}
  if (!id) {
    return res.status(400).json({ error: 'id da mensagem é obrigatório.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: mensagem, error: loadError } = await supabase
    .from('mensagens_fila')
    .select('*, clientes(contato_whatsapp), leads(telefone)')
    .eq('id', id)
    .single()

  if (loadError || !mensagem) {
    return res.status(404).json({ error: 'Mensagem não encontrada.' })
  }
  if (mensagem.status !== 'pendente') {
    return res.status(400).json({ error: 'Esta mensagem já foi processada.' })
  }

  const numero = mensagem.clientes?.contato_whatsapp || mensagem.leads?.telefone

  try {
    await sendWhatsappText(numero, mensagem.mensagem)
    await supabase
      .from('mensagens_fila')
      .update({ status: 'enviado', enviado_em: new Date().toISOString() })
      .eq('id', id)
    return res.status(200).json({ ok: true })
  } catch (err) {
    await supabase.from('mensagens_fila').update({ status: 'erro', erro_detalhe: err.message }).eq('id', id)
    return res.status(500).json({ error: err.message })
  }
}
