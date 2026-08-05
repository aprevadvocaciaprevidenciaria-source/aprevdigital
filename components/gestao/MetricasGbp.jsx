import { useEffect, useState } from 'react'
import { Eye, Phone, Navigation, MousePointerClick, MessageSquare, Search as SearchIcon, Loader2 } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { supabase } from '../../lib/supabase'

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const EMPTY_METRICA = { mes: currentMonthStr(), visualizacoes: '', interacoes: '', chamadas: '', rotas: '', cliques_site: '', buscas: '' }
const PERIODOS_METRICAS = [
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
  { value: 0, label: 'Todo o período' },
]

export default function MetricasGbp({ clienteId }) {
  const [loading, setLoading] = useState(true)
  const [historico, setHistorico] = useState([])
  const [periodo, setPeriodo] = useState(6)
  const [novaMetrica, setNovaMetrica] = useState(EMPTY_METRICA)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('metricas_gbp').select('*').eq('cliente_id', clienteId).order('mes', { ascending: false })
    setHistorico(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      cliente_id: clienteId,
      mes: novaMetrica.mes,
      visualizacoes: Number(novaMetrica.visualizacoes) || 0,
      interacoes: Number(novaMetrica.interacoes) || 0,
      chamadas: Number(novaMetrica.chamadas) || 0,
      rotas: Number(novaMetrica.rotas) || 0,
      cliques_site: Number(novaMetrica.cliques_site) || 0,
      buscas: Number(novaMetrica.buscas) || 0,
      fonte: 'manual',
    }
    const { error } = await supabase.from('metricas_gbp').upsert(payload, { onConflict: 'cliente_id,mes' })
    setSaving(false)
    if (!error) {
      setNovaMetrica(EMPTY_METRICA)
      await load()
    }
  }

  if (loading) {
    return (
      <div className="card flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
      </div>
    )
  }

  const ultima = historico[0]
  const metricCards = [
    { label: 'Visualizações', value: ultima?.visualizacoes ?? 0, icon: Eye, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Interações', value: ultima?.interacoes ?? 0, icon: MessageSquare, color: 'bg-fuchsia-50 text-fuchsia-700' },
    { label: 'Chamadas', value: ultima?.chamadas ?? 0, icon: Phone, color: 'bg-green-50 text-green-700' },
    { label: 'Solicitações de rota', value: ultima?.rotas ?? 0, icon: Navigation, color: 'bg-sky-50 text-sky-700' },
    { label: 'Cliques no site', value: ultima?.cliques_site ?? 0, icon: MousePointerClick, color: 'bg-purple-50 text-purple-700' },
    { label: 'Buscas', value: ultima?.buscas ?? 0, icon: SearchIcon, color: 'bg-yellow-50 text-yellow-700' },
  ]

  const trendChartData = [...historico]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(periodo === 0 ? 0 : -periodo)
    .map((m) => ({
      mes: m.mes.slice(5, 7) + '/' + m.mes.slice(2, 4),
      visualizacoes: m.visualizacoes,
      chamadas: m.chamadas,
    }))

  return (
    <div className="card">
      <h2 className="font-display font-semibold text-night mb-1">Métricas do Google Business Profile</h2>
      <p className="text-xs text-slate-400 mb-4">{ultima ? `Referente a ${ultima.mes}` : 'Nenhum mês registrado ainda'}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {metricCards.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="text-center p-3 rounded-lg bg-slate-50">
              <div className={`inline-flex rounded-lg p-2 mb-2 ${m.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-xl font-bold text-night">{m.value}</p>
              <p className="text-xs text-slate-500">{m.label}</p>
            </div>
          )
        })}
      </div>

      <div className="border-t border-slate-100 pt-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            Histórico ({PERIODOS_METRICAS.find((p) => p.value === periodo)?.label.toLowerCase()})
          </h3>
          <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className="input-field sm:max-w-[180px]">
            {PERIODOS_METRICAS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {trendChartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visualizacoes" name="Visualizações" stroke="#16233F" strokeWidth={2} />
              <Line type="monotone" dataKey="chamadas" name="Chamadas" stroke="#16C79A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">Sem dados suficientes no período selecionado.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-700 mb-3">Lançar métricas de um mês</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <label className="col-span-2 sm:col-span-1">
            <span className="block text-xs text-slate-400 mb-1">Mês de referência</span>
            <input
              type="month"
              required
              value={novaMetrica.mes.slice(0, 7)}
              onChange={(e) => setNovaMetrica({ ...novaMetrica, mes: e.target.value ? `${e.target.value}-01` : '' })}
              className="input-field w-full"
            />
          </label>
          <input type="number" placeholder="Visualizações" value={novaMetrica.visualizacoes} onChange={(e) => setNovaMetrica({ ...novaMetrica, visualizacoes: e.target.value })} className="input-field" />
          <input type="number" placeholder="Interações" value={novaMetrica.interacoes} onChange={(e) => setNovaMetrica({ ...novaMetrica, interacoes: e.target.value })} className="input-field" />
          <input type="number" placeholder="Chamadas" value={novaMetrica.chamadas} onChange={(e) => setNovaMetrica({ ...novaMetrica, chamadas: e.target.value })} className="input-field" />
          <input type="number" placeholder="Rotas" value={novaMetrica.rotas} onChange={(e) => setNovaMetrica({ ...novaMetrica, rotas: e.target.value })} className="input-field" />
          <input type="number" placeholder="Cliques no site" value={novaMetrica.cliques_site} onChange={(e) => setNovaMetrica({ ...novaMetrica, cliques_site: e.target.value })} className="input-field" />
          <input type="number" placeholder="Buscas" value={novaMetrica.buscas} onChange={(e) => setNovaMetrica({ ...novaMetrica, buscas: e.target.value })} className="input-field" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar métricas do mês
        </button>
      </form>
    </div>
  )
}
