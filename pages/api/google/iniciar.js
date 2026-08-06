import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// drive.readonly é escopo "sensível" pro Google - se a tela de consentimento
// OAuth do projeto ainda estiver em modo "Testing" (não publicada), funciona
// normal, só mostra aviso de "app não verificado" no consentimento.
const SCOPE = 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/drive.readonly'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID não configurada no servidor.' })
  }

  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
  } = await supabaseAsUser.auth.getUser()
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Limpa states velhos (mais de 10 minutos) antes de criar um novo.
  await supabaseAdmin
    .from('google_oauth_state')
    .delete()
    .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  const state = crypto.randomBytes(24).toString('hex')
  const { error: stateError } = await supabaseAdmin.from('google_oauth_state').insert({ state, user_id: user.id })
  if (stateError) {
    return res.status(500).json({ error: stateError.message })
  }

  const origin = req.headers.origin || `https://${req.headers.host}`
  const redirectUri = `${origin}/api/google/callback`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('state', state)

  return res.status(200).json({ url: authUrl.toString() })
}
