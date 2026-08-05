import { useEffect, useState } from 'react'
import { Plus, Loader2, Trash2, Search as SearchIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const EMPTY_FORM = { termo: '', mes: currentMonthStr(), observacao: '' }

function formatMes(mesStr) {
  const [ano, mes] = mesStr.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1]}/${ano}`
}

export default function BuscasCliente({ clienteId, userId }) {
  const [termos, setTermos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('termos_busca_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('mes', { ascending: false })
      .order('created_at', { ascending: false })
    setTermos(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.termo.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('termos_busca_cliente')
      .insert([{ cliente_id: clienteId, user_id: userId, termo: form.termo.trim(), mes: form.mes, observacao: form.observacao.trim() || null }])
      .select()
      .single()
    setSaving(false)
    if (data) {
      setTermos([data, ...termos])
      setForm({ ...EMPTY_FORM, mes: form.mes })
    }
  }

  async function handleDelete(id) {
    await supabase.from('termos_busca_cliente').delete().eq('id', id)
    setTermos(termos.filter((t) => t.id !== id))
  }

  const grupos = {}
  for (const t of termos) {
    grupos[t.mes] = grupos[t.mes] || []
    grupos[t.mes].push(t)
  }
  const meses = Object.keys(grupos).sort((a, b) => b.localeCompare(a))

  return (
    <div className="card">
      <h2 className="font-display font-semibold text-night mb-1">Termos de busca</h2>
      <p className="text-xs text-slate-400 mb-4">
        O Google não expõe posição de ranking via API oficial. Registre aqui, mês a mês, os termos de pesquisa que
        o próprio Perfil da Empresa mostra em "Como os clientes te encontram".
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-5 p-3 bg-slate-50 rounded-lg">
        <input
          placeholder="Termo de busca (ex: pizzaria perto de mim)"
          value={form.termo}
          onChange={(e) => setForm({ ...form, termo: e.target.value })}
          className="input-field flex-1 min-w-[200px]"
          required
        />
        <input
          type="month"
          value={form.mes.slice(0, 7)}
          onChange={(e) => setForm({ ...form, mes: e.target.value ? `${e.target.value}-01` : currentMonthStr() })}
          className="input-field"
        />
        <input
          placeholder="Observação (opcional)"
          value={form.observacao}
          onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          className="input-field flex-1 min-w-[160px]"
        />
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
        </div>
      ) : meses.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum termo registrado ainda.</p>
      ) : (
        <div className="space-y-4">
          {meses.map((mes) => (
            <div key={mes}>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{formatMes(mes)}</p>
              <div className="flex flex-wrap gap-2">
                {grupos[mes].map((t) => (
                  <span
                    key={t.id}
                    title={t.observacao || ''}
                    className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-800 text-sm px-3 py-1.5 rounded-full"
                  >
                    <SearchIcon className="w-3 h-3" />
                    {t.termo}
                    <button onClick={() => handleDelete(t.id)} className="text-primary-400 hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
