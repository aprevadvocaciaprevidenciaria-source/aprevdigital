import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  MessageSquare,
  Plus,
  CheckSquare,
  Pencil,
  RefreshCw,
  Building2,
  ClipboardList,
  FileText,
  Send,
  Layers,
  ExternalLink,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format'
import { ONBOARDING_LABELS, onboardingFieldLabel } from '../../lib/onboardingSchemas'
import { STATUS_META, statusMeta } from '../../lib/status'

function buildConviteWhatsappUrl(cliente, email) {
  const contato = cliente.contato_nome || cliente.nome || 'tudo bem'
  const mensagem =
    `Oi ${contato}! 🎉 Liberamos seu acesso ao portal do seu caso na APREV.\n\n` +
    `Você vai receber um e-mail da nossa plataforma pra criar sua senha de acesso. Depois disso, é só entrar com o e-mail ${email}.\n\n` +
    `Lá você acompanha, em tempo real:\n` +
    `📄 Andamento do processo\n` +
    `📅 Datas de perícia e prazos\n` +
    `💬 Contato direto com a equipe\n\n` +
    `Qualquer dúvida, é só chamar por aqui!`
  const texto = encodeURIComponent(mensagem)
  let digits = (cliente.contato_whatsapp || '').replace(/\D/g, '')
  if (digits && !digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }
  return digits ? `https://wa.me/${digits}?text=${texto}` : `https://wa.me/?text=${texto}`
}

const TABS = [
  { value: 'geral', label: 'Visão geral', icon: Building2 },
  { value: 'tarefas', label: 'Tarefas', icon: ClipboardList },
]

function buildOnboardingWaLink(cliente, clienteId, tipo) {
  const contato = cliente.contato_nome || cliente.nome || 'tudo bem'
  const link = `https://painel.seolocalbrasil.com/onboarding/${clienteId}/${tipo}`
  const tipoLabel = tipo === 'criacao' ? 'criação do seu perfil' : 'otimização do seu perfil'
  const mensagem =
    `Oi ${contato}! Pra darmos início à ${tipoLabel} no Google Maps, precisamos de algumas informações suas.\n\n` +
    `Pode preencher esse formulário rapidinho? ${link}\n\n` +
    `Leva só alguns minutos. Qualquer dúvida, é só chamar!`
  let digits = (cliente.contato_whatsapp || '').replace(/\D/g, '')
  if (digits && !digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}` : `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}

const FIELD_LABELS = {
  nome: 'Nome do cliente',
  cnpj: 'CPF',
  endereco: 'Endereço',
  cidade: 'Cidade',
  telefone: 'Telefone',
  email_comercial: 'E-mail',
  contato_nome: 'Nome de quem atende',
  contato_whatsapp: 'WhatsApp de contato',
  contato_email: 'E-mail de contato',
  nicho: 'Tipo de benefício',
  plano_valor: 'Valor dos honorários',
  data_inicio_contrato: 'Início do contrato',
  data_fim_contrato: 'Fim do contrato',
  dia_vencimento: 'Dia de vencimento da parcela',
  google_business_id: 'ID do Google Business Profile',
  link_avaliacao: 'Link de avaliação do Google',
  ticket_medio: 'Ticket médio do cliente',
  taxa_conversao_estimada: 'Taxa de conversão estimada',
}

export default function ClienteDetalhe() {
  const router = useRouter()
  const { id } = router.query

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)
  const [form, setForm] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState('geral')
  const [tarefas, setTarefas] = useState([])
  const [novaTarefa, setNovaTarefa] = useState('')
  const [accessToken, setAccessToken] = useState(null)
  const [clienteAcesso, setClienteAcesso] = useState(null)
  const [onboardingSubmissions, setOnboardingSubmissions] = useState([])
  const [onboardingAberto, setOnboardingAberto] = useState(null)
  const [emailConvite, setEmailConvite] = useState('')
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [conviteMsg, setConviteMsg] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      setAccessToken(sessionData.session.access_token)
      if (id) await loadCliente()
    }
    init()
  }, [id, router])

  async function loadCliente() {
    setLoading(true)
    const [
      { data: cliente },
      { data: tarefasData },
      { data: acessoData },
      { data: onboardingData },
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('tarefas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, email').eq('cliente_id', id).eq('tipo', 'cliente').maybeSingle(),
      supabase.from('onboarding_submissions').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    ])

    setForm(cliente)
    setTarefas(tarefasData || [])
    setClienteAcesso(acessoData || null)
    setOnboardingSubmissions(onboardingData || [])
    setLoading(false)
  }

  async function handleConvidarCliente(e) {
    e.preventDefault()
    if (!emailConvite.trim()) return
    setEnviandoConvite(true)
    setConviteMsg('')
    const res = await fetch('/api/clientes/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ clienteId: id, email: emailConvite.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setEnviandoConvite(false)
    if (!res.ok) {
      setConviteMsg(json.error || 'Erro ao enviar convite.')
      return
    }
    setConviteMsg(json.novoUsuario ? 'Convite enviado por e-mail!' : 'Acesso vinculado com sucesso.')
    setEmailConvite('')
    const { data } = await supabase
      .from('users')
      .select('id, email')
      .eq('cliente_id', id)
      .eq('tipo', 'cliente')
      .maybeSingle()
    setClienteAcesso(data || null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const {
      nome, cnpj, endereco, cidade, telefone, email_comercial,
      contato_nome, contato_whatsapp, contato_email, nicho, plano_valor,
      status, data_inicio_contrato, data_fim_contrato, dia_vencimento, notas, google_business_id, link_avaliacao,
      ticket_medio, taxa_conversao_estimada, plano_gestao,
    } = form
    await supabase
      .from('clientes')
      .update({
        nome, cnpj, endereco, cidade, telefone, email_comercial,
        contato_nome, contato_whatsapp, contato_email, nicho,
        plano_valor: plano_valor === '' ? null : Number(plano_valor),
        status,
        data_inicio_contrato: data_inicio_contrato || null,
        data_fim_contrato: data_fim_contrato || null,
        dia_vencimento: dia_vencimento === '' || dia_vencimento === null ? null : Number(dia_vencimento),
        notas,
        google_business_id,
        link_avaliacao: link_avaliacao || null,
        plano_gestao: !!plano_gestao,
        ticket_medio: ticket_medio === '' || ticket_medio === null ? null : Number(ticket_medio),
        taxa_conversao_estimada: taxa_conversao_estimada === '' || taxa_conversao_estimada === null ? null : Number(taxa_conversao_estimada),
      })
      .eq('id', id)
    setSaving(false)
    setEditMode(false)
  }

  async function handleDelete() {
    if (!confirm('Excluir este cliente permanentemente?')) return
    // Passa pela rota /api/clientes/excluir (service role) em vez de
    // excluir direto pelo cliente autenticado: se o cliente tem acesso ao
    // portal vinculado, a RLS de `users` bloqueia a exclusão (não deixa a
    // agência mexer no login de outra pessoa), mesmo sendo o dono do
    // cliente. A rota confirma a posse primeiro e só então exclui.
    const res = await fetch('/api/clientes/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ clienteId: id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error || 'Não foi possível excluir esse cliente.')
      return
    }
    router.push('/clientes')
  }

  async function handleAddTarefa(e) {
    e.preventDefault()
    if (!novaTarefa.trim()) return
    const { data } = await supabase
      .from('tarefas')
      .insert([{ titulo: novaTarefa, cliente_id: id, user_id: userId, status: 'a-fazer', prioridade: 'media' }])
      .select()
      .single()
    setTarefas([data, ...tarefas])
    setNovaTarefa('')
  }

  async function toggleTarefa(tarefa) {
    const novoStatus = tarefa.status === 'concluida' ? 'a-fazer' : 'concluida'
    await supabase.from('tarefas').update({ status: novoStatus }).eq('id', tarefa.id)
    setTarefas(tarefas.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t)))
  }

  if (loading || !form) {
    return (
      <Layout title="Cliente">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  const meta = statusMeta(form.status)

  return (
    <Layout title="Detalhes do cliente">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button
          onClick={() => router.push('/clientes')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para clientes
        </button>

        <div className="flex items-center gap-2">
          <span className={`badge ${meta.badge}`}>
            <span className={`badge-dot ${meta.dot}`} />
            {meta.label}
          </span>
          <button
            disabled
            title="Sincronização automática com o Google Business Profile chega em breve"
            className="btn-secondary flex items-center gap-2 opacity-60 cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar com Google
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-night mb-1">{form.nome}</h1>
          <p className="text-sm text-slate-500">{form.nicho || 'Sem nicho definido'} {form.cidade ? `· ${form.cidade}` : ''}</p>
        </div>
        <Link href={`/gestao/${id}`} className="btn-primary flex items-center gap-2 text-sm">
          <Layers className="w-4 h-4" />
          Ver Gestão deste cliente
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

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
              {tab.value === 'tarefas' && tarefas.filter((t) => t.status !== 'concluida').length > 0 && (
                <span className="badge bg-amber-100 text-amber-700 py-0">{tarefas.filter((t) => t.status !== 'concluida').length}</span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'geral' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-night">Informações do cliente</h2>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-2 text-sm">
                  <Pencil className="w-4 h-4" />
                  Editar informações
                </button>
              )}
            </div>

            {!editMode ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key}>
                    <dt className="text-xs text-slate-400">{label}</dt>
                    <dd className="text-sm text-slate-700 font-medium">
                      {key === 'plano_valor' || key === 'ticket_medio'
                        ? formatCurrency(form[key])
                        : key === 'data_inicio_contrato' || key === 'data_fim_contrato'
                        ? formatDate(form[key])
                        : key === 'taxa_conversao_estimada'
                        ? (form[key] || form[key] === 0 ? `${form[key]}%` : '—')
                        : form[key] || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da empresa</label>
                  <input required value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                    <input value={form.cnpj || ''} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nicho</label>
                    <input value={form.nicho || ''} onChange={(e) => setForm({ ...form, nicho: e.target.value })} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço completo</label>
                  <input value={form.endereco || ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                    <input value={form.cidade || ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                    <input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail comercial</label>
                  <input type="email" value={form.email_comercial || ''} onChange={(e) => setForm({ ...form, email_comercial: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do contato</label>
                    <input value={form.contato_nome || ''} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp do contato</label>
                    <input value={form.contato_whatsapp || ''} onChange={(e) => setForm({ ...form, contato_whatsapp: e.target.value })} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail do contato</label>
                  <input type="email" value={form.contato_email || ''} onChange={(e) => setForm({ ...form, contato_email: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor do plano (R$)</label>
                    <input type="number" step="0.01" value={form.plano_valor ?? ''} onChange={(e) => setForm({ ...form, plano_valor: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select value={form.status || 'pendente'} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                      {STATUS_META.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data de início do contrato</label>
                    <input type="date" value={form.data_inicio_contrato || ''} onChange={(e) => setForm({ ...form, data_inicio_contrato: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dia de vencimento do plano</label>
                    <input type="number" min={1} max={31} value={form.dia_vencimento ?? ''} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} placeholder="Ex: 10" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de fim do contrato (opcional)</label>
                  <input type="date" value={form.data_fim_contrato || ''} onChange={(e) => setForm({ ...form, data_fim_contrato: e.target.value })} className="input-field" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.plano_gestao}
                    onChange={(e) => setForm({ ...form, plano_gestao: e.target.checked })}
                  />
                  Cliente do plano de Gestão (recebe a aba de datas especiais/feriados no portal dele)
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ID do Google Business Profile</label>
                  <input value={form.google_business_id || ''} onChange={(e) => setForm({ ...form, google_business_id: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Link direto de avaliação do Google (opcional)</label>
                  <input
                    type="url"
                    value={form.link_avaliacao || ''}
                    onChange={(e) => setForm({ ...form, link_avaliacao: e.target.value })}
                    placeholder="https://g.page/r/.../review"
                    className="input-field"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Pega esse link no app do Google Business Profile em "Receber mais avaliações". Com ele
                    preenchido, o cliente vê o botão de QR Code no portal dele.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ticket médio do cliente (R$)</label>
                    <input type="number" step="0.01" value={form.ticket_medio ?? ''} onChange={(e) => setForm({ ...form, ticket_medio: e.target.value })} placeholder="Ex: 150" className="input-field" />
                    <p className="text-xs text-slate-400 mt-1">Usado na calculadora de ROI do relatório avançado.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de conversão estimada (%)</label>
                    <input type="number" step="0.1" min={0} max={100} value={form.taxa_conversao_estimada ?? ''} onChange={(e) => setForm({ ...form, taxa_conversao_estimada: e.target.value })} placeholder="Ex: 20" className="input-field" />
                    <p className="text-xs text-slate-400 mt-1">% das ligações/rotas/cliques que viram cliente de verdade.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações gerais</label>
                  <textarea value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={3} className="input-field" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setEditMode(false); loadCliente() }} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar alterações
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-2">Observações / anotações</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{form.notas || 'Nenhuma observação registrada.'}</p>
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-1">Acesso do cliente ao portal</h2>
            <p className="text-xs text-slate-400 mb-4">
              Dá pra esse cliente ver métricas, avaliações, fotos e relatórios num portal só dele, sem acesso ao
              resto do seu painel.
            </p>

            {clienteAcesso ? (
              <div className="space-y-3">
                <p className="text-sm text-secondary-700 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2">
                  Acesso liberado para <strong>{clienteAcesso.email}</strong>.
                </p>
                <a
                  href={buildConviteWhatsappUrl(form, clienteAcesso.email)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Enviar convite no WhatsApp
                </a>
              </div>
            ) : (
              <form onSubmit={handleConvidarCliente} className="flex flex-wrap gap-3">
                <input
                  type="email"
                  required
                  placeholder="e-mail do cliente"
                  value={emailConvite}
                  onChange={(e) => setEmailConvite(e.target.value)}
                  className="input-field flex-1 min-w-[220px]"
                />
                <button type="submit" disabled={enviandoConvite} className="btn-primary flex items-center gap-2">
                  {enviandoConvite && <Loader2 className="w-4 h-4 animate-spin" />}
                  Dar acesso ao cliente
                </button>
              </form>
            )}
            {conviteMsg && <p className="text-xs text-slate-500 mt-2">{conviteMsg}</p>}
          </div>

          <div className="card">
            <button onClick={handleDelete} className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium">
              <Trash2 className="w-4 h-4" />
              Excluir cliente permanentemente
            </button>
          </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-semibold text-night mb-1">Formulários de onboarding</h2>
            <p className="text-xs text-slate-400 mb-4">
              Manda o link certo pro cliente preencher as informações que precisamos pra criar ou otimizar o
              perfil dele no Google Maps. A resposta cai aqui embaixo assim que ele enviar.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={buildOnboardingWaLink(form, id, 'criacao')}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                Enviar formulário de Criação
              </a>
              <a
                href={buildOnboardingWaLink(form, id, 'otimizacao')}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Send className="w-4 h-4" />
                Enviar formulário de Otimização
              </a>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-4">Respostas recebidas</h2>
            {onboardingSubmissions.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma resposta recebida ainda.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {onboardingSubmissions.map((s) => {
                  const aberto = onboardingAberto === s.id
                  return (
                    <li key={s.id} className="py-3">
                      <button
                        onClick={() => setOnboardingAberto(aberto ? null : s.id)}
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-700">{ONBOARDING_LABELS[s.tipo] || s.tipo}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(s.created_at)}</p>
                        </div>
                        <span className="text-sm text-primary-800 font-medium">{aberto ? 'Fechar' : 'Ver respostas'}</span>
                      </button>
                      {aberto && (
                        <dl className="mt-3 space-y-2.5 rounded-lg bg-slate-50 p-4">
                          {Object.entries(s.dados || {}).map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-xs text-slate-400">{onboardingFieldLabel(s.tipo, key)}</dt>
                              <dd className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{value || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tarefas' && (
        <div className="card">
          <h2 className="font-display font-semibold text-night mb-4">Tarefas do cliente</h2>
          <form onSubmit={handleAddTarefa} className="flex gap-2 mb-4">
            <input
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              placeholder="Nova tarefa..."
              className="input-field"
            />
            <button type="submit" className="btn-primary px-3">
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {tarefas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma tarefa associada.</p>
          ) : (
            <ul className="space-y-2">
              {tarefas.map((t) => {
                const subtarefas = t.subtarefas || []
                const concluidas = subtarefas.filter((s) => s.concluida).length
                return (
                  <li key={t.id} className="flex items-start gap-2 py-1">
                    <button onClick={() => toggleTarefa(t)} className="mt-0.5">
                      <CheckSquare className={`w-4 h-4 ${t.status === 'concluida' ? 'text-primary-800' : 'text-slate-300'}`} />
                    </button>
                    <div>
                      <span className={`text-sm ${t.status === 'concluida' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {t.titulo}
                      </span>
                      {subtarefas.length > 0 && (
                        <p className="text-xs text-slate-400">{concluidas}/{subtarefas.length} subtarefas concluídas</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Layout>
  )
}
