import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  MessageSquare,
  Plus,
  CheckSquare,
  Pencil,
  Building2,
  ClipboardList,
  FolderOpen,
  ExternalLink,
} from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/format'
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

const FIELD_LABELS = {
  nome: 'Nome do cliente',
  cnpj: 'CPF',
  nicho: 'Tipo de benefício',
  endereco: 'Endereço',
  cidade: 'Cidade',
  telefone: 'Telefone',
  email_comercial: 'E-mail',
  contato_nome: 'Nome de quem atende (se não for o cliente)',
  contato_whatsapp: 'WhatsApp de contato',
  contato_email: 'E-mail de contato',
  plano_valor: 'Valor dos honorários',
  data_inicio_contrato: 'Início do contrato',
  data_fim_contrato: 'Fim do contrato',
  dia_vencimento: 'Dia de vencimento da parcela',
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
  const [emailConvite, setEmailConvite] = useState('')
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [conviteMsg, setConviteMsg] = useState('')
  const [savingDrive, setSavingDrive] = useState(false)

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
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('tarefas').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, email').eq('cliente_id', id).eq('tipo', 'cliente').maybeSingle(),
    ])

    setForm(cliente)
    setTarefas(tarefasData || [])
    setClienteAcesso(acessoData || null)
    setLoading(false)
  }

  async function handleSaveDrivePasta(e) {
    e.preventDefault()
    setSavingDrive(true)
    await supabase.from('clientes').update({ link_pasta_drive: form.link_pasta_drive || null }).eq('id', id)
    setSavingDrive(false)
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
      status, data_inicio_contrato, data_fim_contrato, dia_vencimento, notas,
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
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-night mb-1">{form.nome}</h1>
          <p className="text-sm text-slate-500">{form.nicho || 'Sem benefício definido'} {form.cidade ? `· ${form.cidade}` : ''}</p>
        </div>
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
                      {key === 'plano_valor'
                        ? formatCurrency(form[key])
                        : key === 'data_inicio_contrato' || key === 'data_fim_contrato'
                        ? formatDate(form[key])
                        : form[key] || '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do cliente</label>
                  <input required value={form.nome || ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                    <input value={form.cnpj || ''} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de benefício</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input type="email" value={form.email_comercial || ''} onChange={(e) => setForm({ ...form, email_comercial: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome de quem atende (se não for o cliente)</label>
                    <input value={form.contato_nome || ''} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp de contato</label>
                    <input value={form.contato_whatsapp || ''} onChange={(e) => setForm({ ...form, contato_whatsapp: e.target.value })} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de contato</label>
                  <input type="email" value={form.contato_email || ''} onChange={(e) => setForm({ ...form, contato_email: e.target.value })} className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor dos honorários (R$)</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dia de vencimento da parcela</label>
                    <input type="number" min={1} max={31} value={form.dia_vencimento ?? ''} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} placeholder="Ex: 10" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de fim do contrato (opcional)</label>
                  <input type="date" value={form.data_fim_contrato || ''} onChange={(e) => setForm({ ...form, data_fim_contrato: e.target.value })} className="input-field" />
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

          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary-800" />
              <h2 className="font-display font-semibold text-night">Pasta do Google Drive</h2>
            </div>
            <p className="text-xs text-slate-400">
              Cola aqui o link da pasta desse caso no Drive (ou de uma subpasta específica dentro da pasta de
              clientes). Com isso a APREV Digital consegue listar e ler os arquivos dessa pasta (e das subpastas
              dela) quando você pedir na conversa - precisa ter conectado o Google em Configurações antes.
            </p>
            <form onSubmit={handleSaveDrivePasta} className="flex flex-wrap items-center gap-3">
              <input
                type="url"
                value={form.link_pasta_drive || ''}
                onChange={(e) => setForm({ ...form, link_pasta_drive: e.target.value })}
                placeholder="https://drive.google.com/drive/folders/..."
                className="input-field flex-1 min-w-[240px]"
              />
              <button type="submit" disabled={savingDrive} className="btn-primary flex items-center gap-2 text-sm">
                {savingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
              {form.link_pasta_drive && (
                <a href={form.link_pasta_drive} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2 text-sm">
                  <ExternalLink className="w-4 h-4" />
                  Abrir no Drive
                </a>
              )}
            </form>
          </div>

          <div className="card">
            <h2 className="font-display font-semibold text-night mb-1">Acesso do cliente ao portal</h2>
            <p className="text-xs text-slate-400 mb-4">
              Dá pra esse cliente acompanhar o andamento do processo, datas e documentos do caso dele num portal
              só dele, sem acesso ao resto do seu painel.
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
