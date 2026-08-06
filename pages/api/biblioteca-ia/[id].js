import { createClient } from '@supabase/supabase-js'
import catalogo from '../../../data/biblioteca-ia.json'

async function usuarioAutenticado(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const user = await usuarioAutenticado(req)
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { id } = req.query
  const item = catalogo.find((i) => i.id === id)
  if (!item) {
    return res.status(404).json({ error: 'Prompt não encontrado.' })
  }

  return res.status(200).json({ item })
}
