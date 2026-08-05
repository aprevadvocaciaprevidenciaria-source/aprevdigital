import { createClient } from '@supabase/supabase-js'

// Cria (ou reaproveita) uma conta de login pro colaborador e vincula ao
// registro dele em `colaboradores`. Só quem já é dono do colaborador (via
// RLS, checado com o próprio token do usuário logado) pode chamar isso - a
// service role só é usada depois de confirmada a posse.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { colaboradorId, email } = req.body || {}
  if (!colaboradorId || !email) {
    return res.status(400).json({ error: 'colaboradorId e email são obrigatórios.' })
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

  const { data: colaborador, error: colaboradorError } = await supabaseAsUser
    .from('colaboradores')
    .select('id, nome')
    .eq('id', colaboradorId)
    .single()

  if (colaboradorError || !colaborador) {
    return res.status(404).json({ error: 'Colaborador não encontrado ou sem permissão.' })
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

  const { error: linkUserError } = await supabaseAdmin
    .from('users')
    .update({ tipo: 'colaborador' })
    .eq('id', targetUserId)
  if (linkUserError) {
    return res.status(500).json({ error: linkUserError.message })
  }

  const { error: linkColaboradorError } = await supabaseAdmin
    .from('colaboradores')
    .update({ login_user_id: targetUserId, email })
    .eq('id', colaboradorId)
  if (linkColaboradorError) {
    return res.status(500).json({ error: linkColaboradorError.message })
  }

  return res.status(200).json({ ok: true, novoUsuario: !existingUser, colaborador: colaborador.nome })
}
