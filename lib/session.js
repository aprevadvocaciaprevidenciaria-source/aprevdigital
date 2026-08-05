import { supabase } from './supabase'

// Depois do login: agência (e sócio, que tem acesso igual) vai pro painel
// interno, cliente vai pro portal dele, colaborador comum/gerente vai pra
// visão só das próprias tarefas (+ gerais, se for gerente).
export async function resolveHomeRoute() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/login'

  const { data } = await supabase.from('users').select('tipo').eq('id', user.id).maybeSingle()
  if (data?.tipo === 'cliente') return '/portal'
  if (data?.tipo === 'colaborador') {
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('papel')
      .eq('login_user_id', user.id)
      .maybeSingle()
    return colaborador?.papel === 'socio' ? '/dashboard' : '/conversas'
  }
  return '/dashboard'
}

// Resolve o contexto de equipe do usuário logado: o user_id "dono" sob o qual
// os dados compartilhados (conversas, casos, etc.) ficam gravados, e o id da
// linha em colaboradores do próprio usuário (quando ele é colaborador, não o
// dono da conta) - usado pra atribuir autoria de mensagens/uso de sugestão.
export async function resolveEquipeContext() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { userId: null, donoUserId: null, colaboradorId: null }

  const { data: perfil } = await supabase.from('users').select('tipo').eq('id', user.id).maybeSingle()
  if (perfil?.tipo === 'colaborador') {
    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id, user_id')
      .eq('login_user_id', user.id)
      .maybeSingle()
    return {
      userId: user.id,
      donoUserId: colaborador?.user_id || user.id,
      colaboradorId: colaborador?.id || null,
    }
  }

  return { userId: user.id, donoUserId: user.id, colaboradorId: null }
}
