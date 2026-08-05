import { createClient } from '@supabase/supabase-js'

// Exclui um cliente permanentemente. Precisa da service role porque, se o
// cliente tem acesso ao portal vinculado (users.cliente_id), o Postgres
// precisa atualizar aquele registro de `users` (cliente_id = null) como
// parte do "on delete set null" - e a RLS de `users` só deixa cada login
// mexer no próprio perfil, nunca no de outra pessoa. Por isso, com a RLS
// normal, excluir um cliente que já tem portal vinculado falhava sempre.
// A posse do cliente é confirmada primeiro com o token do usuário logado
// (RLS garante que só volta o registro se ele for o dono via user_id) -
// só depois disso a exclusão em si roda com a service role.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { clienteId } = req.body || {}
  if (!clienteId) {
    return res.status(400).json({ error: 'clienteId é obrigatório.' })
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

  const { data: cliente, error: clienteError } = await supabaseAsUser
    .from('clientes')
    .select('id, nome')
    .eq('id', clienteId)
    .single()

  if (clienteError || !cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado ou sem permissão pra excluir (só o dono da conta pode excluir clientes).' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: deleteError } = await supabaseAdmin.from('clientes').delete().eq('id', clienteId)
  if (deleteError) {
    return res.status(500).json({ error: deleteError.message })
  }

  return res.status(200).json({ ok: true, cliente: cliente.nome })
}
