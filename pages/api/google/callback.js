import { createClient } from '@supabase/supabase-js'

// O Google redireciona o navegador direto pra cá (não é uma chamada fetch
// com token de sessão) - por isso a identidade do usuário vem do `state`
// que /api/google/iniciar.js já amarrou a ele no banco.
export default async function handler(req, res) {
  const { code, state, error: googleError } = req.query

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (googleError || !code || !state) {
    return res.redirect('/configuracoes?google=erro')
  }
  if (!serviceRoleKey || !clientId || !clientSecret) {
    return res.redirect('/configuracoes?google=erro')
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: stateRow } = await supabaseAdmin
    .from('google_oauth_state')
    .select('user_id, created_at')
    .eq('state', state)
    .maybeSingle()

  if (!stateRow) {
    return res.redirect('/configuracoes?google=erro')
  }
  await supabaseAdmin.from('google_oauth_state').delete().eq('state', state)

  const expirado = Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000
  if (expirado) {
    return res.redirect('/configuracoes?google=erro')
  }

  const origin = req.headers.origin || `https://${req.headers.host}`
  const redirectUri = `${origin}/api/google/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json()

  if (!tokenRes.ok) {
    return res.redirect('/configuracoes?google=erro')
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = await userInfoRes.json().catch(() => ({}))

  // O refresh_token só volta na primeira autorização (ou quando forçamos
  // com prompt=consent, que já fazemos em /api/google/iniciar.js). Se por
  // algum motivo não vier dessa vez, mantém o que já estava salvo.
  const { data: existente } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('refresh_token')
    .eq('user_id', stateRow.user_id)
    .maybeSingle()

  await supabaseAdmin.from('google_oauth_tokens').upsert({
    user_id: stateRow.user_id,
    email_google: userInfo.email || null,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || existente?.refresh_token || null,
    token_expira_em: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
    escopo: tokenData.scope || null,
    status: 'conectado',
    atualizado_em: new Date().toISOString(),
  })

  return res.redirect('/configuracoes?google=conectado')
}
