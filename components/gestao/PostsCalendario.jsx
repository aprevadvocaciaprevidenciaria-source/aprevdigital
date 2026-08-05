import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Trash2,
  X,
  Image as ImageIcon,
  Check,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fotoUrl } from '../../lib/fotos'

const TIPO_OPTIONS = [
  { value: 'novidade', label: 'Novidade' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'evento', label: 'Evento' },
  { value: 'produto', label: 'Produto' },
]

const CTA_OPTIONS = [
  { value: '', label: 'Sem botão' },
  { value: 'saiba_mais', label: 'Saiba mais' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'pedir', label: 'Pedir' },
  { value: 'reservar', label: 'Reservar' },
  { value: 'ligar', label: 'Ligar' },
]

const STATUS_META = {
  planejado: { label: 'Planejado', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  publicado: { label: 'Publicado', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelado: { label: 'Cancelado', badge: 'bg-red-100 text-red-500 line-through', dot: 'bg-red-400' },
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function todayStr() {
  return toDateStr(new Date())
}

function buildGrid(cursor) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const weekdayMonday0 = (firstOfMonth.getDay() + 6) % 7 // 0 = segunda
  const gridStart = new Date(year, month, 1 - weekdayMonday0)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

function emptyForm(dataStr) {
  return {
    titulo: '',
    descricao: '',
    tipo: 'novidade',
    data_programada: dataStr || todayStr(),
    status: 'planejado',
    link_cta: '',
    cta_tipo: '',
    imagem_path: '',
  }
}

export default function PostsCalendario({ clienteId, userId }) {
  const [posts, setPosts] = useState([])
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showGaleria, setShowGaleria] = useState(false)

  useEffect(() => {
    loadPosts()
    loadFotos()
  }, [clienteId])

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts_calendario')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_programada', { ascending: true })
    setPosts(data || [])
    setLoading(false)
  }

  async function loadFotos() {
    const { data } = await supabase
      .from('fotos_clientes')
      .select('id, path')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    setFotos(data || [])
  }

  function abrirNovo(dataStr) {
    setEditingId(null)
    setForm(emptyForm(dataStr))
    setShowGaleria(false)
  }

  function abrirEdicao(post) {
    setEditingId(post.id)
    setForm({
      titulo: post.titulo || '',
      descricao: post.descricao || '',
      tipo: post.tipo || 'novidade',
      data_programada: post.data_programada,
      status: post.status || 'planejado',
      link_cta: post.link_cta || '',
      cta_tipo: post.cta_tipo || '',
      imagem_path: post.imagem_path || '',
    })
    setShowGaleria(false)
  }

  function fecharForm() {
    setForm(null)
    setEditingId(null)
    setShowGaleria(false)
  }

  async function handleSalvar(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setSaving(true)

    const payload = {
      cliente_id: clienteId,
      user_id: userId,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      data_programada: form.data_programada,
      status: form.status,
      link_cta: form.link_cta.trim() || null,
      cta_tipo: form.cta_tipo || null,
      imagem_path: form.imagem_path || null,
      data_publicada: form.status === 'publicado' ? new Date().toISOString() : null,
      fonte: 'manual',
    }

    if (editingId) {
      const { data } = await supabase.from('posts_calendario').update(payload).eq('id', editingId).select().single()
      if (data) setPosts(posts.map((p) => (p.id === editingId ? data : p)))
    } else {
      const { data } = await supabase.from('posts_calendario').insert([payload]).select().single()
      if (data) setPosts([...posts, data])
    }
    setSaving(false)
    fecharForm()
  }

  async function handleExcluir(postId) {
    if (!confirm('Excluir este post do calendário?')) return
    await supabase.from('posts_calendario').delete().eq('id', postId)
    setPosts(posts.filter((p) => p.id !== postId))
    if (editingId === postId) fecharForm()
  }

  async function handleMarcarPublicado(post) {
    const { data } = await supabase
      .from('posts_calendario')
      .update({ status: 'publicado', data_publicada: new Date().toISOString() })
      .eq('id', post.id)
      .select()
      .single()
    if (data) setPosts(posts.map((p) => (p.id === post.id ? data : p)))
  }

  const dias = buildGrid(cursor)
  const mesAtualIndex = cursor.getMonth()
  const postsPorDia = {}
  for (const p of posts) {
    postsPorDia[p.data_programada] = postsPorDia[p.data_programada] || []
    postsPorDia[p.data_programada].push(p)
  }

  const postsDoSelecionado = postsPorDia[selectedDate] || []
  const proximos = posts
    .filter((p) => p.status === 'planejado' && p.data_programada >= todayStr())
    .slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-display font-semibold text-night w-40 text-center">
              {MESES[mesAtualIndex]} {cursor.getFullYear()}
            </h3>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => abrirNovo(selectedDate)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Novo post
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map((d) => {
                const dataStr = toDateStr(d)
                const foraDoMes = d.getMonth() !== mesAtualIndex
                const isHoje = dataStr === todayStr()
                const isSelecionado = dataStr === selectedDate
                const postsDoDia = postsPorDia[dataStr] || []
                return (
                  <button
                    key={dataStr}
                    onClick={() => setSelectedDate(dataStr)}
                    className={`min-h-[64px] rounded-lg border p-1.5 text-left align-top transition-colors ${
                      isSelecionado
                        ? 'border-secondary-500 bg-secondary-50'
                        : 'border-slate-100 hover:border-slate-300'
                    } ${foraDoMes ? 'opacity-40' : ''}`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        isHoje ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-800 text-white' : 'text-slate-500'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {postsDoDia.slice(0, 2).map((p) => (
                        <div
                          key={p.id}
                          className={`w-full truncate text-[10px] leading-tight px-1 py-0.5 rounded ${STATUS_META[p.status]?.badge || STATUS_META.planejado.badge}`}
                        >
                          {p.titulo}
                        </div>
                      ))}
                      {postsDoDia.length > 2 && (
                        <div className="text-[10px] text-slate-400">+{postsDoDia.length - 2}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Posts do dia selecionado */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-night text-sm">
            Posts em {selectedDate.split('-').reverse().join('/')}
          </h3>
          <button onClick={() => abrirNovo(selectedDate)} className="text-xs text-primary-800 font-medium flex items-center gap-1 hover:underline">
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
        {postsDoSelecionado.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum post programado para este dia.</p>
        ) : (
          <ul className="space-y-2">
            {postsDoSelecionado.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  {p.imagem_path && (
                    <img src={fotoUrl(p.imagem_path)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.titulo}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`badge ${STATUS_META[p.status]?.badge || STATUS_META.planejado.badge}`}>
                        <span className={`badge-dot ${STATUS_META[p.status]?.dot || STATUS_META.planejado.dot}`} />
                        {STATUS_META[p.status]?.label || p.status}
                      </span>
                      <span className="text-xs text-slate-400">{TIPO_OPTIONS.find((t) => t.value === p.tipo)?.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {p.status === 'planejado' && (
                    <button
                      onClick={() => handleMarcarPublicado(p)}
                      title="Marcar como publicado"
                      className="p-1.5 text-slate-400 hover:text-emerald-600"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => abrirEdicao(p)} className="text-xs text-primary-800 font-medium px-2 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => handleExcluir(p.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {proximos.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-night text-sm mb-3">Próximos posts planejados</h3>
          <ul className="space-y-1.5">
            {proximos.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{p.titulo}</span>
                <span className="text-xs text-slate-400">{p.data_programada.split('-').reverse().join('/')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal simples de criar/editar post */}
      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={fecharForm}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-night">{editingId ? 'Editar post' : 'Novo post'}</h3>
              <button onClick={fecharForm} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-3">
              <input
                placeholder="Título do post"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="input-field w-full"
                required
              />
              <textarea
                placeholder="Descrição / texto do post"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="input-field w-full min-h-[80px]"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input-field w-full">
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Data programada</label>
                  <input
                    type="date"
                    value={form.data_programada}
                    onChange={(e) => setForm({ ...form, data_programada: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field w-full">
                    <option value="planejado">Planejado</option>
                    <option value="publicado">Publicado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Botão (call-to-action)</label>
                  <select value={form.cta_tipo} onChange={(e) => setForm({ ...form, cta_tipo: e.target.value })} className="input-field w-full">
                    {CTA_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.cta_tipo && (
                <input
                  placeholder="Link do botão (https://...)"
                  value={form.link_cta}
                  onChange={(e) => setForm({ ...form, link_cta: e.target.value })}
                  className="input-field w-full"
                />
              )}

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Imagem</label>
                {form.imagem_path ? (
                  <div className="flex items-center gap-2">
                    <img src={fotoUrl(form.imagem_path)} alt="" className="w-16 h-16 rounded object-cover" />
                    <button type="button" onClick={() => setForm({ ...form, imagem_path: '' })} className="text-xs text-red-600 hover:underline">
                      Remover
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowGaleria((v) => !v)}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Escolher da galeria do cliente
                  </button>
                )}
                {showGaleria && (
                  <div className="grid grid-cols-4 gap-2 mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2">
                    {(fotos || []).length === 0 && (
                      <p className="text-xs text-slate-400 col-span-4">Nenhuma foto na galeria deste cliente ainda.</p>
                    )}
                    {(fotos || []).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, imagem_path: f.path })
                          setShowGaleria(false)
                        }}
                        className="rounded overflow-hidden border border-slate-200 hover:border-secondary-500"
                      >
                        <img src={fotoUrl(f.path)} alt="" className="w-full h-14 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => handleExcluir(editingId)}
                    className="text-sm text-red-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                ) : <span />}
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
