// Módulo server-only: nunca importar a partir de páginas/componentes que rodam no navegador.

// Devolve um access_token válido pra esse usuário, renovando via refresh_token
// quando necessário. Retorna null se o usuário nunca conectou a conta Google.
export async function getValidAccessToken(supabaseAdmin, userId) {
  const { data: tokenRow } = await supabaseAdmin
    .from('google_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRow) return null

  const expiraEm = tokenRow.token_expira_em ? new Date(tokenRow.token_expira_em).getTime() : 0
  const aindaValido = expiraEm - Date.now() > 60 * 1000 // margem de 1 minuto

  if (aindaValido) {
    return tokenRow.access_token
  }

  if (!tokenRow.refresh_token) {
    await supabaseAdmin.from('google_oauth_tokens').update({ status: 'erro' }).eq('user_id', userId)
    return null
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()

  if (!res.ok) {
    await supabaseAdmin.from('google_oauth_tokens').update({ status: 'erro' }).eq('user_id', userId)
    return null
  }

  await supabaseAdmin
    .from('google_oauth_tokens')
    .update({
      access_token: data.access_token,
      token_expira_em: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      status: 'conectado',
      atualizado_em: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return data.access_token
}
