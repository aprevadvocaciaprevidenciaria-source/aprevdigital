import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  Users,
  Eye,
  EyeOff,
  Phone,
  Navigation,
  MousePointerClick,
  CheckSquare,
  Loader2,
  ArrowRight,
  Clock,
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { STATUS_META, statusMeta } from '../lib/status'

const PRIORIDADE_COLORS = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-slate-100 text-slate-600',
}

function monthStr(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function pct(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

const PERIODOS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: 'total', label: 'Total' },
]

// Meses (YYYY-MM-01) que entram no período selecionado, terminando no mês
// atual. "total" pega todo mês que tiver alguma métrica lançada.
function mesesDoPeriodo(periodo, metricasRaw) {
  if (periodo === 'total') {
    return Array.from(new Set(metricasRaw.map((m) => m.mes))).sort()
  }
  const n = Number(periodo)
  return Array.from({ length: n }, (_, i) => monthStr(n - 1 - i))
}

// Mesma quantidade de meses, mas imediatamente antes do período selecionado -
// usado só pra calcular o "vs. período anterior". Não existe período anterior
// comparável pra "Total".
function mesesAnteriores(periodo) {
  if (periodo === 'total') return []
  const n = Number(periodo)
  return Array.from({ length: n }, (_, i) => monthStr(2 * n - 1 - i))
}

function sumField(rows, field) {
  return rows.reduce((s, m) => s + (m[field] || 0), 0)
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClientes: 0,
    tarefasPendentes: 0,
    tarefasVencidas: 0,
    receitaMes: 0,
  })
  const [metricasRaw, setMetricasRaw] = useState([])
  const [periodo, setPeriodo] = useState('1')
  const [clientesRecentes, setClientesRecentes] = useState([])
  const [tarefasProximas, setTarefasProximas] = useState([])
  const [trendData, setTrendData] = useState([])
  const [nichoData, setNichoData] = useState([])
  const [statusData, setStatusData] = useState([])
  const [valoresOcultos, setValoresOcultos] = useState(false)

  const { insights, deltas } = useMemo(() => {
    const meses = mesesDoPeriodo(periodo, metricasRaw)
    const anteriores = mesesAnteriores(periodo)
    const mesesSet = new Set(meses)
    const anterioresSet = new Set(anteriores)
    const atual = metricasRaw.filter((m) => mesesSet.has(m.mes))
    const anterior = metricasRaw.filter((m) => anterioresSet.has(m.mes))

    const visualizacoes = sumField(atual, 'visualizacoes')
    const chamadas = sumField(atual, 'chamadas')
    const rotas = sumField(atual, 'rotas')
    const cliquesSite = sumField(atual, 'cliques_site')

    return {
      insights: { visualizacoes, chamadas, rotas, cliquesSite },
      deltas: {
        visualizacoes: pct(visualizacoes, sumField(anterior, 'visualizacoes')),
        chamadas: pct(chamadas, sumField(anterior, 'chamadas')),
        rotas: pct(rotas, sumField(anterior, 'rotas')),
        cliquesSite: pct(cliquesSite, sumField(anterior, 'cliques_site')),
      },
    }
  }, [metricasRaw, periodo])

  useEffect(() => {
    setValoresOcultos(localStorage.getItem('dashboard-valores-ocultos') === '1')
  }, [])

  function toggleValoresOcultos() {
    const novo = !valoresOcultos
    setValoresOcultos(novo)
    localStorage.setItem('dashboard-valores-ocultos', novo ? '1' : '0')
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      await loadDashboard()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadDashboard() {
    const hoje = new Date().toISOString().slice(0, 10)

    const [
      { count: totalClientes },
      { data: tarefasPendentesData },
      { data: tarefasVencidasData },
      { data: metricasTodas },
      { data: clientes },
      { data: tarefas },
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase.from('tarefas').select('id').neq('status', 'concluida'),
      supabase.from('tarefas').select('id').neq('status', 'concluida').lt('vencimento', hoje),
      supabase.from('metricas_gbp').select('mes, visualizacoes, interacoes, chamadas, rotas, cliques_site'),
      supabase.from('clientes').select('id, nome, status, nicho, plano_valor, created_at').order('created_at', { ascending: false }),
      supabase
        .from('tarefas')
        .select('id, titulo, prioridade, status, vencimento, clientes(nome)')
        .neq('status', 'concluida')
        .order('vencimento', { ascending: true })
        .limit(5),
    ])

    setMetricasRaw(metricasTodas || [])

    const receitaMes = (clientes || [])
      .filter((c) => c.status === 'ativo')
      .reduce((s, c) => s + (Number(c.plano_valor) || 0), 0)

    setStats({
      totalClientes: totalClientes || 0,
      tarefasPendentes: tarefasPendentesData?.length || 0,
      tarefasVencidas: tarefasVencidasData?.length || 0,
      receitaMes,
    })
    setClientesRecentes((clientes || []).slice(0, 5))
    setTarefasProximas(tarefas || [])

    // Gráfico de tendência: visualizações totais por mês, últimos 6 meses
    // (fixo, independente do seletor de período dos cards de insight)
    const doMes = (mes) => (metricasTodas || []).filter((m) => m.mes === mes)
    const meses = Array.from({ length: 6 }, (_, i) => monthStr(5 - i))
    setTrendData(
      meses.map((mes) => ({
        mes: mes.slice(5, 7) + '/' + mes.slice(2, 4),
        visualizacoes: sumField(doMes(mes), 'visualizacoes'),
      }))
    )

    // Clientes por nicho
    const porNicho = {}
    ;(clientes || []).forEach((c) => {
      const nicho = c.nicho?.trim() || 'Sem nicho'
      porNicho[nicho] = (porNicho[nicho] || 0) + 1
    })
    setNichoData(
      Object.entries(porNicho)
        .map(([nicho, total]) => ({ nicho, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 7)
    )

    // Status dos clientes
    const porStatus = {}
    ;(clientes || []).forEach((c) => {
      porStatus[c.status] = (porStatus[c.status] || 0) + 1
    })
    setStatusData(
      STATUS_META.map((s) => ({ name: s.label, value: porStatus[s.value] || 0, hex: s.hex })).filter((s) => s.value > 0)
    )
  }

  const snapshotCards = [
    { label: 'Clientes cadastrados', value: stats.totalClientes, icon: Users, color: 'bg-primary-50 text-primary-800', sensivel: true },
    {
      label: 'Receita do mês (MRR)',
      value: formatCurrency(stats.receitaMes),
      icon: Wallet,
      color: 'bg-secondary-50 text-secondary-700',
      sensivel: true,
    },
    { label: 'Tarefas pendentes', value: stats.tarefasPendentes, icon: CheckSquare, color: 'bg-amber-50 text-amber-700' },
    {
      label: 'Tarefas vencidas',
      value: stats.tarefasVencidas,
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-700',
      highlight: stats.tarefasVencidas > 0,
    },
  ]

  const deltaLabel = periodo === '1' ? 'vs. mês anterior' : periodo === 'total' ? '' : 'vs. período anterior'

  const insightCards = [
    {
      label: 'Visualizações GBP',
      value: insights.visualizacoes.toLocaleString('pt-BR'),
      icon: Eye,
      color: 'bg-indigo-50 text-indigo-700',
      delta: deltas.visualizacoes,
    },
    {
      label: 'Chamadas recebidas',
      value: insights.chamadas.toLocaleString('pt-BR'),
      icon: Phone,
      color: 'bg-green-50 text-green-700',
      delta: deltas.chamadas,
    },
    {
      label: 'Solicitações de rota',
      value: insights.rotas.toLocaleString('pt-BR'),
      icon: Navigation,
      color: 'bg-sky-50 text-sky-700',
      delta: deltas.rotas,
    },
    {
      label: 'Cliques no site',
      value: insights.cliquesSite.toLocaleString('pt-BR'),
      icon: MousePointerClick,
      color: 'bg-purple-50 text-purple-700',
      delta: deltas.cliquesSite,
    },
  ]

  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Dashboard">
      <div className="flex justify-end mb-4">
        <button
          onClick={toggleValoresOcultos}
          className="btn-secondary flex items-center gap-2 text-sm"
          title={valoresOcultos ? 'Mostrar valores sensíveis' : 'Ocultar valores sensíveis'}
        >
          {valoresOcultos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {valoresOcultos ? 'Valores ocultos' : 'Ocultar valores'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {snapshotCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`card flex items-center gap-4 ${c.highlight ? 'border-red-200' : ''}`}>
              <div className={`rounded-lg p-3 ${c.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-display font-bold text-night">{c.sensivel && valoresOcultos ? '•••' : c.value}</p>
                <p className="text-sm text-slate-500">{c.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-night">Insights do Google Business Profile</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                periodo === p.value ? 'bg-white text-primary-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {insightCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="card flex items-center gap-4">
              <div className={`rounded-lg p-3 ${c.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-display font-bold text-night">{c.value}</p>
                <p className="text-sm text-slate-500">{c.label}</p>
                {typeof c.delta === 'number' && deltaLabel && (
                  <p className={`text-xs flex items-center gap-1 mt-0.5 ${c.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {c.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(c.delta).toFixed(1)}% {deltaLabel}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card lg:col-span-2">
          <h2 className="font-display font-semibold text-night mb-4">Tendência de visualizações (6 meses)</h2>
          {trendData.every((d) => d.visualizacoes === 0) ? (
            <p className="text-sm text-slate-400">Sem dados de métricas ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="visGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16C79A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#16C79A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => v.toLocaleString('pt-BR')} />
                <Area type="monotone" dataKey="visualizacoes" stroke="#16C79A" strokeWidth={2} fill="url(#visGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Status dos clientes</h2>
          {statusData.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {statusData.map((s) => (
                    <Cell key={s.name} fill={s.hex} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.hex }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4">Clientes por nicho</h2>
        {nichoData.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={nichoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
              <XAxis dataKey="nicho" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#16233F" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-night">Últimos clientes adicionados</h2>
            <Link href="/clientes" className="text-sm text-primary-800 hover:text-primary-900 flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {clientesRecentes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {clientesRecentes.map((c) => {
                const meta = statusMeta(c.status)
                return (
                  <li key={c.id} className="py-3">
                    <Link href={`/clientes/${c.id}`} className="flex items-center justify-between group">
                      <span className="text-sm font-medium text-slate-700 group-hover:text-primary-800">{c.nome}</span>
                      <span className={`badge ${meta.badge}`}>
                        <span className={`badge-dot ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-night">Tarefas próximas</h2>
            <Link href="/tarefas" className="text-sm text-primary-800 hover:text-primary-900 flex items-center gap-1">
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {tarefasProximas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma tarefa pendente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tarefasProximas.map((t) => {
                const vencida = t.vencimento && t.vencimento < new Date().toISOString().slice(0, 10)
                return (
                  <li key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{t.titulo}</p>
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${vencida ? 'text-red-500' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" />
                        {t.vencimento || 'sem prazo'} · {t.clientes?.nome || 'sem cliente'}
                      </p>
                    </div>
                    <span className={`badge ${PRIORIDADE_COLORS[t.prioridade] || PRIORIDADE_COLORS.baixa}`}>
                      {t.prioridade}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
