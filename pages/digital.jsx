import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, X, ArrowRight, Trash2, Pencil, Instagram, Calendar, Link2, Sparkles } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'

const STATUS_ORDER = ['ideia', 'roteiro', 'gravacao', 'edicao', 'agendado', 'publicado']

const STATUS_META = {
  ideia: { label: 'Ideia', badge: 'bg-slate-100 text-slate-600' },
  roteiro: { label: 'Roteiro', badge: 'bg-sky-100 text-sky-700' },
  gravacao: { label: 'Gravação', badge: 'bg-amber-100 text-amber-700' },
  edicao: { label: 'Edição', badge: 'bg-purple-100 text-purple-700' },
  agendado: { label: 'Agendado', badge: 'bg-indigo-100 text-indigo-700' },
  publicado: { label: 'Publicado', badge: 'bg-emerald-100 text-emerald-700' },
}

const TIPO_META = { post: 'Post', video: 'Vídeo', reels: 'Reels', story: 'Story' }
const PLATAFORMA_META = {
  instagram: 'Instagram',
  google_business: 'Google Business',
  tiktok: 'TikTok',
  facebook: 'Facebook',
}

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  tipo: 'post',
  plataforma: 'instagram',
  status: 'ideia',
  data_prevista: '',
  link_publicado: '',
}

export default function Digital() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [itens, setItens] = useState([])
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [gerandoIdeias, setGerandoIdeias] = useState(false)
  const [erroIdeias, setErroIdeias] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      await carregarItens()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregarItens() {
    const { data } = await supabase.from('conteudo_digital').select('*').order('created_at', { ascending: false })
    setItens(data || [])
  }

  function novo() {
    setForm(EMPTY_FORM)
    setEditandoId(null)
    setMostrarForm(true)
  }

  function editar(item) {
    setForm({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      tipo: item.tipo || 'post',
      plataforma: item.plataforma || 'instagram',
      status: item.status || 'ideia',
      data_prevista: item.data_prevista || '',
      link_publicado: item.link_publicado || '',
    })
    setEditandoId(item.id)
    setMostrarForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSalvando(true)

    const payload = { ...form, data_prevista: form.data_prevista || null }

    if (editandoId) {
      const { data, error } = await supabase
        .from('conteudo_digital')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editandoId)
        .select()
        .single()
      if (!error) setItens((prev) => prev.map((i) => (i.id === editandoId ? data : i)))
    } else {
      const { data, error } = await supabase
        .from('conteudo_digital')
        .insert([{ ...payload, user_id: userId }])
        .select()
        .single()
      if (!error) setItens((prev) => [data, ...prev])
    }

    setSalvando(false)
    setMostrarForm(false)
    setForm(EMPTY_FORM)
    setEditandoId(null)
  }

  async function excluir(id) {
    if (!confirm('Excluir esse item do calendário?')) return
    await supabase.from('conteudo_digital').delete().eq('id', id)
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  async function gerarIdeias() {
    if (gerandoIdeias) return
    setGerandoIdeias(true)
    setErroIdeias('')

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const resp = await fetch('/api/digital/gerar-ideias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
    const data = await resp.json().catch(() => ({}))

    if (resp.ok) {
      setItens((prev) => [...(data.criados || []), ...prev])
    } else {
      setErroIdeias(data?.error || 'Falha ao gerar ideias.')
    }
    setGerandoIdeias(false)
  }

  async function avancarStatus(item) {
    const idx = STATUS_ORDER.indexOf(item.status)
    if (idx === -1 || idx === STATUS_ORDER.length - 1) return
    const novoStatus = STATUS_ORDER[idx + 1]
    const { data } = await supabase.from('conteudo_digital').update({ status: novoStatus }).eq('id', item.id).select().single()
    if (data) setItens((prev) => prev.map((i) => (i.id === item.id ? data : i)))
  }

  const itensFiltrados = useMemo(
    () => itens.filter((i) => filtroPlataforma === 'todas' || i.plataforma === filtroPlataforma),
    [itens, filtroPlataforma]
  )

  const colunas = useMemo(() => {
    const mapa = {}
    STATUS_ORDER.forEach((s) => (mapa[s] = []))
    itensFiltrados.forEach((item) => {
      if (mapa[item.status]) mapa[item.status].push(item)
    })
    return mapa
  }, [itensFiltrados])

  if (loading) {
    return (
      <Layout title="Central do Digital">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Central do Digital">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFiltroPlataforma('todas')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filtroPlataforma === 'todas' ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Todas
          </button>
          {Object.entries(PLATAFORMA_META).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFiltroPlataforma(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filtroPlataforma === value ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={gerarIdeias}
            disabled={gerandoIdeias}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {gerandoIdeias ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {gerandoIdeias ? 'Gerando ideias...' : 'Gerar ideias com IA'}
          </button>
          <button onClick={novo} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Novo item
          </button>
        </div>
      </div>

      {erroIdeias && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{erroIdeias}</div>
      )}

      {mostrarForm && (
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
          <input
            placeholder="Título / assunto"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="input-field"
            required
          />
          <textarea
            placeholder="Roteiro / observações (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={3}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input-field">
              {Object.entries(TIPO_META).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={form.plataforma}
              onChange={(e) => setForm({ ...form, plataforma: e.target.value })}
              className="input-field"
            >
              {Object.entries(PLATAFORMA_META).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
              {STATUS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.data_prevista}
              onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
              className="input-field"
              title="Data prevista de publicação"
            />
          </div>
          {form.status === 'publicado' && (
            <input
              type="url"
              placeholder="Link do post publicado (opcional)"
              value={form.link_publicado}
              onChange={(e) => setForm({ ...form, link_publicado: e.target.value })}
              className="input-field"
            />
          )}
          <button type="submit" disabled={salvando} className="btn-primary w-full flex items-center justify-center gap-2">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="min-w-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className={`badge ${STATUS_META[status].badge}`}>{STATUS_META[status].label}</span>
              <span className="text-xs text-slate-400">{colunas[status].length}</span>
            </div>
            <div className="space-y-2">
              {colunas[status].length === 0 ? (
                <div className="text-xs text-slate-300 text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  Vazio
                </div>
              ) : (
                colunas[status].map((item) => (
                  <div key={item.id} className="card p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium text-slate-700 leading-snug">{item.titulo}</p>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {TIPO_META[item.tipo]} · {PLATAFORMA_META[item.plataforma]}
                    </p>
                    {item.data_prevista && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(item.data_prevista)}
                      </p>
                    )}
                    {item.link_publicado && (
                      <a
                        href={item.link_publicado}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary-700 flex items-center gap-1 hover:underline"
                      >
                        <Link2 className="w-3 h-3" /> Ver publicação
                      </a>
                    )}
                    <div className="flex items-center gap-1 pt-1">
                      {status !== 'publicado' && (
                        <button
                          onClick={() => avancarStatus(item)}
                          className="p-1.5 text-slate-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
                          title={`Mover pra ${STATUS_META[STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]].label}`}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => editar(item)}
                        className="p-1.5 text-slate-400 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => excluir(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {itens.length === 0 && (
        <div className="card text-center py-10 text-sm text-slate-400 mt-4 flex flex-col items-center gap-2">
          <Instagram className="w-8 h-8 text-slate-300" />
          Nenhum post, vídeo ou reels no calendário ainda. Clique em "Novo item" pra começar a planejar o digital do
          escritório.
        </div>
      )}
    </Layout>
  )
}
