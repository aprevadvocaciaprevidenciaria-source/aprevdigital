import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  AlertTriangle,
  Target,
  MessageCircle,
  Clock,
  Download,
  Users,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { exportCsv } from '../lib/csv'
import { formatDate, formatDateTime } from '../lib/format'

const LEAD_STATUS_META = {
  novo: { label: 'Novo', badge: 'bg-sky-100 text-sky-700' },
  contatado: { label: 'Contatado', badge: 'bg-amber-100 text-amber-700' },
  qualificado: { label: 'Qualificado', badge: 'bg-purple-100 text-purple-700' },
  convertido: { label: 'Convertido', badge: 'bg-emerald-100 text-emerald-700' },
  perdido: { label: 'Perdido', badge: 'bg-slate-100 text-slate-500' },
}

const CONVERSA_STATUS_ORDER = ['aberta', 'aguardando_resposta', 'resolvida', 'perdida']

const DIAS_PARADA_ALERTA = 3

function diasEntre(dataStr) {
  if (!dataStr) return null
  const diff = Date.now() - new Date(dataStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function Relatorios() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState([])
  const [leads, setLeads] = useState([])
  const [conversas, setConversas] = useState([])
  const [colaboradores, setColaboradores] = useState([])

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      await carregarDados()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregarDados() {
    const hoje = new Date().toISOString().slice(0, 10)
    const [{ data: tarefasData }, { data: leadsData }, { data: conversasData }, { data: colaboradoresData }] = await Promise.all([
      supabase
        .from('tarefas')
        .select('id, titulo, vencimento, prioridade, colaborador_id, clientes(nome), colaboradores(nome)')
        .neq('status', 'concluida')
        .lt('vencimento', hoje)
        .order('vencimento', { ascending: true }),
      supabase.from('leads').select('id, status'),
      supabase
        .from('conversas_whatsapp')
        .select('id, nome_contato, telefone, status, ultima_mensagem_em, colaborador_id, colaboradores(nome)')
        .order('ultima_mensagem_em', { ascending: true }),
      supabase.from('colaboradores').select('id, nome, papel'),
    ])
    setTarefasAtrasadas(tarefasData || [])
    setLeads(leadsData || [])
    setConversas(conversasData || [])
    setColaboradores(colaboradoresData || [])
  }

  const leadsPorStatus = useMemo(() => {
    const contagem = {}
    leads.forEach((l) => {
      contagem[l.status] = (contagem[l.status] || 0) + 1
    })
    return contagem
  }, [leads])

  const leadsEmAberto = leads.filter((l) => !['convertido', 'perdido'].includes(l.status)).length
  const taxaConversao = leads.length > 0 ? ((leadsPorStatus.convertido || 0) / leads.length) * 100 : 0

  const conversasAguardando = conversas.filter((c) => c.status === 'aguardando_resposta')
  const conversasParadas = conversasAguardando
    .map((c) => ({ ...c, diasParado: diasEntre(c.ultima_mensagem_em) }))
    .filter((c) => c.diasParado !== null && c.diasParado >= DIAS_PARADA_ALERTA)
    .sort((a, b) => b.diasParado - a.diasParado)

  const conversasPorStatus = useMemo(() => {
    const contagem = {}
    conversas.forEach((c) => {
      contagem[c.status] = (contagem[c.status] || 0) + 1
    })
    return contagem
  }, [conversas])

  const porResponsavel = useMemo(() => {
    const mapa = new Map()
    colaboradores.forEach((c) => mapa.set(c.id, { nome: c.nome, papel: c.papel, tarefasAtrasadas: 0, conversasAguardando: 0 }))
    mapa.set('sem-responsavel', { nome: 'Sem responsável definido', papel: '', tarefasAtrasadas: 0, conversasAguardando: 0 })

    tarefasAtrasadas.forEach((t) => {
      const key = t.colaborador_id || 'sem-responsavel'
      if (!mapa.has(key)) mapa.set(key, { nome: t.colaboradores?.nome || 'Sem responsável definido', papel: '', tarefasAtrasadas: 0, conversasAguardando: 0 })
      mapa.get(key).tarefasAtrasadas += 1
    })
    conversasAguardando.forEach((c) => {
      const key = c.colaborador_id || 'sem-responsavel'
      if (!mapa.has(key)) mapa.set(key, { nome: c.colaboradores?.nome || 'Sem responsável definido', papel: '', tarefasAtrasadas: 0, conversasAguardando: 0 })
      mapa.get(key).conversasAguardando += 1
    })

    return Array.from(mapa.values()).filter((r) => r.tarefasAtrasadas > 0 || r.conversasAguardando > 0 || r.papel === 'socio' || r.papel === 'secretaria')
  }, [colaboradores, tarefasAtrasadas, conversasAguardando])

  function handleExport() {
    exportCsv(
      `relatorio-acompanhamento-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Responsável', 'Tarefas atrasadas', 'Conversas aguardando resposta'],
      porResponsavel.map((r) => [r.nome, r.tarefasAtrasadas, r.conversasAguardando])
    )
  }

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
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <p className="text-sm text-slate-500 max-w-2xl">
          Visão de acompanhamento da equipe: mostra se leads e conversas estão sendo respondidos no prazo, pra você
          conseguir prestar contas sem precisar acompanhar caso a caso.
        </p>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm shrink-0">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className={`card flex items-center gap-4 ${tarefasAtrasadas.length > 0 ? 'border-red-200' : ''}`}>
          <div className="rounded-lg p-3 bg-red-50 text-red-700">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-night">{tarefasAtrasadas.length}</p>
            <p className="text-sm text-slate-500">Tarefas atrasadas</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-lg p-3 bg-sky-50 text-sky-700">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-night">{leadsEmAberto}</p>
            <p className="text-sm text-slate-500">Leads em aberto</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-lg p-3 bg-amber-50 text-amber-700">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-night">{conversasAguardando.length}</p>
            <p className="text-sm text-slate-500">Conversas aguardando resposta</p>
          </div>
        </div>
        <div className={`card flex items-center gap-4 ${conversasParadas.length > 0 ? 'border-red-200' : ''}`}>
          <div className="rounded-lg p-3 bg-red-50 text-red-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-night">{conversasParadas.length}</p>
            <p className="text-sm text-slate-500">Paradas há {DIAS_PARADA_ALERTA}+ dias</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Funil de leads</h2>
          <ul className="space-y-2">
            {Object.entries(LEAD_STATUS_META).map(([value, meta]) => (
              <li key={value} className="flex items-center justify-between text-sm">
                <span className={`badge ${meta.badge}`}>{meta.label}</span>
                <span className="font-medium text-slate-700">{leadsPorStatus[value] || 0}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-4">
            Taxa de conversão: <strong className="text-slate-600">{taxaConversao.toFixed(1)}%</strong> ({leadsPorStatus.convertido || 0} de{' '}
            {leads.length} leads)
          </p>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Conversas WhatsApp</h2>
          <ul className="space-y-2">
            {CONVERSA_STATUS_ORDER.map((value) => (
              <li key={value} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 capitalize">{value.replace('_', ' ')}</span>
                <span className="font-medium text-slate-700">{conversasPorStatus[value] || 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> Por responsável
        </h2>
        {porResponsavel.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum colaborador cadastrado ainda, ou está tudo em dia.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2 font-medium">Responsável</th>
                <th className="px-4 py-2 font-medium">Tarefas atrasadas</th>
                <th className="px-4 py-2 font-medium">Conversas aguardando resposta</th>
              </tr>
            </thead>
            <tbody>
              {porResponsavel.map((r) => (
                <tr key={r.nome} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.nome} {r.papel === 'socio' && <span className="text-xs text-slate-400">(sócio)</span>}
                  </td>
                  <td className={`px-4 py-2.5 ${r.tarefasAtrasadas > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {r.tarefasAtrasadas}
                  </td>
                  <td className={`px-4 py-2.5 ${r.conversasAguardando > 0 ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
                    {r.conversasAguardando}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Tarefas atrasadas</h2>
          {tarefasAtrasadas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma tarefa atrasada. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {tarefasAtrasadas.map((t) => (
                <li key={t.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                  <p className="font-medium text-slate-700">{t.titulo}</p>
                  <p className="text-xs text-slate-400">
                    {t.clientes?.nome || 'Sem caso vinculado'} · venceu em {formatDate(t.vencimento)} ·{' '}
                    {t.colaboradores?.nome || 'sem responsável'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Conversas sem resposta há mais tempo</h2>
          {conversasParadas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma conversa parada há {DIAS_PARADA_ALERTA}+ dias. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {conversasParadas.map((c) => (
                <li key={c.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                  <p className="font-medium text-slate-700">{c.nome_contato || c.telefone}</p>
                  <p className="text-xs text-slate-400">
                    parada há {c.diasParado} dia{c.diasParado !== 1 ? 's' : ''} · última mensagem em{' '}
                    {formatDateTime(c.ultima_mensagem_em)} · {c.colaboradores?.nome || 'sem responsável'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
