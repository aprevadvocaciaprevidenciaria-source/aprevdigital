import { createClient } from '@supabase/supabase-js'

// Cria (ou reaproveita) uma conta de login pro colaborador e vincula ao
// registro dele em `colaboradores`. Só quem já é dono do colaborador (via
// RLS, checado com o próprio token do usuário logado) pode chamar isso - a
// service role só é usada depois de confirmada a posse.
//
// Duas formas de dar acesso a um colaborador novo:
// - sem `senha`: manda convite por e-mail (Supabase Auth) - sujeito ao limite
//   de envio de e-mail do projeto (plano padrão manda pouquíssimos por hora).
// - com `senha`: cria a conta já ativa com essa senha, sem mandar e-mail
//   nenhum - o dono compartilha a senha por fora (WhatsApp, etc.). Único
//   jeito de contornar o limite de e-mail sem precisar de SMTP próprio.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { colaboradorId, email, senha } = req.body || {}
  if (!colaboradorId || !email) {
    return res.status(400).json({ error: 'colaboradorId e email são obrigatórios.' })
  }
  if (senha && senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' })
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
  let modo = 'existente'

  if (!targetUserId && senha) {
    const { data: criado, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })
    if (createError) {
      return res.status(400).json({ error: createError.message })
    }
    targetUserId = criado.user.id
    modo = 'senha_manual'
  } else if (!targetUserId) {
    const origin = req.headers.origin || `https://${req.headers.host}`
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/redefinir-senha`,
    })
    if (inviteError) {
      return res.status(400).json({ error: inviteError.message })
    }
    targetUserId = invited.user.id
    modo = 'convite'
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

  return res.status(200).json({ ok: true, novoUsuario: !existingUser, modo, colaborador: colaborador.nome })
}
