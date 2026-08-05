import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, CheckSquare, Clock } from 'lucide-react'
import PortalLayout from '../components/PortalLayout'
import { supabase } from '../lib/supabase'

const COLUNAS = [
  { value: 'a-fazer', label: 'A Fazer' },
  { value: 'em_andamento', label: 'Em Progresso' },
  { value: 'concluida', label: 'Concluído' },
]

const PRIORIDADE_STYLES = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-slate-100 text-slate-600',
}

const PODE_VER_GERAIS = ['socio', 'gerente']

export default function MinhasTarefas() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [colaborador, setColaborador] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [filtro, setFiltro] = useState('minhas')

  const vePainelGeral = PODE_VER_GERAIS.includes(colaborador?.papel)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('users').select('tipo').eq('id', user.id).maybeSingle()
      if (perfil?.tipo === 'cliente') {
        router.replace('/portal')
        return
      }
      if (perfil?.tipo !== 'colaborador') {
        router.replace('/dashboard')
        return
      }

      const { data: meuColaborador } = await supabase
        .from('colaboradores')
        .select('id, nome, papel')
        .eq('login_user_id', user.id)
        .maybeSingle()
      setColaborador(meuColaborador)

      if (meuColaborador) {
        await carregarTarefas(meuColaborador)
      }

      setLoading(false)
    }
    init()
  }, [router])

  async function carregarTarefas(meuColaborador) {
    let query = supabase.from('tarefas').select('*, clientes(nome)').order('vencimento', { ascending: true })
    if (PODE_VER_GERAIS.includes(meuColaborador.papel)) {
      query = query.or(`colaborador_id.eq.${meuColaborador.id},colaborador_id.is.null`)
    } else {
      query = query.eq('colaborador_id', meuColaborador.id)
    }
    const { data } = await query
    setTarefas(data || [])
  }

  async function moverTarefa(tarefa, novoStatus) {
    setTarefas(tarefas.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t)))
    await supabase.from('tarefas').update({ status: novoStatus }).eq('id', tarefa.id)
  }

  async function atribuirAMim(tarefa) {
    if (!colaborador) return
    setTarefas(tarefas.map((t) => (t.id === tarefa.id ? { ...t, colaborador_id: colaborador.id } : t)))
    await supabase.from('tarefas').update({ colaborador_id: colaborador.id }).eq('id', tarefa.id)
  }

  async function toggleSubtarefa(tarefa, itemId) {
    const novasSubtarefas = (tarefa.subtarefas || []).map((s) =>
      s.id === itemId ? { ...s, concluida: !s.concluida } : s
    )
    setTarefas(tarefas.map((t) => (t.id === tarefa.id ? { ...t, subtarefas: novasSubtarefas } : t)))
    await supabase.from('tarefas').update({ subtarefas: novasSubtarefas }).eq('id', tarefa.id)
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </PortalLayout>
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)

  const tarefasVisiveis = tarefas.filter((t) => {
    if (!vePainelGeral || filtro === 'todas') return true
    if (filtro === 'minhas') return t.colaborador_id === colaborador?.id
    return t.colaborador_id === null
  })

  return (
    <PortalLayout clienteNome={colaborador?.nome}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-display text-xl font-bold text-night">Minhas tarefas</h1>
        {vePainelGeral && (
          <div className="flex gap-1">
            {[
              { value: 'minhas', label: 'Minhas' },
              { value: 'gerais', label: 'Gerais' },
              { value: 'todas', label: 'Todas' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  filtro === f.value ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!colaborador ? (
        <div className="card text-center py-10 text-sm text-slate-500">
          Sua conta ainda não está vinculada a um colaborador. Fale com o dono do painel.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUNAS.map((coluna) => {
            const tarefasColuna = tarefasVisiveis.filter((t) => t.status === coluna.value)
            return (
              <div key={coluna.value} className="rounded-xl bg-slate-100/60 p-3 min-h-[200px]">
                <div className="flex items-center justify-between px-1 mb-3">
                  <h3 className="font-display font-semibold text-night text-sm">{coluna.label}</h3>
                  <span className="badge bg-white text-slate-500 border border-slate-200">{tarefasColuna.length}</span>
                </div>

                <div className="space-y-3">
                  {tarefasColuna.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                      <CheckSquare className="w-6 h-6 mb-1" />
                      <p className="text-xs">Sem tarefas</p>
                    </div>
                  )}
                  {tarefasColuna.map((t) => {
                    const vencida = t.vencimento && t.vencimento < hoje && t.status !== 'concluida'
                    const subtarefas = t.subtarefas || []
                    return (
                      <div key={t.id} className="card p-3">
                        <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {t.titulo}
                        </p>
                        {t.descricao && <p className="text-xs text-slate-500 mt-1">{t.descricao}</p>}
                        {t.clientes?.nome && <p className="text-xs text-slate-400 mt-1">{t.clientes.nome}</p>}
                        {vePainelGeral && t.colaborador_id === null && (
                          <button
                            onClick={() => atribuirAMim(t)}
                            className="text-xs text-primary-800 underline mt-1"
                          >
                            Atribuir a mim
                          </button>
                        )}

                        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                          <span className={`badge ${PRIORIDADE_STYLES[t.prioridade] || PRIORIDADE_STYLES.baixa}`}>
                            {t.prioridade}
                          </span>
                          {t.vencimento && (
                            <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                              <Clock className="w-3 h-3" />
                              {t.vencimento}
                            </span>
                          )}
                        </div>

                        {subtarefas.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {subtarefas.map((s) => (
                              <li key={s.id} className="flex items-center gap-2 text-xs">
                                <button onClick={() => toggleSubtarefa(t, s.id)}>
                                  <CheckSquare className={`w-3.5 h-3.5 ${s.concluida ? 'text-primary-800' : 'text-slate-300'}`} />
                                </button>
                                <span className={s.concluida ? 'line-through text-slate-400' : 'text-slate-600'}>{s.titulo}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <select
                          value={t.status}
                          onChange={(e) => moverTarefa(t, e.target.value)}
                          className="input-field text-xs mt-2 py-1"
                        >
                          {COLUNAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PortalLayout>
  )
}
