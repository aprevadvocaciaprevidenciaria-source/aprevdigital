import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Phone, Mail, ArrowRight, UserCheck, UserX, Sparkles } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

const STATUS_META = {
  novo: { label: 'Novo', badge: 'bg-sky-100 text-sky-700' },
  contatado: { label: 'Contatado', badge: 'bg-amber-100 text-amber-700' },
  qualificado: { label: 'Qualificado', badge: 'bg-purple-100 text-purple-700' },
  convertido: { label: 'Convertido', badge: 'bg-emerald-100 text-emerald-700' },
  perdido: { label: 'Perdido', badge: 'bg-slate-100 text-slate-500' },
}

const FILTROS = [
  { value: 'ativos', label: 'Em aberto' },
  { value: 'todos', label: 'Todos' },
  { value: 'convertido', label: 'Convertidos' },
  { value: 'perdido', label: 'Perdidos' },
]

const EMPTY_LEAD = { nome: '', empresa: '', telefone: '', email: '', mensagem: '' }

export default function Leads() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [leads, setLeads] = useState([])
  const [filtro, setFiltro] = useState('ativos')
  const [novoLead, setNovoLead] = useState(EMPTY_LEAD)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [convertendoId, setConvertendoId] = useState(null)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      await carregarLeads()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregarLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
  }

  async function handleAddLead(e) {
    e.preventDefault()
    if (!novoLead.nome.trim()) return
    setSalvando(true)
    const { data, error } = await supabase
      .from('leads')
      .insert([{ ...novoLead, user_id: userId, origem: 'manual' }])
      .select()
      .single()
    setSalvando(false)
    if (!error) {
      setLeads([data, ...leads])
      setNovoLead(EMPTY_LEAD)
      setMostrarForm(false)
    }
  }

  async function atualizarStatus(lead, status) {
    await supabase.from('leads').update({ status }).eq('id', lead.id)
    setLeads(leads.map((l) => (l.id === lead.id ? { ...l, status } : l)))
  }

  async function converterEmCliente(lead) {
    setConvertendoId(lead.id)
    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert([
        {
          user_id: userId,
          nome: lead.empresa || lead.nome,
          contato_nome: lead.nome,
          contato_whatsapp: lead.telefone,
          contato_email: lead.email,
          notas: lead.mensagem,
          status: 'pendente',
        },
      ])
      .select()
      .single()

    if (!error) {
      await supabase.from('leads').update({ status: 'convertido', cliente_id: cliente.id }).eq('id', lead.id)
      setLeads(leads.map((l) => (l.id === lead.id ? { ...l, status: 'convertido', cliente_id: cliente.id } : l)))
      router.push(`/clientes/${cliente.id}`)
      return
    }
    setConvertendoId(null)
  }

  const leadsFiltrados = leads.filter((l) => {
    if (filtro === 'ativos') return !['convertido', 'perdido'].includes(l.status)
    if (filtro === 'todos') return true
    return l.status === filtro
  })

  if (loading) {
    return (
      <Layout title="Leads">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Leads">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filtro === f.value ? 'bg-primary-800 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setMostrarForm((v) => !v)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Novo lead
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleAddLead} className="card grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <input
            placeholder="Nome"
            value={novoLead.nome}
            onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })}
            className="input-field"
            required
          />
          <input
            placeholder="Empresa (opcional)"
            value={novoLead.empresa}
            onChange={(e) => setNovoLead({ ...novoLead, empresa: e.target.value })}
            className="input-field"
          />
          <input
            placeholder="WhatsApp"
            value={novoLead.telefone}
            onChange={(e) => setNovoLead({ ...novoLead, telefone: e.target.value })}
            className="input-field"
          />
          <input
            type="email"
            placeholder="E-mail"
            value={novoLead.email}
            onChange={(e) => setNovoLead({ ...novoLead, email: e.target.value })}
            className="input-field"
          />
          <textarea
            placeholder="Como foi o contato / observações"
            value={novoLead.mensagem}
            onChange={(e) => setNovoLead({ ...novoLead, mensagem: e.target.value })}
            rows={2}
            className="input-field sm:col-span-2"
          />
          <button type="submit" disabled={salvando} className="btn-primary flex items-center justify-center gap-2 sm:col-span-2">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar lead
          </button>
        </form>
      )}

      {leadsFiltrados.length === 0 ? (
        <div className="card text-center py-10 text-sm text-slate-400">Nenhum lead nessa visão ainda.</div>
      ) : (
        <ul className="space-y-3">
          {leadsFiltrados.map((lead) => {
            const meta = STATUS_META[lead.status] || STATUS_META.novo
            return (
              <li key={lead.id} className="card">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-700">{lead.nome}</p>
                      {lead.empresa && <span className="text-sm text-slate-400">· {lead.empresa}</span>}
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      {lead.origem === 'site' && <span className="badge bg-indigo-50 text-indigo-600">Site</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                      {lead.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {lead.telefone}
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> {lead.email}
                        </span>
                      )}
                      <span>{formatDateTime(lead.created_at)}</span>
                    </div>
                    {lead.mensagem && <p className="text-sm text-slate-600 mt-2">{lead.mensagem}</p>}
                  </div>

                  {!['convertido', 'perdido'].includes(lead.status) && (
                    <div className="flex gap-2 flex-shrink-0">
                      {lead.status === 'novo' && (
                        <button
                          onClick={() => atualizarStatus(lead, 'contatado')}
                          className="btn-secondary flex items-center gap-1.5 text-sm"
                        >
                          <UserCheck className="w-4 h-4" />
                          Contatado
                        </button>
                      )}
                      {lead.status !== 'qualificado' && (
                        <button
                          onClick={() => atualizarStatus(lead, 'qualificado')}
                          className="btn-secondary flex items-center gap-1.5 text-sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Qualificar
                        </button>
                      )}
                      <button
                        onClick={() => converterEmCliente(lead)}
                        disabled={convertendoId === lead.id}
                        className="btn-primary flex items-center gap-1.5 text-sm"
                      >
                        {convertendoId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        Converter em cliente
                      </button>
                      <button
                        onClick={() => atualizarStatus(lead, 'perdido')}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Marcar como perdido"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Layout>
  )
}
