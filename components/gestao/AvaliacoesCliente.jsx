import { useEffect, useState } from 'react'
import { Star, Reply, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { notificarClientes } from '../../lib/notificacoes'

const EMPTY_AVALIACAO = { autor: '', nota: '5', comentario: '', data_avaliacao: new Date().toISOString().slice(0, 10) }

export default function AvaliacoesCliente({ clienteId, userId, accessToken }) {
  const [loading, setLoading] = useState(true)
  const [avaliacoes, setAvaliacoes] = useState([])
  const [novaAvaliacao, setNovaAvaliacao] = useState(EMPTY_AVALIACAO)
  const [saving, setSaving] = useState(false)
  const [respostaDrafts, setRespostaDrafts] = useState({})

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('avaliacoes').select('*').eq('cliente_id', clienteId).order('data_avaliacao', { ascending: false })
    setAvaliacoes(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!novaAvaliacao.autor.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('avaliacoes')
      .insert([{ ...novaAvaliacao, nota: Number(novaAvaliacao.nota), cliente_id: clienteId, user_id: userId }])
      .select()
      .single()
    setSaving(false)
    if (data) {
      setAvaliacoes([data, ...avaliacoes])
      setNovaAvaliacao(EMPTY_AVALIACAO)
      notificarClientes(accessToken, {
        clienteIds: [clienteId],
        title: 'Nova avaliação recebida! ⭐',
        body: `${data.autor} avaliou seu perfil no Google (${data.nota} estrelas).`,
        url: '/portal',
      })
    }
  }

  async function handleResponder(avaliacaoId) {
    const texto = (respostaDrafts[avaliacaoId] || '').trim()
    if (!texto) return
    const respondidaEm = new Date().toISOString()
    const { error } = await supabase.from('avaliacoes').update({ resposta: texto, respondida_em: respondidaEm }).eq('id', avaliacaoId)
    if (!error) {
      setAvaliacoes(avaliacoes.map((a) => (a.id === avaliacaoId ? { ...a, resposta: texto, respondida_em: respondidaEm } : a)))
      setRespostaDrafts((prev) => {
        const next = { ...prev }
        delete next[avaliacaoId]
        return next
      })
    }
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
      <h2 className="font-display font-semibold text-night mb-4">Avaliações do Google</h2>
      <ul className="space-y-3 mb-6">
        {avaliacoes.map((a) => (
          <li key={a.id} className="border-b border-slate-100 pb-3 last:border-0">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-sm font-medium text-slate-700">{a.autor}</p>
              <span className="text-xs text-slate-400">{a.data_avaliacao}</span>
            </div>
            <div className="flex items-center gap-0.5 my-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < a.nota ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
              ))}
            </div>
            {a.comentario && <p className="text-sm text-slate-600">{a.comentario}</p>}

            {a.resposta ? (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 flex items-start gap-1.5">
                <Reply className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {a.resposta}
              </p>
            ) : (
              <div className="flex gap-2 mt-2">
                <input
                  value={respostaDrafts[a.id] || ''}
                  onChange={(e) => setRespostaDrafts({ ...respostaDrafts, [a.id]: e.target.value })}
                  placeholder="Responder avaliação..."
                  className="input-field flex-1 text-sm"
                />
                <button onClick={() => handleResponder(a.id)} className="btn-secondary text-sm flex-shrink-0">
                  Responder
                </button>
              </div>
            )}
          </li>
        ))}
        {avaliacoes.length === 0 && <p className="text-sm text-slate-400">Nenhuma avaliação registrada ainda.</p>}
      </ul>

      <form onSubmit={handleAdd} className="border-t border-slate-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <input
          placeholder="Nome de quem avaliou"
          value={novaAvaliacao.autor}
          onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, autor: e.target.value })}
          className="input-field col-span-2"
          required
        />
        <select value={novaAvaliacao.nota} onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, nota: e.target.value })} className="input-field">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} estrelas</option>
          ))}
        </select>
        <input
          type="date"
          value={novaAvaliacao.data_avaliacao}
          onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, data_avaliacao: e.target.value })}
          className="input-field"
        />
        <input
          placeholder="Comentário (opcional)"
          value={novaAvaliacao.comentario}
          onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, comentario: e.target.value })}
          className="input-field col-span-2 sm:col-span-3"
        />
        <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Adicionar
        </button>
      </form>
    </div>
  )
}
