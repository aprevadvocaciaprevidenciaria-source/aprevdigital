import { createClient } from '@supabase/supabase-js'
import { dataAplicaAoCliente } from '../../../lib/datasEspeciais'

// Rota usada pelo portal do cliente (autenticado, mas sem acesso direto via
// RLS às tabelas datas_especiais/datas_especiais_respostas - essas são
// donas da agência). Verifica com o token do próprio cliente logado quem
// ele é, e só então usa a service role pra ler/gravar, sempre restrito ao
// cliente_id vinculado àquele login.
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

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, user_id, plano_gestao, cidade')
    .eq('id', perfil.cliente_id)
    .maybeSingle()

  if (!cliente || !cliente.plano_gestao) {
    return res.status(404).json({ error: 'Não disponível pra este cliente.' })
  }

  if (req.method === 'GET') {
    const [{ data: datas }, { data: respostas }] = await Promise.all([
      supabaseAdmin.from('datas_especiais').select('*').eq('user_id', cliente.user_id).order('data', { ascending: true }),
      supabaseAdmin.from('datas_especiais_respostas').select('*').eq('cliente_id', cliente.id),
    ])
    const datasDoCliente = (datas || []).filter((d) => dataAplicaAoCliente(d, cliente.cidade))
    return res.status(200).json({ datas: datasDoCliente, respostas: respostas || [] })
  }

  if (req.method === 'POST') {
    const { dataEspecialId, vaiFechar, horarioAlternativo } = req.body || {}
    if (!dataEspecialId || typeof vaiFechar !== 'boolean') {
      return res.status(400).json({ error: 'Dados inválidos.' })
    }

    const { error } = await supabaseAdmin.from('datas_especiais_respostas').upsert(
      {
        user_id: cliente.user_id,
        cliente_id: cliente.id,
        data_especial_id: dataEspecialId,
        vai_fechar: vaiFechar,
        horario_alternativo: horarioAlternativo || null,
        respondido_por: 'cliente',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cliente_id,data_especial_id' }
    )
    if (error) {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
