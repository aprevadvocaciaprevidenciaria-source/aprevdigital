import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Trash2, Pencil, X, Check, ClipboardCheck, Lock } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { resolveEquipeContext } from '../lib/session'
import { TIPO_BENEFICIO_OPTIONS } from '../lib/documentos'

const EMPTY_ITEM = { tipo_beneficio: TIPO_BENEFICIO_OPTIONS[0].value, nome_documento: '', ordem: 0, ativo: true }

export default function Documentos() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [itens, setItens] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [salvando, setSalvando] = useState(false)
  const [userId, setUserId] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const ctx = await resolveEquipeContext()
      setUserId(ctx.donoUserId)
      let admin = !ctx.colaboradorId
      if (ctx.colaboradorId) {
        const { data: colaborador } = await supabase
          .from('colaboradores')
          .select('papel')
          .eq('id', ctx.colaboradorId)
          .maybeSingle()
        admin = colaborador?.papel === 'socio'
      }
      setIsAdmin(admin)
      await carregarItens()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregarItens() {
    const { data } = await supabase.from('documentos_checklist').select('*').order('tipo_beneficio').order('ordem')
    setItens(data || [])
  }

  function editar(item) {
    setForm({ tipo_beneficio: item.tipo_beneficio, nome_documento: item.nome_documento, ordem: item.ordem, ativo: item.ativo })
    setEditandoId(item.id)
    setMostrarForm(true)
  }

  function novo() {
    setForm(EMPTY_ITEM)
    setEditandoId(null)
    setMostrarForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome_documento.trim()) return
    setSalvando(true)
    setErro('')

    if (editandoId) {
      const { data, error } = await supabase
        .from('documentos_checklist')
        .update(form)
        .eq('id', editandoId)
        .select()
        .single()
      if (error) {
        setSalvando(false)
        setErro(error.message)
        return
      }
      setItens((prev) => prev.map((i) => (i.id === editandoId ? data : i)))
    } else {
      const { data, error } = await supabase
        .from('documentos_checklist')
        .insert([{ ...form, user_id: userId }])
        .select()
        .single()
      if (error) {
        setSalvando(false)
        setErro(error.message)
        return
      }
      setItens((prev) => [...prev, data])
    }

    setSalvando(false)
    setMostrarForm(false)
    setForm(EMPTY_ITEM)
    setEditandoId(null)
  }

  async function excluir(id) {
    if (!confirm('Remover esse documento do modelo? Não mexe no que já foi gerado pra clientes existentes.')) return
    setErro('')
    const { error } = await supabase.from('documentos_checklist').delete().eq('id', id)
    if (error) {
      setErro(error.message)
      return
    }
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  async function alternarAtivo(item) {
    setErro('')
    const { data, error } = await supabase
      .from('documentos_checklist')
      .update({ ativo: !item.ativo })
      .eq('id', item.id)
      .select()
      .single()
    if (error) {
      setErro(error.message)
      return
    }
    setItens((prev) => prev.map((i) => (i.id === item.id ? data : i)))
  }

  const itensFiltrados = itens.filter((i) => filtroTipo === 'todos' || i.tipo_beneficio === filtroTipo)

  if (loading) {
    return (
      <Layout title="Checklist de Documentos">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Checklist de Documentos">
      {erro && (
        <div className="card mb-6 bg-red-50 border-red-200 text-sm text-red-700">
          Não foi possível salvar: {erro}
        </div>
      )}
      <div className="card mb-6 bg-primary-50/60 border-primary-100 flex items-start gap-3">
        <ClipboardCheck className="w-5 h-5 text-primary-800 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          Esse é o modelo de documentos por tipo de benefício. Quando um caso é aberto (tela do cliente, aba
          Documentos), o painel gera a checklist dele a partir do que estiver <strong>ativo</strong> aqui. Editar o
          modelo depois não mexe em checklists já geradas.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filtroTipo === 'todos' ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Todos
          </button>
          {TIPO_BENEFICIO_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFiltroTipo(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filtroTipo === t.value ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin ? (
          <button onClick={novo} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Novo item
          </button>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Só o sócio edita o modelo
          </span>
        )}
      </div>

      {mostrarForm && isAdmin && (
        <form onSubmit={salvar} className="card space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-night text-sm">{editandoId ? 'Editar item' : 'Novo item'}</h3>
            <button
              type="button"
              onClick={() => {
                setMostrarForm(false)
                setEditandoId(null)
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <select
            value={form.tipo_beneficio}
            onChange={(e) => setForm({ ...form, tipo_beneficio: e.target.value })}
            className="input-field"
          >
            {TIPO_BENEFICIO_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Nome do documento (ex: CNIS atualizado)"
            value={form.nome_documento}
            onChange={(e) => setForm({ ...form, nome_documento: e.target.value })}
            className="input-field"
            required
          />
          <input
            type="number"
            placeholder="Ordem"
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
            className="input-field"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo (entra nas checklists geradas)
          </label>
          <button type="submit" disabled={salvando} className="btn-primary flex items-center justify-center gap-2 w-full">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </form>
      )}

      {itensFiltrados.length === 0 ? (
        <div className="card text-center py-10 text-sm text-slate-400">Nenhum documento nesse tipo de benefício ainda.</div>
      ) : (
        <ul className="space-y-2">
          {itensFiltrados.map((item) => (
            <li key={item.id} className={`card py-3 ${!item.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="badge bg-primary-50 text-primary-800">
                      {TIPO_BENEFICIO_OPTIONS.find((t) => t.value === item.tipo_beneficio)?.label || item.tipo_beneficio}
                    </span>
                    {!item.ativo && <span className="badge bg-slate-100 text-slate-500">Inativo</span>}
                  </div>
                  <p className="font-medium text-slate-700">{item.nome_documento}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => alternarAtivo(item)}
                      className="p-2 text-slate-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
                      title={item.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => editar(item)}
                      className="p-2 text-slate-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => excluir(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}
