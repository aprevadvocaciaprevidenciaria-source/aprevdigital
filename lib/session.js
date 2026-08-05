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
    return colaborador?.papel === 'socio' ? '/dashboard' : '/minhas-tarefas'
  }
  return '/dashboard'
}
