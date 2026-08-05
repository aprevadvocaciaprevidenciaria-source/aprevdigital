import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Trash2, Pencil, X, Check, BookOpen, Lock } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { resolveEquipeContext } from '../lib/session'

const CATEGORIA_META = {
  servico: { label: 'Serviço', badge: 'bg-sky-100 text-sky-700' },
  objecao: { label: 'Objeção comum', badge: 'bg-amber-100 text-amber-700' },
  faq: { label: 'FAQ', badge: 'bg-purple-100 text-purple-700' },
  glossario: { label: 'Glossário de status', badge: 'bg-indigo-100 text-indigo-700' },
  fora_do_escopo: { label: 'Fora do escopo (sempre escalar)', badge: 'bg-red-100 text-red-700' },
}

const EMPTY_ITEM = { categoria: 'faq', topico: '', resposta_aprovada: '', ativo: true }

export default function BaseConhecimento() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [itens, setItens] = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const ctx = await resolveEquipeContext()
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
    const { data } = await supabase.from('base_conhecimento_ia').select('*').order('categoria').order('topico')
    setItens(data || [])
  }

  function editar(item) {
    setForm({ categoria: item.categoria, topico: item.topico, resposta_aprovada: item.resposta_aprovada, ativo: item.ativo })
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
    if (!form.topico.trim() || !form.resposta_aprovada.trim()) return
    setSalvando(true)

    if (editandoId) {
      const { data, error } = await supabase
        .from('base_conhecimento_ia')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editandoId)
        .select()
        .single()
      if (!error) setItens((prev) => prev.map((i) => (i.id === editandoId ? data : i)))
    } else {
      const { data: sessionData } = await supabase.auth.getSession()
      const { data, error } = await supabase
        .from('base_conhecimento_ia')
        .insert([{ ...form, user_id: sessionData.session.user.id, aprovado_por: sessionData.session.user.email }])
        .select()
        .single()
      if (!error) setItens((prev) => [...prev, data])
    }

    setSalvando(false)
    setMostrarForm(false)
    setForm(EMPTY_ITEM)
    setEditandoId(null)
  }

  async function excluir(id) {
    await supabase.from('base_conhecimento_ia').delete().eq('id', id)
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  async function alternarAtivo(item) {
    const { data } = await supabase
      .from('base_conhecimento_ia')
      .update({ ativo: !item.ativo })
      .eq('id', item.id)
      .select()
      .single()
    if (data) setItens((prev) => prev.map((i) => (i.id === item.id ? data : i)))
  }

  const itensFiltrados = itens.filter((i) => filtroCategoria === 'todos' || i.categoria === filtroCategoria)

  if (loading) {
    return (
      <Layout title="Base de Conhecimento IA">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Base de Conhecimento IA">
      <div className="card mb-6 bg-primary-50/60 border-primary-100 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-primary-800 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          Esse é o playbook que alimenta a sugestão de resposta da IA nas Conversas WhatsApp. Só o sócio aprova o que entra
          aqui — a ideia é a IA sempre <strong>informar fato</strong>, nunca <strong>dar parecer jurídico</strong>. Tudo que
          exige avaliação de caso (chance de êxito, valor a receber, estratégia de recurso) deve ficar marcado como{' '}
          <strong>Fora do escopo</strong> pra sempre escalar pro Dr.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filtroCategoria === 'todos' ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Todos
          </button>
          {Object.entries(CATEGORIA_META).map(([value, meta]) => (
            <button
              key={value}
              onClick={() => setFiltroCategoria(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filtroCategoria === value ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {meta.label}
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
            <Lock className="w-3.5 h-3.5" /> Só o sócio edita a base
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
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="input-field"
          >
            {Object.entries(CATEGORIA_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Tópico / pergunta (ex: Quanto tempo demora o auxílio-doença?)"
            value={form.topico}
            onChange={(e) => setForm({ ...form, topico: e.target.value })}
            className="input-field"
            required
          />
          <textarea
            placeholder="Resposta aprovada pra IA sugerir"
            value={form.resposta_aprovada}
            onChange={(e) => setForm({ ...form, resposta_aprovada: e.target.value })}
            rows={4}
            className="input-field"
            required
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo (a IA pode usar esse conteúdo)
          </label>
          <button type="submit" disabled={salvando} className="btn-primary flex items-center justify-center gap-2 w-full">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </form>
      )}

      {itensFiltrados.length === 0 ? (
        <div className="card text-center py-10 text-sm text-slate-400">Nenhum item nessa categoria ainda.</div>
      ) : (
        <ul className="space-y-3">
          {itensFiltrados.map((item) => {
            const meta = CATEGORIA_META[item.categoria] || CATEGORIA_META.faq
            return (
              <li key={item.id} className={`card ${!item.ativo ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      {!item.ativo && <span className="badge bg-slate-100 text-slate-500">Inativo</span>}
                    </div>
                    <p className="font-medium text-slate-700">{item.topico}</p>
                    <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{item.resposta_aprovada}</p>
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
            )
          })}
        </ul>
      )}
    </Layout>
  )
}
