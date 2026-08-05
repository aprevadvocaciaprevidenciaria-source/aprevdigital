import { createClient } from '@supabase/supabase-js'
import { gerarMensalidadesDoMes } from '../../../lib/server/financeiro'

// Gera manualmente os lançamentos de mensalidade do mês atual (botão
// "Gerar mensalidades do mês" na tela /financeiro). Roda com o token do
// próprio usuário logado (não service role) - a RLS de financeiro_lancamentos
// já libera o insert pra quem administra a conta (dono ou sócio), e o
// trigger normalizar_user_id garante que a linha fica sob o dono certo.
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

  const { data: clientes, error: clientesError } = await supabaseAsUser
    .from('clientes')
    .select('id, status, plano_valor, dia_vencimento')
    .eq('status', 'ativo')

  if (clientesError) {
    return res.status(500).json({ error: clientesError.message })
  }

  try {
    const resultado = await gerarMensalidadesDoMes(supabaseAsUser, {
      userId: user.id,
      clientes,
      referencia: new Date(),
    })
    return res.status(200).json({ ok: true, ...resultado })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
