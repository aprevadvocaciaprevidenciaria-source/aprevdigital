import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Plus,
  Loader2,
  Trash2,
  X,
  CheckSquare,
  Clock,
  GripVertical,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const COLUNAS = [
  { value: 'a-fazer', label: 'A Fazer' },
  { value: 'em_andamento', label: 'Em Progresso' },
  { value: 'concluida', label: 'Concluído' },
]

const PRIORIDADE_OPTIONS = ['baixa', 'media', 'alta']

const PRIORIDADE_STYLES = {
  alta: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
  media: { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500' },
  baixa: { badge: 'bg-slate-100 text-slate-600', border: 'border-l-slate-300' },
}

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  cliente_id: '',
  colaborador_id: '',
  prioridade: 'media',
  vencimento: '',
  subtarefas: [],
}

export default function Tarefas() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [clientes, setClientes] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [clienteFilter, setClienteFilter] = useState('todos')
  const [prioridadeFilter, setPrioridadeFilter] = useState('todas')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [novaSubtarefa, setNovaSubtarefa] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragOverColuna, setDragOverColuna] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      await loadData()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadData() {
    const [{ data: tarefasData }, { data: clientesData }, { data: colaboradoresData }] = await Promise.all([
      supabase
        .from('tarefas')
        .select('*, clientes(id, nome), colaboradores(id, nome)')
        .order('vencimento', { ascending: true }),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase.from('colaboradores').select('id, nome').order('nome'),
    ])
    setTarefas(tarefasData || [])
    setClientes(clientesData || [])
    setColaboradores(colaboradoresData || [])
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setNovaSubtarefa('')
    setShowModal(true)
  }

  function openEditModal(tarefa) {
    setEditingId(tarefa.id)
    setForm({
      titulo: tarefa.titulo || '',
      descricao: tarefa.descricao || '',
      cliente_id: tarefa.cliente_id || '',
      colaborador_id: tarefa.colaborador_id || '',
      prioridade: tarefa.prioridade || 'media',
      vencimento: tarefa.vencimento || '',
      subtarefas: tarefa.subtarefas || [],
    })
    setNovaSubtarefa('')
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      cliente_id: form.cliente_id || null,
      colaborador_id: form.colaborador_id || null,
      user_id: userId,
    }

    if (editingId) {
      await supabase.from('tarefas').update(payload).eq('id', editingId)
    } else {
      await supabase.from('tarefas').insert([payload])
    }

    setSaving(false)
    setShowModal(false)
    await loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta tarefa?')) return
    await supabase.from('tarefas').delete().eq('id', id)
    await loadData()
  }

  async function moveTarefa(taskId, novoStatus) {
    const tarefa = tarefas.find((t) => t.id === taskId)
    if (!tarefa || tarefa.status === novoStatus) return
    setTarefas(tarefas.map((t) => (t.id === taskId ? { ...t, status: novoStatus } : t)))
    await supabase.from('tarefas').update({ status: novoStatus }).eq('id', taskId)
  }

  function addSubtarefaItem() {
    if (!novaSubtarefa.trim()) return
    setForm({
      ...form,
      subtarefas: [...form.subtarefas, { id: crypto.randomUUID(), titulo: novaSubtarefa.trim(), concluida: false }],
    })
    setNovaSubtarefa('')
  }

  function toggleSubtarefaItem(itemId) {
    setForm({
      ...form,
      subtarefas: form.subtarefas.map((s) => (s.id === itemId ? { ...s, concluida: !s.concluida } : s)),
    })
  }

  function removeSubtarefaItem(itemId) {
    setForm({ ...form, subtarefas: form.subtarefas.filter((s) => s.id !== itemId) })
  }

  const filtered = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          (clienteFilter === 'todos' || t.cliente_id === clienteFilter) &&
          (prioridadeFilter === 'todas' || t.prioridade === prioridadeFilter)
      ),
    [tarefas, clienteFilter, prioridadeFilter]
  )

  const hoje = new Date().toISOString().slice(0, 10)

  if (loading) {
    return (
      <Layout title="Tarefas">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Tarefas">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-3 flex-wrap">
          <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className="input-field sm:max-w-[200px]">
            <option value="todos">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)} className="input-field sm:max-w-[160px]">
            <option value="todas">Todas as prioridades</option>
            {PRIORIDADE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 justify-center">
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUNAS.map((coluna) => {
          const tarefasColuna = filtered.filter((t) => t.status === coluna.value)
          return (
            <div
              key={coluna.value}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverColuna(coluna.value)
              }}
              onDragLeave={() => setDragOverColuna(null)}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData('text/plain')
                moveTarefa(taskId, coluna.value)
                setDragOverColuna(null)
              }}
              className={`rounded-xl border-2 border-dashed p-3 min-h-[300px] transition-colors ${
                dragOverColuna === coluna.value ? 'border-secondary-400 bg-secondary-50/40' : 'border-transparent bg-slate-100/60'
              }`}
            >
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
                  const style = PRIORIDADE_STYLES[t.prioridade] || PRIORIDADE_STYLES.baixa
                  const vencida = t.vencimento && t.vencimento < hoje && t.status !== 'concluida'
                  const subtarefas = t.subtarefas || []
                  const concluidas = subtarefas.filter((s) => s.concluida).length
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                      onClick={() => openEditModal(t)}
                      className={`card p-3 border-l-4 ${style.border} cursor-pointer`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {t.titulo}
                        </p>
                        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                      {(t.clientes?.nome || t.colaboradores?.nome) && (
                        <p className="text-xs text-slate-500 mt-1">
                          {t.clientes?.nome}
                          {t.clientes?.nome && t.colaboradores?.nome ? ' · ' : ''}
                          {t.colaboradores?.nome && `Responsável: ${t.colaboradores.nome}`}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                        <span className={`badge ${style.badge}`}>{t.prioridade}</span>
                        {t.vencimento && (
                          <span className={`text-xs flex items-center gap-1 ${vencida ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                            <Clock className="w-3 h-3" />
                            {t.vencimento}
                          </span>
                        )}
                      </div>
                      {subtarefas.length > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-secondary-500 h-1.5 rounded-full"
                              style={{ width: `${(concluidas / subtarefas.length) * 100}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{concluidas}/{subtarefas.length} subtarefas</p>
                        </div>
                      )}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                          className="p-1 text-slate-300 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-night">{editingId ? 'Editar tarefa' : 'Nova tarefa'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="input-field"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Nenhum</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                <select
                  value={form.colaborador_id}
                  onChange={(e) => setForm({ ...form, colaborador_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Ninguém atribuído</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                    className="input-field"
                  >
                    {PRIORIDADE_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subtarefas</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={novaSubtarefa}
                    onChange={(e) => setNovaSubtarefa(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSubtarefaItem()
                      }
                    }}
                    placeholder="Adicionar item..."
                    className="input-field"
                  />
                  <button type="button" onClick={addSubtarefaItem} className="btn-secondary px-3">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {form.subtarefas.length > 0 && (
                  <ul className="space-y-1.5">
                    {form.subtarefas.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        <button type="button" onClick={() => toggleSubtarefaItem(s.id)}>
                          <CheckSquare className={`w-4 h-4 ${s.concluida ? 'text-primary-800' : 'text-slate-300'}`} />
                        </button>
                        <span className={`flex-1 ${s.concluida ? 'line-through text-slate-400' : 'text-slate-700'}`}>{s.titulo}</span>
                        <button type="button" onClick={() => removeSubtarefaItem(s.id)} className="text-slate-300 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Salvar alterações' : 'Criar tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
