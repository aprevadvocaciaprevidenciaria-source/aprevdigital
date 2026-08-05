import { createClient } from '@supabase/supabase-js'

// Registra no banco uma foto que o cliente já subiu direto no Storage (o
// upload do arquivo em si acontece no navegador, autorizado pela policy de
// Storage - aqui só gravamos a linha em fotos_clientes usando a service
// role, porque o trigger normalizar_user_id não sabe tratar um login do
// tipo 'cliente' (só sócio/dono) e gravaria o user_id errado se deixasse a
// RLS normal cuidar disso.
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

  const { path, descricao } = req.body || {}
  if (!path) {
    return res.status(400).json({ error: 'path é obrigatório.' })
  }

  // Confere que o cliente só está registrando um arquivo no caminho dele
  // mesmo (o Storage já bloqueou upload em pasta de outro cliente, isso
  // aqui é uma segunda confirmação antes de gravar no banco).
  const prefixoEsperado = `${cliente.user_id}/${cliente.id}/`
  if (!path.startsWith(prefixoEsperado)) {
    return res.status(400).json({ error: 'Caminho de arquivo inválido.' })
  }

  const { error } = await supabaseAdmin.from('fotos_clientes').insert({
    user_id: cliente.user_id,
    cliente_id: cliente.id,
    path,
    categoria: 'cliente_enviou',
    descricao: descricao || null,
  })
  if (error) {
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ ok: true })
}
