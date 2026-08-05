import { createClient } from '@supabase/supabase-js'
import { sendPushToClientes } from '../../../lib/server/push'

// Dispara notificação push pro(s) cliente(s) informado(s) - chamada pelo
// admin depois de adicionar uma avaliação, salvar um relatório ou cadastrar
// uma data especial. Confirma com o token do próprio admin logado que ele
// pode administrar cada cliente (a RLS de `clientes` já filtra isso), e só
// manda pros que passarem - clienteIds que não são dele são ignorados em
// silêncio, não gera erro (best-effort, o fluxo principal - já salvou os
// dados - não pode falhar por causa da notificação).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { clienteIds, title, body, url } = req.body || {}
  const ids = Array.isArray(clienteIds) ? clienteIds.filter(Boolean) : [clienteIds].filter(Boolean)
  if (ids.length === 0 || !title) {
    return res.status(400).json({ error: 'clienteIds e title são obrigatórios.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
  } = await supabaseAsUser.auth.getUser()
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { data: clientesPermitidos } = await supabaseAsUser.from('clientes').select('id').in('id', ids)
  const idsPermitidos = (clientesPermitidos || []).map((c) => c.id)
  if (idsPermitidos.length === 0) {
    return res.status(200).json({ ok: true, enviadas: 0 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const resultado = await sendPushToClientes(supabaseAdmin, idsPermitidos, { title, body, url })
    return res.status(200).json({ ok: true, ...resultado })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
