import { useEffect, useState } from 'react'
import { Upload, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { categoriaFotoLabel, fotoUrl } from '../../lib/fotos'

function startOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function FotosCliente({ clienteId, userId }) {
  const [loading, setLoading] = useState(true)
  const [fotos, setFotos] = useState([])
  const [qtdMinima, setQtdMinima] = useState(3)
  const [categoria, setCategoria] = useState('semanal')
  const [descricao, setDescricao] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const [{ data: fotosData }, { data: automacaoConfig }] = await Promise.all([
      supabase.from('fotos_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('automacao_config').select('imagens_qtd_minima').maybeSingle(),
    ])
    setFotos(fotosData || [])
    if (automacaoConfig?.imagens_qtd_minima) setQtdMinima(automacaoConfig.imagens_qtd_minima)
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${userId}/${clienteId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('fotos-clientes').upload(path, file)
    if (!uploadError) {
      await supabase.from('fotos_clientes').insert([{ user_id: userId, cliente_id: clienteId, path, categoria, descricao: descricao || null }])
      const { data } = await supabase.from('fotos_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false })
      setFotos(data || [])
      setDescricao('')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(foto) {
    if (!confirm('Excluir esta foto?')) return
    await supabase.storage.from('fotos-clientes').remove([foto.path])
    await supabase.from('fotos_clientes').delete().eq('id', foto.id)
    setFotos(fotos.filter((f) => f.id !== foto.id))
  }

  if (loading) {
    return (
      <div className="card flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-night">Fotos do cliente</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {fotos.filter((f) => f.categoria === 'semanal' && new Date(f.created_at) >= startOfWeek()).length}/{qtdMinima} fotos semanais esta semana
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input-field max-w-[160px]">
            <option value="semanal">Semanal</option>
            <option value="visita_mensal">Visita mensal</option>
            <option value="post_publicado">Post publicado</option>
          </select>
          <input
            type="text"
            placeholder="Legenda (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input-field max-w-[220px]"
          />
          <label className="btn-primary flex items-center gap-2 text-sm cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar foto
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {fotos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma foto enviada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {fotos.map((foto) => (
            <div key={foto.id} className="relative group rounded-lg overflow-hidden border border-slate-200">
              <img src={fotoUrl(foto.path)} alt="" className="w-full h-32 object-cover" />
              <span className="absolute top-1.5 left-1.5 badge bg-white/90 text-slate-600">{categoriaFotoLabel(foto.categoria)}</span>
              <button
                onClick={() => handleDelete(foto)}
                className="absolute top-1.5 right-1.5 p-1 bg-white/90 rounded-lg text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {foto.descricao && (
                <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[11px] px-1.5 py-1 truncate">{foto.descricao}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
