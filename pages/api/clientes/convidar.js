import { createClient } from '@supabase/supabase-js'

// Cria (ou reaproveita) uma conta de login pro cliente e vincula ao registro
// dele em `clientes`. Só quem já é dono do cliente (via RLS, checado com o
// próprio token do usuário logado) pode chamar isso - a service role só é
// usada depois de confirmada a posse.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { clienteId, email } = req.body || {}
  if (!clienteId || !email) {
    return res.status(400).json({ error: 'clienteId e email são obrigatórios.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  // Cliente com o token do usuário logado: a RLS garante que só volta o
  // registro se ele for o dono (auth.uid() = user_id em `clientes`).
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
    return res.status(404).json({ error: 'Cliente não encontrado ou sem permissão.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  let targetUserId = existingUser?.id

  if (!targetUserId) {
    const origin = req.headers.origin || `https://${req.headers.host}`
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/redefinir-senha`,
    })
    if (inviteError) {
      return res.status(400).json({ error: inviteError.message })
    }
    targetUserId = invited.user.id
  }

  const { error: linkError } = await supabaseAdmin
    .from('users')
    .update({ tipo: 'cliente', cliente_id: clienteId })
    .eq('id', targetUserId)

  if (linkError) {
    return res.status(500).json({ error: linkError.message })
  }

  return res.status(200).json({ ok: true, novoUsuario: !existingUser, cliente: cliente.nome })
}
