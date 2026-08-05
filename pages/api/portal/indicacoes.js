import { createClient } from '@supabase/supabase-js'

// Rota usada pelo portal do cliente pra registrar indicações ("Indique e
// ganhe"). Mesmo padrão de /api/portal/datas-especiais: confirma quem é o
// cliente logado com o token dele, e só então usa a service role pra
// gravar - garante que o user_id salvo é o dono da agência (a RLS direta
// não deixaria o cliente setar isso certo).
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

  const { data: cliente } = await supabaseAdmin.from('clientes').select('id, user_id').eq('id', perfil.cliente_id).maybeSingle()
  if (!cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado.' })
  }

  if (req.method === 'GET') {
    const { data } = await supabaseAdmin
      .from('indicacoes')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })
    return res.status(200).json({ indicacoes: data || [] })
  }

  if (req.method === 'POST') {
    const { nomeIndicado, whatsappIndicado } = req.body || {}
    if (!nomeIndicado?.trim() || !whatsappIndicado?.trim()) {
      return res.status(400).json({ error: 'Nome e WhatsApp do indicado são obrigatórios.' })
    }

    const { error } = await supabaseAdmin.from('indicacoes').insert({
      user_id: cliente.user_id,
      cliente_id: cliente.id,
      nome_indicado: nomeIndicado.trim(),
      whatsapp_indicado: whatsappIndicado.trim(),
    })
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
