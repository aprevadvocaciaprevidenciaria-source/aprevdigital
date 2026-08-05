import { createClient } from '@supabase/supabase-js'

// Rota usada pelo portal do cliente pra inscrever/desinscrever o navegador
// dele nas notificações push. Mesmo padrão de /api/portal/datas-especiais:
// confirma quem é o cliente logado com o próprio token dele, e só então usa
// a service role pra gravar - sempre restrito ao cliente_id daquele login.
export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
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

  const { data: perfil } = await supabaseAsUser.from('users').select('tipo, cliente_id').eq('id', user.id).maybeSingle()
  if (perfil?.tipo !== 'cliente' || !perfil.cliente_id) {
    return res.status(403).json({ error: 'Sem acesso.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (req.method === 'GET') {
    const { endpoint } = req.query
    if (!endpoint) return res.status(200).json({ inscrito: false })
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
      .maybeSingle()
    return res.status(200).json({ inscrito: !!data })
  }

  if (req.method === 'POST') {
    const { subscription } = req.body || {}
    const endpoint = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const auth = subscription?.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Inscrição inválida.' })
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        cliente_id: perfil.cliente_id,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'endpoint' }
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {}
    if (!endpoint) return res.status(400).json({ error: 'endpoint é obrigatório.' })
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
