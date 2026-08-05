import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Trash2, Megaphone, Sparkles, GraduationCap, Power } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

const EMPTY_NOVIDADE = { titulo: '', texto: '' }
const EMPTY_UPSELL = { titulo: '', descricao: '', link: '' }
const EMPTY_PILULA = { titulo: '', video_url: '', descricao: '' }

export default function PortalConteudo() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [novidades, setNovidades] = useState([])
  const [novaNovidade, setNovaNovidade] = useState(EMPTY_NOVIDADE)
  const [salvandoNovidade, setSalvandoNovidade] = useState(false)

  const [upsells, setUpsells] = useState([])
  const [novoUpsell, setNovoUpsell] = useState(EMPTY_UPSELL)
  const [salvandoUpsell, setSalvandoUpsell] = useState(false)

  const [pilulas, setPilulas] = useState([])
  const [novaPilula, setNovaPilula] = useState(EMPTY_PILULA)
  const [salvandoPilula, setSalvandoPilula] = useState(false)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      await carregar()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregar() {
    const [{ data: novidadesData }, { data: upsellsData }, { data: pilulasData }] = await Promise.all([
      supabase.from('novidades_google').select('*').order('created_at', { ascending: false }),
      supabase.from('upsells').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('pilulas_conhecimento').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false }),
    ])
    setNovidades(novidadesData || [])
    setUpsells(upsellsData || [])
    setPilulas(pilulasData || [])
  }

  async function handleAddNovidade(e) {
    e.preventDefault()
    if (!novaNovidade.titulo.trim() || !novaNovidade.texto.trim()) return
    setSalvandoNovidade(true)
    await supabase.from('novidades_google').insert({ titulo: novaNovidade.titulo.trim(), texto: novaNovidade.texto.trim() })
    setNovaNovidade(EMPTY_NOVIDADE)
    await carregar()
    setSalvandoNovidade(false)
  }

  async function handleDeleteNovidade(id) {
    if (!confirm('Excluir essa novidade?')) return
    await supabase.from('novidades_google').delete().eq('id', id)
    await carregar()
  }

  async function handleAddUpsell(e) {
    e.preventDefault()
    if (!novoUpsell.titulo.trim()) return
    setSalvandoUpsell(true)
    await supabase.from('upsells').insert({
      titulo: novoUpsell.titulo.trim(),
      descricao: novoUpsell.descricao.trim() || null,
      link: novoUpsell.link.trim() || null,
    })
    setNovoUpsell(EMPTY_UPSELL)
    await carregar()
    setSalvandoUpsell(false)
  }

  async function handleToggleUpsell(u) {
    await supabase.from('upsells').update({ ativo: !u.ativo }).eq('id', u.id)
    await carregar()
  }

  async function handleDeleteUpsell(id) {
    if (!confirm('Excluir esse banner?')) return
    await supabase.from('upsells').delete().eq('id', id)
    await carregar()
  }

  async function handleAddPilula(e) {
    e.preventDefault()
    if (!novaPilula.titulo.trim() || !novaPilula.video_url.trim()) return
    setSalvandoPilula(true)
    await supabase.from('pilulas_conhecimento').insert({
      titulo: novaPilula.titulo.trim(),
      video_url: novaPilula.video_url.trim(),
      descricao: novaPilula.descricao.trim() || null,
    })
    setNovaPilula(EMPTY_PILULA)
    await carregar()
    setSalvandoPilula(false)
  }

  async function handleDeletePilula(id) {
    if (!confirm('Excluir esse vídeo?')) return
    await supabase.from('pilulas_conhecimento').delete().eq('id', id)
    await carregar()
  }

  if (loading) {
    return (
      <Layout title="Conteúdo do portal">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Conteúdo do portal">
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Gerencie o que os clientes veem no portal deles: avisos sobre o Google, banners de outros serviços seus e
        vídeos curtos explicando como tudo funciona.
      </p>

      {/* Novidades do Google */}
      <div className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary-800" />
          Novidades do Google
        </h2>
        <form onSubmit={handleAddNovidade} className="space-y-3 mb-5">
          <input
            type="text"
            required
            placeholder="Título (ex: Google mudou as fotos de capa)"
            value={novaNovidade.titulo}
            onChange={(e) => setNovaNovidade({ ...novaNovidade, titulo: e.target.value })}
            className="input-field"
          />
          <textarea
            required
            rows={2}
            placeholder="Texto curto explicando pro cliente..."
            value={novaNovidade.texto}
            onChange={(e) => setNovaNovidade({ ...novaNovidade, texto: e.target.value })}
            className="input-field"
          />
          <button type="submit" disabled={salvandoNovidade} className="btn-primary flex items-center gap-2">
            {salvandoNovidade ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Publicar novidade
          </button>
        </form>
        {novidades.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma novidade publicada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {novidades.map((n) => (
              <li key={n.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{n.titulo}</p>
                  <p className="text-sm text-slate-500">{n.texto}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                </div>
                <button onClick={() => handleDeleteNovidade(n.id)} className="text-red-500 hover:text-red-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Vitrine de upgrades */}
      <div className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-800" />
          Vitrine de upgrades
        </h2>
        <form onSubmit={handleAddUpsell} className="flex flex-wrap items-end gap-3 mb-5">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
            <input
              type="text"
              required
              placeholder="Ex: Quer impulsionar com Google Ads?"
              value={novoUpsell.titulo}
              onChange={(e) => setNovoUpsell({ ...novoUpsell, titulo: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Texto curto de apoio"
              value={novoUpsell.descricao}
              onChange={(e) => setNovoUpsell({ ...novoUpsell, descricao: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Link (opcional)</label>
            <input
              type="url"
              placeholder="https://wa.me/..."
              value={novoUpsell.link}
              onChange={(e) => setNovoUpsell({ ...novoUpsell, link: e.target.value })}
              className="input-field"
            />
          </div>
          <button type="submit" disabled={salvandoUpsell} className="btn-primary flex items-center gap-2">
            {salvandoUpsell ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>
        {upsells.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum banner cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {upsells.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${u.ativo ? 'text-slate-700' : 'text-slate-400'}`}>{u.titulo}</p>
                  {u.descricao && <p className="text-xs text-slate-500">{u.descricao}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleToggleUpsell(u)}
                    className={`badge cursor-pointer flex items-center gap-1 ${u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    <Power className="w-3 h-3" />
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => handleDeleteUpsell(u.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pílulas de conhecimento */}
      <div className="card">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary-800" />
          Pílulas de conhecimento
        </h2>
        <form onSubmit={handleAddPilula} className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Título (ex: Como responder avaliações)"
              value={novaPilula.titulo}
              onChange={(e) => setNovaPilula({ ...novaPilula, titulo: e.target.value })}
              className="input-field"
            />
            <input
              type="url"
              required
              placeholder="Link do vídeo no YouTube"
              value={novaPilula.video_url}
              onChange={(e) => setNovaPilula({ ...novaPilula, video_url: e.target.value })}
              className="input-field"
            />
          </div>
          <input
            type="text"
            placeholder="Descrição curta (opcional)"
            value={novaPilula.descricao}
            onChange={(e) => setNovaPilula({ ...novaPilula, descricao: e.target.value })}
            className="input-field"
          />
          <button type="submit" disabled={salvandoPilula} className="btn-primary flex items-center gap-2">
            {salvandoPilula ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar vídeo
          </button>
        </form>
        {pilulas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum vídeo cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pilulas.map((p) => (
              <li key={p.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{p.titulo}</p>
                  {p.descricao && <p className="text-xs text-slate-500">{p.descricao}</p>}
                  <p className="text-xs text-slate-400 truncate">{p.video_url}</p>
                </div>
                <button onClick={() => handleDeletePilula(p.id)} className="text-red-500 hover:text-red-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
