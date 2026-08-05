import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  Eye,
  Phone,
  Navigation,
  MousePointerClick,
  Building2,
  LineChart as LineChartIcon,
  Star,
  Image as ImageIcon,
  FileText,
  Download,
  CalendarHeart,
  Megaphone,
  Sparkles,
  ExternalLink,
  GraduationCap,
  Gift,
  Upload,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import PortalLayout from '../components/PortalLayout'
import QrCodeAvaliacao from '../components/QrCodeAvaliacao'
import RelatorioCompleto from '../components/RelatorioCompleto'
import { supabase } from '../lib/supabase'
import { formatDate, formatDateTime } from '../lib/format'
import { categoriaFotoLabel } from '../lib/fotos'

function youtubeEmbedUrl(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

const INDICACAO_STATUS_META = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  contatado: { label: 'Contatado', className: 'bg-sky-100 text-sky-700' },
  convertido: { label: 'Convertido', className: 'bg-emerald-100 text-emerald-700' },
  descartado: { label: 'Descartado', className: 'bg-slate-100 text-slate-500' },
}

const TABS = [
  { value: 'geral', label: 'Visão geral', icon: Building2 },
  { value: 'metricas', label: 'Métricas GBP', icon: LineChartIcon },
  { value: 'avaliacoes', label: 'Avaliações', icon: Star },
  { value: 'fotos', label: 'Fotos', icon: ImageIcon },
  { value: 'relatorios', label: 'Relatórios', icon: FileText },
  { value: 'datas', label: 'Datas especiais', icon: CalendarHeart, gestaoOnly: true },
  { value: 'aprenda', label: 'Aprenda', icon: GraduationCap },
  { value: 'indique', label: 'Indique e ganhe', icon: Gift },
]

export default function Portal() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)
  const [activeTab, setActiveTab] = useState('geral')

  const [cliente, setCliente] = useState(null)
  const [metricas, setMetricas] = useState([])
  const [avaliacoes, setAvaliacoes] = useState([])
  const [fotos, setFotos] = useState([])
  const [relatorios, setRelatorios] = useState([])
  const [preview, setPreview] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [datasEspeciais, setDatasEspeciais] = useState([])
  const [datasRespostas, setDatasRespostas] = useState([])
  const [respostaForm, setRespostaForm] = useState({})
  const [enviandoResposta, setEnviandoResposta] = useState(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [descricaoUpload, setDescricaoUpload] = useState('')
  const [novidades, setNovidades] = useState([])
  const [upsells, setUpsells] = useState([])
  const [pilulas, setPilulas] = useState([])
  const [indicacoes, setIndicacoes] = useState([])
  const [novaIndicacao, setNovaIndicacao] = useState({ nome: '', whatsapp: '' })
  const [enviandoIndicacao, setEnviandoIndicacao] = useState(false)

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        router.replace('/login')
        return
      }
      setAccessToken(session.access_token)

      const { data: perfil } = await supabase.from('users').select('tipo, cliente_id').eq('id', user.id).maybeSingle()

      if (perfil?.tipo !== 'cliente') {
        router.replace('/dashboard')
        return
      }
      if (!perfil.cliente_id) {
        setSemAcesso(true)
        setLoading(false)
        return
      }

      const clienteId = perfil.cliente_id

      const [
        { data: clienteData },
        { data: metricasData },
        { data: avaliacoesData },
        { data: fotosData },
        { data: relatoriosData },
        { data: novidadesData },
        { data: upsellsData },
        { data: pilulasData },
      ] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', clienteId).single(),
        supabase.from('metricas_gbp').select('*').eq('cliente_id', clienteId).order('mes', { ascending: true }),
        supabase.from('avaliacoes').select('*').eq('cliente_id', clienteId).order('data_avaliacao', { ascending: false }),
        supabase.from('fotos_clientes').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
        supabase
          .from('relatorios')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('visivel_cliente', true)
          .order('created_at', { ascending: false }),
        supabase.from('novidades_google').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('upsells').select('*').eq('ativo', true).order('ordem', { ascending: true }),
        supabase.from('pilulas_conhecimento').select('*').order('ordem', { ascending: true }),
      ])

      setCliente(clienteData)
      setMetricas(metricasData || [])
      setAvaliacoes(avaliacoesData || [])
      setFotos(fotosData || [])
      setRelatorios(relatoriosData || [])
      setNovidades(novidadesData || [])
      setUpsells(upsellsData || [])
      setPilulas(pilulasData || [])

      if (clienteData?.plano_gestao) {
        const res = await fetch('/api/portal/datas-especiais', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const json = await res.json()
          setDatasEspeciais(json.datas || [])
          setDatasRespostas(json.respostas || [])
        }
      }

      const indicacoesRes = await fetch('/api/portal/indicacoes', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (indicacoesRes.ok) {
        const json = await indicacoesRes.json()
        setIndicacoes(json.indicacoes || [])
      }

      setLoading(false)
    }
    init()
  }, [router])

  function respostaDe(dataEspecialId) {
    return datasRespostas.find((r) => r.data_especial_id === dataEspecialId)
  }

  async function handleEnviarResposta(dataEspecialId, vaiFechar) {
    setEnviandoResposta(dataEspecialId)
    const horarioAlternativo = respostaForm[dataEspecialId]?.horario || ''
    const res = await fetch('/api/portal/datas-especiais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ dataEspecialId, vaiFechar, horarioAlternativo }),
    })
    if (res.ok) {
      const refreshed = await fetch('/api/portal/datas-especiais', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (refreshed.ok) {
        const json = await refreshed.json()
        setDatasEspeciais(json.datas || [])
        setDatasRespostas(json.respostas || [])
      }
    }
    setEnviandoResposta(null)
  }

  function fotoUrl(path) {
    return supabase.storage.from('fotos-clientes').getPublicUrl(path).data.publicUrl
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !cliente) return
    setUploadingFoto(true)
    const path = `${cliente.user_id}/${cliente.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('fotos-clientes').upload(path, file)
    if (!uploadError) {
      const res = await fetch('/api/portal/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ path, descricao: descricaoUpload }),
      })
      if (res.ok) {
        const { data } = await supabase.from('fotos_clientes').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false })
        setFotos(data || [])
        setDescricaoUpload('')
      }
    }
    setUploadingFoto(false)
    e.target.value = ''
  }

  async function handleEnviarIndicacao(e) {
    e.preventDefault()
    if (!novaIndicacao.nome.trim() || !novaIndicacao.whatsapp.trim()) return
    setEnviandoIndicacao(true)
    const res = await fetch('/api/portal/indicacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ nomeIndicado: novaIndicacao.nome, whatsappIndicado: novaIndicacao.whatsapp }),
    })
    if (res.ok) {
      setNovaIndicacao({ nome: '', whatsapp: '' })
      const refreshed = await fetch('/api/portal/indicacoes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (refreshed.ok) {
        const json = await refreshed.json()
        setIndicacoes(json.indicacoes || [])
      }
    }
    setEnviandoIndicacao(false)
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </PortalLayout>
    )
  }

  if (semAcesso) {
    return (
      <PortalLayout>
        <div className="card text-center py-10">
          <p className="text-sm text-slate-500">
            Sua conta ainda não está vinculada a nenhuma empresa. Fale com a APREV pra liberar seu
            acesso.
          </p>
        </div>
      </PortalLayout>
    )
  }

  const pendentesDatas = datasEspeciais.filter((d) => !respostaDe(d.id))
  const avaliacoesRecentes = avaliacoes.filter((a) => {
    if (!a.data_avaliacao) return false
    const dias = (Date.now() - new Date(`${a.data_avaliacao}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)
    return dias >= 0 && dias <= 14
  })
  const temAvisos = pendentesDatas.length > 0 || avaliacoesRecentes.length > 0

  const ultimaMetrica = metricas[metricas.length - 1]
  const trendData = metricas.map((m) => ({
    mes: m.mes.slice(5, 7) + '/' + m.mes.slice(2, 4),
    visualizacoes: m.visualizacoes,
    chamadas: m.chamadas,
  }))

  const metricCards = [
    { label: 'Visualizações', value: ultimaMetrica?.visualizacoes ?? 0, icon: Eye, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Chamadas', value: ultimaMetrica?.chamadas ?? 0, icon: Phone, color: 'bg-green-50 text-green-700' },
    { label: 'Solicitações de rota', value: ultimaMetrica?.rotas ?? 0, icon: Navigation, color: 'bg-sky-50 text-sky-700' },
    { label: 'Cliques no site', value: ultimaMetrica?.cliques_site ?? 0, icon: MousePointerClick, color: 'bg-purple-50 text-purple-700' },
  ]

  const tabsVisiveis = TABS.filter((t) => !t.gestaoOnly || cliente?.plano_gestao)

  return (
    <PortalLayout clienteNome={cliente?.nome} tabs={tabsVisiveis} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'geral' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-xl font-bold text-night">
              Olá, {cliente?.contato_nome || cliente?.nome}! 👋
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Aqui está um resumo do seu perfil no Google Maps.</p>
          </div>

          {temAvisos && (
            <div className="space-y-2.5">
              {pendentesDatas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveTab('datas')}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
                >
                  <CalendarHeart className="w-5 h-5 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-900">
                      Confirme se vai fechar em &ldquo;{d.nome}&rdquo; ({formatDate(d.data)})
                    </p>
                    <p className="text-xs text-amber-700">Toque para responder</p>
                  </div>
                </button>
              ))}
              {avaliacoesRecentes.length > 0 && (
                <button
                  onClick={() => setActiveTab('avaliacoes')}
                  className="flex w-full items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left transition-colors hover:bg-sky-100"
                >
                  <Star className="w-5 h-5 shrink-0 text-sky-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-sky-900">
                      {avaliacoesRecentes.length} avaliação{avaliacoesRecentes.length > 1 ? 'ões' : ''} nova{avaliacoesRecentes.length > 1 ? 's' : ''} no Google
                    </p>
                    <p className="text-xs text-sky-700">Toque para ver</p>
                  </div>
                </button>
              )}
            </div>
          )}

          {novidades.length > 0 && (
            <div className="card">
              <h2 className="font-display font-semibold text-night mb-3 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary-800" />
                Novidades do Google
              </h2>
              <ul className="space-y-3">
                {novidades.map((n) => (
                  <li key={n.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-slate-700">{n.titulo}</p>
                    <p className="text-sm text-slate-500">{n.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metricCards.map((m) => {
              const Icon = m.icon
              return (
                <div key={m.label} className="card flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${m.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xl font-display font-bold text-night">{m.value.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-slate-500">{m.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {ultimaMetrica && (
            <p className="text-xs text-slate-400">Referente a {ultimaMetrica.mes}</p>
          )}

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-4">Dados da empresa</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Nicho</dt>
                <dd className="text-slate-700 font-medium">{cliente?.nicho || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Cidade</dt>
                <dd className="text-slate-700 font-medium">{cliente?.cidade || '—'}</dd>
              </div>
              {cliente?.data_fim_contrato && (
                <div>
                  <dt className="text-xs text-slate-400">Fim do contrato</dt>
                  <dd className="text-slate-700 font-medium">{formatDate(cliente.data_fim_contrato)}</dd>
                </div>
              )}
            </dl>
          </div>

          <QrCodeAvaliacao link={cliente?.link_avaliacao} nomeArquivo={`qrcode-avaliacao-${cliente?.nome || 'cliente'}`} />

          {upsells.length > 0 && (
            <div className="space-y-3">
              {upsells.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className="w-5 h-5 shrink-0 text-secondary-700" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-secondary-900">{u.titulo}</p>
                      {u.descricao && <p className="text-xs text-secondary-700">{u.descricao}</p>}
                    </div>
                  </div>
                  {u.link && (
                    <a
                      href={u.link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-sm flex items-center gap-1.5 shrink-0"
                    >
                      Saiba mais
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'metricas' && (
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Histórico de métricas</h2>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
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
            <p className="text-sm text-slate-400">Ainda não há métricas suficientes para o gráfico.</p>
          )}

          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-3 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 font-medium">Views</th>
                  <th className="px-3 py-2 font-medium">Chamadas</th>
                  <th className="px-3 py-2 font-medium">Rotas</th>
                  <th className="px-3 py-2 font-medium">Cliques no site</th>
                </tr>
              </thead>
              <tbody>
                {[...metricas].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-600">{m.mes}</td>
                    <td className="px-3 py-2">{m.visualizacoes}</td>
                    <td className="px-3 py-2">{m.chamadas}</td>
                    <td className="px-3 py-2">{m.rotas}</td>
                    <td className="px-3 py-2">{m.cliques_site}</td>
                  </tr>
                ))}
                {metricas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      Nenhuma métrica registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'avaliacoes' && (
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Avaliações do Google</h2>
          <ul className="space-y-3">
            {avaliacoes.map((a) => (
              <li key={a.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <p className="text-sm font-medium text-slate-700">{a.autor}</p>
                  <span className="text-xs text-slate-400">{a.data_avaliacao}</span>
                </div>
                <div className="flex items-center gap-0.5 my-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < a.nota ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                {a.comentario && <p className="text-sm text-slate-600">{a.comentario}</p>}
                {a.resposta && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2">Resposta: {a.resposta}</p>
                )}
              </li>
            ))}
            {avaliacoes.length === 0 && <p className="text-sm text-slate-400">Nenhuma avaliação registrada ainda.</p>}
          </ul>
        </div>
      )}

      {activeTab === 'fotos' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-semibold text-night mb-1">Enviar fotos pro seu gestor</h2>
            <p className="text-xs text-slate-400 mb-4">
              Manda fotos do seu negócio aqui - seu gestor usa esse material pra criar posts e melhorar seu perfil.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Fachada nova, prato do dia..."
                  value={descricaoUpload}
                  onChange={(e) => setDescricaoUpload(e.target.value)}
                  className="input-field"
                />
              </div>
              <label className="btn-primary flex items-center gap-2 text-sm cursor-pointer">
                {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Enviar foto
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} disabled={uploadingFoto} />
              </label>
            </div>
          </div>

          {fotos.some((f) => f.categoria === 'post_publicado') && (
            <div className="card">
              <h2 className="font-display font-semibold text-night mb-4">Posts publicados no seu perfil</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {fotos
                  .filter((f) => f.categoria === 'post_publicado')
                  .map((foto) => (
                    <div key={foto.id} className="rounded-lg overflow-hidden border border-slate-200">
                      <a href={fotoUrl(foto.path)} target="_blank" rel="noreferrer" className="aspect-square block bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotoUrl(foto.path)} alt={foto.descricao || ''} className="w-full h-full object-cover" />
                      </a>
                      {foto.descricao && <p className="text-xs text-slate-500 p-2">{foto.descricao}</p>}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-4">Fotos</h2>
            {fotos.filter((f) => f.categoria !== 'post_publicado').length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma foto enviada ainda.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fotos
                  .filter((f) => f.categoria !== 'post_publicado')
                  .map((foto) => (
                    <a
                      key={foto.id}
                      href={fotoUrl(foto.path)}
                      target="_blank"
                      rel="noreferrer"
                      className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotoUrl(foto.path)} alt={foto.descricao || ''} className="w-full h-full object-cover" />
                      <span className="absolute top-1.5 left-1.5 badge bg-white/90 text-slate-600">
                        {categoriaFotoLabel(foto.categoria)}
                      </span>
                    </a>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-semibold text-night mb-4">Relatórios recebidos</h2>
            {relatorios.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum relatório ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {relatorios.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between">
                    <p className="text-sm text-slate-600">{formatDateTime(r.created_at)}</p>
                    <button onClick={() => setPreview(r.dados)} className="text-sm text-primary-800 hover:text-primary-900 font-medium">
                      Ver
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {preview && (
            <div className="card">
              <div className="flex items-center justify-between mb-4 no-print">
                <h2 className="font-display font-semibold text-night">Relatório completo</h2>
                <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-sm">
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </button>
              </div>
              <RelatorioCompleto preview={preview} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'datas' && (
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-1">Datas especiais</h2>
          <p className="text-xs text-slate-400 mb-4">
            Confirme se o seu negócio vai fechar ou funcionar normal nessas datas, pra mantermos o horário do seu
            perfil no Google sempre certo.
          </p>
          {datasEspeciais.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma data especial cadastrada no momento.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {datasEspeciais.map((d) => {
                const resposta = respostaDe(d.id)
                const enviando = enviandoResposta === d.id
                return (
                  <li key={d.id} className="py-4">
                    <p className="text-sm font-medium text-slate-700">{d.nome}</p>
                    <p className="text-xs text-slate-400 mb-2">{formatDate(d.data)}</p>

                    {resposta ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`badge ${resposta.vai_fechar ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          {resposta.vai_fechar ? 'Vamos fechar' : 'Vamos funcionar normal'}
                        </span>
                        {resposta.horario_alternativo && (
                          <span className="text-xs text-slate-500">{resposta.horario_alternativo}</span>
                        )}
                        <button
                          onClick={() =>
                            setDatasRespostas((prev) => prev.filter((r) => r.id !== resposta.id))
                          }
                          className="text-xs text-primary-800 hover:text-primary-900 font-medium ml-1"
                        >
                          Alterar resposta
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Horário alternativo (opcional)"
                          value={respostaForm[d.id]?.horario || ''}
                          onChange={(e) =>
                            setRespostaForm((prev) => ({ ...prev, [d.id]: { horario: e.target.value } }))
                          }
                          className="input-field flex-1 min-w-[200px] max-w-xs"
                        />
                        <button
                          disabled={enviando}
                          onClick={() => handleEnviarResposta(d.id, true)}
                          className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Vamos fechar
                        </button>
                        <button
                          disabled={enviando}
                          onClick={() => handleEnviarResposta(d.id, false)}
                          className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Vamos funcionar normal
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'aprenda' && (
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-1">Pílulas de conhecimento</h2>
          <p className="text-xs text-slate-400 mb-4">Vídeos curtos pra você entender melhor como funciona o Google e tirar mais proveito do seu perfil.</p>
          {pilulas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum vídeo disponível ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {pilulas.map((p) => (
                <div key={p.id}>
                  <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                    <iframe
                      src={youtubeEmbedUrl(p.video_url)}
                      title={p.titulo}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-2">{p.titulo}</p>
                  {p.descricao && <p className="text-xs text-slate-500">{p.descricao}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'indique' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-semibold text-night mb-1 flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary-800" />
              Indique e ganhe
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Conhece outro empresário que também precisa aparecer melhor no Google? Indique aqui - se ele fechar
              com a gente, você ganha um desconto na mensalidade.
            </p>
            <form onSubmit={handleEnviarIndicacao} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do indicado</label>
                <input
                  type="text"
                  required
                  value={novaIndicacao.nome}
                  onChange={(e) => setNovaIndicacao({ ...novaIndicacao, nome: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp do indicado</label>
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  value={novaIndicacao.whatsapp}
                  onChange={(e) => setNovaIndicacao({ ...novaIndicacao, whatsapp: e.target.value })}
                  className="input-field"
                />
              </div>
              <button type="submit" disabled={enviandoIndicacao} className="btn-primary flex items-center gap-2">
                {enviandoIndicacao && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar indicação
              </button>
            </form>
          </div>

          {indicacoes.length > 0 && (
            <div className="card">
              <h2 className="font-display font-semibold text-night mb-4">Suas indicações</h2>
              <ul className="divide-y divide-slate-100">
                {indicacoes.map((i) => (
                  <li key={i.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{i.nome_indicado}</p>
                      <p className="text-xs text-slate-400">{formatDate(i.created_at?.slice(0, 10))}</p>
                    </div>
                    <span className={`badge ${INDICACAO_STATUS_META[i.status]?.className || ''}`}>
                      {INDICACAO_STATUS_META[i.status]?.label || i.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  )
}
