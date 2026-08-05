import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  Save,
  FileText,
  Wallet,
  Camera,
  Check,
  X,
  Clock,
  History,
  AlertTriangle,
  Target,
  ClipboardList,
  Plus,
  Trash2,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { applyTemplate } from '../lib/templates'
import { formatDateTime } from '../lib/format'

const DIAS_SEMANA = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

const PRIORIDADE_OPTIONS = ['baixa', 'media', 'alta']

const PERIODICIDADE_LABELS = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

const EMPTY_TEMPLATE = {
  titulo: '',
  descricao: '',
  prioridade: 'media',
  periodicidade: 'semanal',
  dias_semana: [1],
  dia_mes: 1,
}

const TIPO_LABELS = {
  cobranca: 'Cobrança',
  relatorio_mensal: 'Relatório mensal',
  solicitacao_imagens: 'Solicitação de fotos',
  lead_followup: 'Follow-up de lead',
}

const STATUS_BADGE = {
  pendente: 'bg-amber-100 text-amber-700',
  enviado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-slate-100 text-slate-500',
  erro: 'bg-red-100 text-red-700',
}

const DEFAULT_CONFIG = {
  relatorio_mensal_ativo: false,
  relatorio_mensal_dia: 5,
  cobranca_ativa: false,
  cobranca_dias_antecedencia: 0,
  cobranca_template:
    'Olá {{contato}}! Passando para lembrar que o plano {{empresa}} no valor de {{valor}} vence em {{vencimento}}. Qualquer dúvida, estamos à disposição!',
  imagens_ativa: false,
  imagens_dias_semana: [1],
  imagens_qtd_minima: 3,
  imagens_template:
    'Olá {{contato}}! Podem nos enviar de {{qtd_minima}} a 5 fotos recentes do dia a dia da {{empresa}} para atualizarmos o Google? 📸',
  relatorio_template:
    'Relatório GBP - {{empresa}}\nVisualizações: {{visualizacoes}}\nChamadas: {{chamadas}}\nSolicitações de rota: {{rotas}}\nCliques no site: {{cliques_site}}',
  leads_followup_ativo: false,
  leads_followup_dias: 3,
  leads_followup_template:
    'Olá {{nome}}! Vi que você entrou em contato com a SEO Local Brasil sobre {{empresa}} e queria saber se ainda tem interesse em conversarmos sobre como podemos ajudar. Posso te ligar essa semana?',
}

const AMOSTRA_PREVIEW = {
  empresa: 'Padaria Exemplo',
  contato: 'Marcos',
  nome: 'Marcos',
  valor: 'R$ 890,00',
  vencimento: 'dia 10',
  qtd_minima: 3,
  visualizacoes: 6200,
  chamadas: 180,
  rotas: 320,
  cliques_site: 210,
}

export default function Automacoes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [savingKey, setSavingKey] = useState(null)
  const [fila, setFila] = useState([])
  const [historico, setHistorico] = useState([])
  const [processandoId, setProcessandoId] = useState(null)
  const [templates, setTemplates] = useState([])
  const [novoTemplate, setNovoTemplate] = useState(EMPTY_TEMPLATE)
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setAccessToken(sessionData.session.access_token)

      const { data: configData } = await supabase.from('automacao_config').select('*').maybeSingle()
      if (configData) setConfig(configData)

      await Promise.all([loadFilaEHistorico(), loadTemplates()])
      setLoading(false)
    }
    init()
  }, [router])

  async function loadTemplates() {
    const { data } = await supabase.from('tarefa_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function handleAddTemplate(e) {
    e.preventDefault()
    if (!novoTemplate.titulo.trim()) return
    setSalvandoTemplate(true)
    const payload = {
      titulo: novoTemplate.titulo.trim(),
      descricao: novoTemplate.descricao.trim() || null,
      prioridade: novoTemplate.prioridade,
      periodicidade: novoTemplate.periodicidade,
      dias_semana: novoTemplate.periodicidade === 'semanal' ? novoTemplate.dias_semana : null,
      dia_mes: novoTemplate.periodicidade === 'mensal' ? novoTemplate.dia_mes : null,
    }
    const { data } = await supabase.from('tarefa_templates').insert([payload]).select().single()
    setSalvandoTemplate(false)
    if (data) {
      setTemplates([data, ...templates])
      setNovoTemplate(EMPTY_TEMPLATE)
    }
  }

  async function handleToggleTemplateAtivo(template) {
    const { data } = await supabase
      .from('tarefa_templates')
      .update({ ativo: !template.ativo })
      .eq('id', template.id)
      .select()
      .single()
    if (data) setTemplates(templates.map((t) => (t.id === template.id ? data : t)))
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Excluir este modelo de tarefa recorrente? As tarefas já geradas continuam existindo.')) return
    await supabase.from('tarefa_templates').delete().eq('id', id)
    setTemplates(templates.filter((t) => t.id !== id))
  }

  function toggleDiaSemanaTemplate(dia) {
    const atual = novoTemplate.dias_semana || []
    const novo = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    setNovoTemplate({ ...novoTemplate, dias_semana: novo })
  }

  async function loadFilaEHistorico() {
    const [{ data: filaData }, { data: historicoData }] = await Promise.all([
      supabase
        .from('mensagens_fila')
        .select('*, clientes(nome), leads(nome)')
        .in('tipo', ['cobranca', 'lead_followup'])
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
      supabase
        .from('mensagens_fila')
        .select('*, clientes(nome), leads(nome)')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setFila(filaData || [])
    setHistorico(historicoData || [])
  }

  async function salvarConfig(patch, key) {
    setSavingKey(key)
    const novoConfig = { ...config, ...patch }
    setConfig(novoConfig)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    await supabase.from('automacao_config').upsert({ ...novoConfig, user_id: session.user.id })
    setSavingKey(null)
  }

  function toggleDiaSemana(dia) {
    const atual = config.imagens_dias_semana || []
    const novo = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    salvarConfig({ imagens_dias_semana: novo }, 'imagens_dias_semana')
  }

  async function handleAprovarEnviar(id) {
    setProcessandoId(id)
    await fetch('/api/mensagens/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id }),
    })
    setProcessandoId(null)
    await loadFilaEHistorico()
  }

  async function handleCancelar(id) {
    if (!confirm('Cancelar esta mensagem?')) return
    await supabase.from('mensagens_fila').update({ status: 'cancelado' }).eq('id', id)
    await loadFilaEHistorico()
  }

  if (loading) {
    return (
      <Layout title="Automações">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Automações">
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Configure disparos automáticos de WhatsApp via WAME. O cron roda uma vez por dia; cobranças e follow-up de
        leads nunca saem sozinhos — ficam numa fila de aprovação abaixo.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Relatório mensal */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-800" />
              <h2 className="font-display font-semibold text-night">Relatório mensal automático</h2>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.relatorio_mensal_ativo}
                onChange={(e) => salvarConfig({ relatorio_mensal_ativo: e.target.checked }, 'relatorio_mensal_ativo')}
              />
              Ativo
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dia do mês para envio</label>
            <select
              value={config.relatorio_mensal_dia}
              onChange={(e) => salvarConfig({ relatorio_mensal_dia: Number(e.target.value) }, 'relatorio_mensal_dia')}
              className="input-field max-w-[120px]"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-1">Prévia (dados de exemplo)</p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
              {applyTemplate(config.relatorio_template, AMOSTRA_PREVIEW)}
            </p>
          </div>
        </div>

        {/* Cobrança */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary-800" />
              <h2 className="font-display font-semibold text-night">Cobrança mensal</h2>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.cobranca_ativa}
                onChange={(e) => salvarConfig({ cobranca_ativa: e.target.checked }, 'cobranca_ativa')}
              />
              Ativo
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dias de antecedência (0 = no dia do vencimento)</label>
            <input
              type="number"
              min={0}
              max={15}
              value={config.cobranca_dias_antecedencia}
              onChange={(e) => salvarConfig({ cobranca_dias_antecedencia: Number(e.target.value) }, 'cobranca_dias_antecedencia')}
              className="input-field max-w-[120px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo da mensagem</label>
            <textarea
              value={config.cobranca_template}
              onChange={(e) => setConfig({ ...config, cobranca_template: e.target.value })}
              onBlur={(e) => salvarConfig({ cobranca_template: e.target.value }, 'cobranca_template')}
              rows={3}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">Placeholders: {'{{contato}} {{empresa}} {{valor}} {{vencimento}}'}</p>
          </div>
          <div className="border-t border-slate-100 pt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Cobranças nunca são enviadas sozinhas — sempre passam pela fila de aprovação abaixo.
          </div>
        </div>

        {/* Solicitação de fotos */}
        <div className="card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-800" />
              <h2 className="font-display font-semibold text-night">Solicitação de fotos</h2>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.imagens_ativa}
                onChange={(e) => salvarConfig({ imagens_ativa: e.target.checked }, 'imagens_ativa')}
              />
              Ativo
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Dias da semana para pedir fotos</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDiaSemana(d.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      (config.imagens_dias_semana || []).includes(d.value)
                        ? 'bg-primary-800 text-white border-primary-800'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade mínima por semana</label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.imagens_qtd_minima}
                onChange={(e) => salvarConfig({ imagens_qtd_minima: Number(e.target.value) }, 'imagens_qtd_minima')}
                className="input-field max-w-[120px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo da mensagem</label>
            <textarea
              value={config.imagens_template}
              onChange={(e) => setConfig({ ...config, imagens_template: e.target.value })}
              onBlur={(e) => salvarConfig({ imagens_template: e.target.value }, 'imagens_template')}
              rows={2}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">Placeholders: {'{{contato}} {{empresa}} {{qtd_minima}}'}</p>
          </div>
          {savingKey && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
            </p>
          )}
        </div>

        {/* Follow-up de leads */}
        <div className="card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-800" />
              <h2 className="font-display font-semibold text-night">Follow-up de leads</h2>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.leads_followup_ativo}
                onChange={(e) => salvarConfig({ leads_followup_ativo: e.target.checked }, 'leads_followup_ativo')}
              />
              Ativo
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dias sem contato antes de sugerir follow-up
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={config.leads_followup_dias}
              onChange={(e) => salvarConfig({ leads_followup_dias: Number(e.target.value) }, 'leads_followup_dias')}
              className="input-field max-w-[120px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Modelo da mensagem</label>
            <textarea
              value={config.leads_followup_template}
              onChange={(e) => setConfig({ ...config, leads_followup_template: e.target.value })}
              onBlur={(e) => salvarConfig({ leads_followup_template: e.target.value }, 'leads_followup_template')}
              rows={2}
              className="input-field"
            />
            <p className="text-xs text-slate-400 mt-1">Placeholders: {'{{nome}} {{empresa}}'}</p>
          </div>
          <div className="border-t border-slate-100 pt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Follow-ups nunca são enviados sozinhos — sempre passam pela fila de aprovação abaixo.
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-primary-800" />
          <h2 className="font-display font-semibold text-night">Tarefas recorrentes do plano Gestão</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Cadastre um checklist fixo aqui - todo dia em que a periodicidade bater, o cron cria a tarefa
          automaticamente pra cada cliente do plano Gestão (sem responsável definido, qualquer um pode pegar em
          "Tarefas" ou "Minhas tarefas").
        </p>

        <form onSubmit={handleAddTemplate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-lg">
          <input
            placeholder="Título da tarefa (ex: Postar novidade no GBP)"
            value={novoTemplate.titulo}
            onChange={(e) => setNovoTemplate({ ...novoTemplate, titulo: e.target.value })}
            className="input-field sm:col-span-2"
            required
          />
          <input
            placeholder="Descrição (opcional)"
            value={novoTemplate.descricao}
            onChange={(e) => setNovoTemplate({ ...novoTemplate, descricao: e.target.value })}
            className="input-field sm:col-span-2"
          />
          <select
            value={novoTemplate.prioridade}
            onChange={(e) => setNovoTemplate({ ...novoTemplate, prioridade: e.target.value })}
            className="input-field"
          >
            {PRIORIDADE_OPTIONS.map((p) => (
              <option key={p} value={p}>Prioridade {p}</option>
            ))}
          </select>
          <select
            value={novoTemplate.periodicidade}
            onChange={(e) => setNovoTemplate({ ...novoTemplate, periodicidade: e.target.value })}
            className="input-field"
          >
            <option value="diaria">Diária (todo dia)</option>
            <option value="semanal">Semanal (dias da semana)</option>
            <option value="mensal">Mensal (dia do mês)</option>
          </select>

          {novoTemplate.periodicidade === 'semanal' && (
            <div className="sm:col-span-2 flex gap-2 flex-wrap">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDiaSemanaTemplate(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    (novoTemplate.dias_semana || []).includes(d.value)
                      ? 'bg-primary-800 text-white border-primary-800'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {novoTemplate.periodicidade === 'mensal' && (
            <select
              value={novoTemplate.dia_mes}
              onChange={(e) => setNovoTemplate({ ...novoTemplate, dia_mes: Number(e.target.value) })}
              className="input-field sm:col-span-2 max-w-[160px]"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Todo dia {d}</option>
              ))}
            </select>
          )}

          <button type="submit" disabled={salvandoTemplate} className="btn-primary flex items-center justify-center gap-2 sm:col-span-2">
            {salvandoTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar tarefa recorrente
          </button>
        </form>

        {templates.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma tarefa recorrente cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <p className={`text-sm font-medium ${t.ativo ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{t.titulo}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {PERIODICIDADE_LABELS[t.periodicidade]}
                    {t.periodicidade === 'semanal' && (t.dias_semana || []).length > 0 && (
                      <> · {(t.dias_semana || []).map((d) => DIAS_SEMANA.find((ds) => ds.value === d)?.label).join(', ')}</>
                    )}
                    {t.periodicidade === 'mensal' && <> · dia {t.dia_mes}</>}
                    {' · '}prioridade {t.prioridade}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                    <input type="checkbox" checked={t.ativo} onChange={() => handleToggleTemplateAtivo(t)} />
                    Ativo
                  </label>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Fila de aprovação
        </h2>
        {fila.length === 0 ? (
          <p className="text-sm text-slate-400">Nada aguardando aprovação.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {fila.map((m) => (
              <li key={m.id} className="py-3 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-sm font-medium text-slate-700">
                    {m.clientes?.nome || m.leads?.nome || 'Removido'}
                    <span className="text-xs text-slate-400 font-normal"> · {TIPO_LABELS[m.tipo] || m.tipo}</span>
                  </p>
                  <p className="text-sm text-slate-500 whitespace-pre-wrap mt-1">{m.mensagem}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAprovarEnviar(m.id)}
                    disabled={processandoId === m.id}
                    className="btn-accent flex items-center gap-2 text-sm"
                  >
                    {processandoId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Aprovar e enviar
                  </button>
                  <button
                    onClick={() => handleCancelar(m.id)}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary-800" />
          Histórico de mensagens automáticas
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma mensagem registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historico.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">
                    {TIPO_LABELS[m.tipo] || m.tipo} · {m.clientes?.nome || m.leads?.nome || 'Removido'}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(m.created_at)}</p>
                </div>
                <span className={`badge ${STATUS_BADGE[m.status] || STATUS_BADGE.pendente}`}>{m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
