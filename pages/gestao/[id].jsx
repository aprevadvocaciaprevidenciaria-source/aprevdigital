import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  LineChart as LineChartIcon,
  Calendar,
  CalendarClock,
  Star,
  Image as ImageIcon,
  Search as SearchIcon,
  ExternalLink,
  CalendarCheck,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import MetricasGbp from '../../components/gestao/MetricasGbp'
import PostsCalendario from '../../components/gestao/PostsCalendario'
import DatasEspeciais from '../../components/gestao/DatasEspeciais'
import AvaliacoesCliente from '../../components/gestao/AvaliacoesCliente'
import FotosCliente from '../../components/gestao/FotosCliente'
import BuscasCliente from '../../components/gestao/BuscasCliente'
import AgendamentoConfig from '../../components/gestao/AgendamentoConfig'

const TABS = [
  { value: 'metricas', label: 'Métricas GBP', icon: LineChartIcon },
  { value: 'posts', label: 'Posts', icon: Calendar },
  { value: 'datas', label: 'Datas especiais', icon: CalendarClock },
  { value: 'avaliacoes', label: 'Avaliações', icon: Star },
  { value: 'fotos', label: 'Fotos', icon: ImageIcon },
  { value: 'buscas', label: 'Buscas', icon: SearchIcon },
  { value: 'agendamento', label: 'Agendamento', icon: CalendarCheck },
]

export default function GestaoCliente() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [activeTab, setActiveTab] = useState('metricas')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      setAccessToken(sessionData.session.access_token)
      if (id) {
        const { data } = await supabase.from('clientes').select('id, nome, nicho, cidade, plano_gestao').eq('id', id).single()
        setCliente(data)
      }
      setLoading(false)
    }
    init()
  }, [id, router])

  if (loading || !cliente) {
    return (
      <Layout title="Gestão">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Gestão do cliente">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button onClick={() => router.push('/gestao')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Gestão
        </button>
        <Link href={`/clientes/${id}`} className="flex items-center gap-2 text-sm text-primary-800 font-medium hover:underline">
          Ver ficha completa do cliente
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <h1 className="font-display text-2xl font-bold text-night mb-1">{cliente.nome}</h1>
      <p className="text-sm text-slate-500 mb-6">{cliente.nicho || 'Sem nicho definido'} {cliente.cidade ? `· ${cliente.cidade}` : ''}</p>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active ? 'border-secondary-500 text-primary-800' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'metricas' && <MetricasGbp clienteId={id} />}
      {activeTab === 'posts' && <PostsCalendario clienteId={id} userId={userId} />}
      {activeTab === 'datas' && (
        <DatasEspeciais
          clienteId={id}
          userId={userId}
          cidadeCliente={cliente.cidade}
          planoGestao={!!cliente.plano_gestao}
          accessToken={accessToken}
        />
      )}
      {activeTab === 'avaliacoes' && <AvaliacoesCliente clienteId={id} userId={userId} accessToken={accessToken} />}
      {activeTab === 'fotos' && <FotosCliente clienteId={id} userId={userId} />}
      {activeTab === 'buscas' && <BuscasCliente clienteId={id} userId={userId} />}
      {activeTab === 'agendamento' && <AgendamentoConfig clienteId={id} />}
    </Layout>
  )
}
