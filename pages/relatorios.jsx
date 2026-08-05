import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  Download,
  TrendingUp,
  Eye,
  Phone,
  Navigation,
  MousePointerClick,
  FileText,
  MessageCircle,
  Save,
  History,
  Search as SearchIcon,
} from 'lucide-react'
import Layout from '../components/Layout'
import RelatorioCompleto from '../components/RelatorioCompleto'
import { supabase } from '../lib/supabase'
import { exportCsv } from '../lib/csv'
import { formatDateTime } from '../lib/format'
import { buildTotaisMetricas } from '../lib/relatorio'
import { notificarClientes } from '../lib/notificacoes'

const PERIODOS = [
  { value: 1, label: 'Último mês' },
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
]

const PERIODOS_CLIENTE = [...PERIODOS, { value: 0, label: 'Todo o período' }]

function monthStr(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Relatorios() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('geral')

  // Aba geral
  const [periodo, setPeriodo] = useState(3)
  const [resumo, setResumo] = useState({ visualizacoes: 0, chamadas: 0, rotas: 0, cliquesSite: 0 })
  const [rankingClientes, setRankingClientes] = useState([])

  // Aba por cliente
  const [clientes, setClientes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState('')
  const [periodoCliente, setPeriodoCliente] = useState(6)
  const [gerando, setGerando] = useState(false)
  const [preview, setPreview] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState([])

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const { data: clientesData } = await supabase.from('clientes').select('id, nome, contato_whatsapp').order('nome')
      setClientes(clientesData || [])
      await loadRelatorio(periodo)
      await loadHistorico()
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!loading) loadRelatorio(periodo)
  }, [periodo])

  async function loadRelatorio(meses) {
    const desde = new Date()
    desde.setDate(1)
    desde.setMonth(desde.getMonth() - (meses - 1))
    const desdeStr = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-01`

    const { data: metricas } = await supabase
      .from('metricas_gbp')
      .select('cliente_id, visualizacoes, chamadas, rotas, cliques_site, clientes(nome)')
      .gte('mes', desdeStr)

    const visualizacoes = metricas?.reduce((s, m) => s + (m.visualizacoes || 0), 0) || 0
    const chamadas = metricas?.reduce((s, m) => s + (m.chamadas || 0), 0) || 0
    const rotas = metricas?.reduce((s, m) => s + (m.rotas || 0), 0) || 0
    const cliquesSite = metricas?.reduce((s, m) => s + (m.cliques_site || 0), 0) || 0

    setResumo({ visualizacoes, chamadas, rotas, cliquesSite })

    const porCliente = {}
    metricas?.forEach((m) => {
      const nome = m.clientes?.nome || 'Cliente removido'
      if (!porCliente[nome]) porCliente[nome] = { nome, visualizacoes: 0, chamadas: 0 }
      porCliente[nome].visualizacoes += m.visualizacoes || 0
      porCliente[nome].chamadas += m.chamadas || 0
    })
    const ranking = Object.values(porCliente).sort((a, b) => b.visualizacoes - a.visualizacoes).slice(0, 8)
    setRankingClientes(ranking)
  }

  async function loadHistorico() {
    const { data } = await supabase
      .from('relatorios')
      .select('*, clientes(nome)')
      .order('created_at', { ascending: false })
      .limit(15)
    setHistorico(data || [])
  }

  function handleExportCsv() {
    exportCsv(
      `relatorio-gbp-${periodo}meses.csv`,
      ['Cliente', 'Visualizacoes', 'Chamadas'],
      rankingClientes.map((r) => [r.nome, r.visualizacoes, r.chamadas])
    )
  }

  async function handleGerarRelatorio() {
    if (!clienteSelecionado) return
    setGerando(true)

    let queryMetricas = supabase.from('metricas_gbp').select('*').eq('cliente_id', clienteSelecionado).order('mes', { ascending: true })
    let queryAvaliacoes = supabase
      .from('avaliacoes')
      .select('*')
      .eq('cliente_id', clienteSelecionado)
      .order('data_avaliacao', { ascending: true })
    if (periodoCliente > 0) {
      const desde = monthStr(periodoCliente - 1)
      queryMetricas = queryMetricas.gte('mes', desde)
      queryAvaliacoes = queryAvaliacoes.gte('data_avaliacao', desde)
    }
    const [{ data: cliente }, { data: metricas }, { data: avaliacoes }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteSelecionado).single(),
      queryMetricas,
      queryAvaliacoes,
    ])

    const totais = buildTotaisMetricas(metricas)

    setPreview({
      cliente,
      metricas: metricas || [],
      avaliacoes: avaliacoes || [],
      totais,
      geradoEm: new Date().toISOString(),
    })
    setGerando(false)
  }

  async function handleSalvarHistorico() {
    if (!preview) return
    setSalvando(true)
    const { data: sessionData } = await supabase.auth.getSession()
    // Salva como rascunho (visivel_cliente: false) de propósito - só fica
    // visível pro cliente quando você clicar em "Publicar pro cliente" no
    // histórico abaixo. Assim dá pra gerar/testar várias vezes sem o
    // cliente ver cada tentativa.
    await supabase.from('relatorios').insert([
      {
        user_id: sessionData.session.user.id,
        cliente_id: preview.cliente.id,
        tipo: 'cliente',
        mes: monthStr(0),
        dados: preview,
        status: 'gerado',
        visivel_cliente: false,
      },
    ])
    setSalvando(false)
    await loadHistorico()
  }

  async function handlePublicar(item) {
    const novoValor = !item.visivel_cliente
    await supabase.from('relatorios').update({ visivel_cliente: novoValor }).eq('id', item.id)
    await loadHistorico()
    if (novoValor) {
      const { data: sessionData } = await supabase.auth.getSession()
      notificarClientes(sessionData.session.access_token, {
        clienteIds: [item.cliente_id],
        title: 'Novo relatório disponível 📄',
        body: 'Seu relatório já está disponível no portal.',
        url: '/portal',
      })
    }
  }

  function handleBaixarPdf() {
    window.print()
  }

  function handleEnviarWhatsapp() {
    if (!preview) return
    const digits = (preview.cliente.contato_whatsapp || '').replace(/\D/g, '')
    const texto = encodeURIComponent(
      `Relatório GBP - ${preview.cliente.nome}\n` +
        `Período: últimos ${preview.metricas.length} meses\n` +
        `Visualizações: ${preview.totais.visualizacoes}\n` +
        `Chamadas: ${preview.totais.chamadas}\n` +
        `Solicitações de rota: ${preview.totais.rotas}\n` +
        `Cliques no site: ${preview.totais.cliques_site}`
    )
    const url = digits ? `https://wa.me/${digits}?text=${texto}` : `https://wa.me/?text=${texto}`
    window.open(url, '_blank')
  }

  function abrirHistorico(item) {
    if (!item.dados) return
    setTab('cliente')
    setClienteSelecionado(item.cliente_id)
    setPreview(item.dados)
  }

  const maxVisualizacoes = Math.max(...rankingClientes.map((r) => r.visualizacoes), 1)

  const cards = [
    { label: 'Visualizações', value: resumo.visualizacoes.toLocaleString('pt-BR'), icon: Eye, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Chamadas', value: resumo.chamadas.toLocaleString('pt-BR'), icon: Phone, color: 'bg-green-50 text-green-700' },
    { label: 'Solicitações de rota', value: resumo.rotas.toLocaleString('pt-BR'), icon: Navigation, color: 'bg-sky-50 text-sky-700' },
    { label: 'Cliques no site', value: resumo.cliquesSite.toLocaleString('pt-BR'), icon: MousePointerClick, color: 'bg-purple-50 text-purple-700' },
  ]

  if (loading) {
    return (
      <Layout title="Relatórios">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Relatórios">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-6 no-print">
        <button
          onClick={() => setTab('geral')}
          className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === 'geral' ? 'border-secondary-500 text-primary-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Geral
        </button>
        <button
          onClick={() => setTab('cliente')}
          className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === 'cliente' ? 'border-secondary-500 text-primary-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Por cliente
        </button>
      </div>

      {tab === 'geral' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-slate-700">
              <TrendingUp className="w-5 h-5 text-primary-800" />
              <h2 className="font-medium">Desempenho do Google Business Profile</h2>
            </div>
            <div className="flex gap-3">
              <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} className="input-field sm:max-w-[180px]">
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <div key={c.label} className="card flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${c.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold text-night">{c.value}</p>
                    <p className="text-sm text-slate-500">{c.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-4">Ranking de clientes por visualizações</h2>
            {rankingClientes.length === 0 ? (
              <p className="text-sm text-slate-400">Sem dados no período selecionado.</p>
            ) : (
              <div className="space-y-3">
                {rankingClientes.map((r) => (
                  <div key={r.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{r.nome}</span>
                      <span className="text-slate-500">
                        {r.visualizacoes.toLocaleString('pt-BR')} visualizações · {r.chamadas.toLocaleString('pt-BR')} chamadas
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-primary-800 h-2 rounded-full"
                        style={{ width: `${(r.visualizacoes / maxVisualizacoes) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'cliente' && (
        <>
          <div className="card mb-6 no-print">
            <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-800" />
              Gerar relatório de cliente
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={clienteSelecionado} onChange={(e) => setClienteSelecionado(e.target.value)} className="input-field flex-1">
                <option value="">Selecione um cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <select value={periodoCliente} onChange={(e) => setPeriodoCliente(Number(e.target.value))} className="input-field sm:max-w-[180px]">
                {PERIODOS_CLIENTE.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={handleGerarRelatorio}
                disabled={!clienteSelecionado || gerando}
                className="btn-primary flex items-center gap-2 justify-center"
              >
                {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
                Gerar relatório
              </button>
            </div>
          </div>

          {preview && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4 no-print flex-wrap gap-2">
                <h2 className="font-display font-semibold text-night">Preview do relatório</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleBaixarPdf} className="btn-secondary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Baixar PDF
                  </button>
                  <button onClick={handleEnviarWhatsapp} className="btn-secondary flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Enviar via WhatsApp
                  </button>
                  <button onClick={handleSalvarHistorico} disabled={salvando} className="btn-primary flex items-center gap-2">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar no histórico
                  </button>
                </div>
              </div>

              <RelatorioCompleto preview={preview} />
            </div>
          )}

          <div className="card no-print">
            <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-800" />
              Histórico de relatórios gerados
            </h2>
            {historico.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum relatório salvo ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {historico.map((h) => (
                  <li key={h.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{h.clientes?.nome || 'Cliente removido'}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(h.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handlePublicar(h)}
                        className={`badge cursor-pointer ${h.visivel_cliente ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        title={h.visivel_cliente ? 'Clique pra ocultar do cliente' : 'Clique pra publicar pro cliente'}
                      >
                        {h.visivel_cliente ? 'Publicado' : 'Rascunho'}
                      </button>
                      <button onClick={() => abrirHistorico(h)} className="text-sm text-primary-800 hover:text-primary-900 font-medium">
                        Ver
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
