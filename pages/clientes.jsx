import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  Search,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  X,
  Users,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { exportCsv } from '../lib/csv'
import { formatCurrency } from '../lib/format'
import { STATUS_META, STATUS_OPTIONS, statusMeta } from '../lib/status'

const TIPOS_BENEFICIO = [
  'Aposentadoria por idade',
  'Aposentadoria por invalidez',
  'Auxílio-doença',
  'Auxílio-acidente',
  'BPC/LOAS',
  'Pensão por morte',
  'Revisão de benefício',
  'Outro',
]

const EMPTY_FORM = {
  nome: '',
  cnpj: '',
  endereco: '',
  cidade: '',
  telefone: '',
  email_comercial: '',
  contato_nome: '',
  contato_whatsapp: '',
  contato_email: '',
  nicho: '',
  plano_valor: '',
  status: 'pendente',
  data_inicio_contrato: '',
  data_fim_contrato: '',
  dia_vencimento: '',
  notas: '',
}

function diaDoMes(dataStr) {
  if (!dataStr) return ''
  return new Date(`${dataStr}T00:00:00`).getDate()
}

const PAGE_SIZE_KEY = 'aprev_page_size'

export default function Clientes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [nichoFilter, setNichoFilter] = useState('todos')
  const [sortBy, setSortBy] = useState('nome')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = Number(localStorage.getItem(PAGE_SIZE_KEY))
    if (stored) setPageSize(stored)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setUserId(sessionData.session.user.id)
      setAccessToken(sessionData.session.access_token)
      await loadClientes()
      setLoading(false)
    }
    init()
  }, [router])

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEditModal(cliente) {
    setEditingId(cliente.id)
    setForm({
      nome: cliente.nome || '',
      cnpj: cliente.cnpj || '',
      endereco: cliente.endereco || '',
      cidade: cliente.cidade || '',
      telefone: cliente.telefone || '',
      email_comercial: cliente.email_comercial || '',
      contato_nome: cliente.contato_nome || '',
      contato_whatsapp: cliente.contato_whatsapp || '',
      contato_email: cliente.contato_email || '',
      nicho: cliente.nicho || '',
      plano_valor: cliente.plano_valor ?? '',
      status: cliente.status || 'pendente',
      data_inicio_contrato: cliente.data_inicio_contrato || '',
      data_fim_contrato: cliente.data_fim_contrato || '',
      dia_vencimento: cliente.dia_vencimento ?? '',
      notas: cliente.notas || '',
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    const payload = { ...form, plano_valor: form.plano_valor === '' ? null : Number(form.plano_valor) }
    if (payload.data_inicio_contrato === '') payload.data_inicio_contrato = null
    if (payload.data_fim_contrato === '') payload.data_fim_contrato = null
    payload.dia_vencimento = payload.dia_vencimento === '' ? null : Number(payload.dia_vencimento)

    if (editingId) {
      await supabase.from('clientes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('clientes').insert([{ ...payload, user_id: userId }])
    }

    setSaving(false)
    setShowModal(false)
    await loadClientes()
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    // Passa pela rota /api/clientes/excluir (service role): se o cliente
    // tem acesso ao portal vinculado, a RLS de `users` bloqueia a exclusão
    // direta, mesmo sendo o dono do cliente.
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
    await loadClientes()
  }

  const tiposBeneficioDisponiveis = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.nicho?.trim()).filter(Boolean))).sort(),
    [clientes]
  )

  const filtered = useMemo(() => {
    const list = clientes.filter((c) => {
      const matchesSearch =
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.contato_email?.toLowerCase().includes(search.toLowerCase()) ||
        c.cidade?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'todos' || c.status === statusFilter
      const matchesNicho = nichoFilter === 'todos' || c.nicho === nichoFilter
      return matchesSearch && matchesStatus && matchesNicho
    })
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'atualizado') return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      return (a.nome || '').localeCompare(b.nome || '')
    })
    return sorted
  }, [clientes, search, statusFilter, nichoFilter, sortBy])

  useEffect(() => setPage(1), [search, statusFilter, nichoFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  function handleExport() {
    exportCsv(
      'casos-aprev.csv',
      ['Nome', 'CPF', 'Cidade', 'Tipo de benefício', 'Telefone', 'E-mail', 'Contato', 'WhatsApp', 'Honorário (R$)', 'Status', 'Início do contrato', 'Fim do contrato'],
      filtered.map((c) => [
        c.nome,
        c.cnpj,
        c.cidade,
        c.nicho,
        c.telefone,
        c.email_comercial,
        c.contato_nome,
        c.contato_whatsapp,
        c.plano_valor ?? '',
        statusMeta(c.status).label,
        c.data_inicio_contrato || '',
        c.data_fim_contrato || '',
      ])
    )
  }

  if (loading) {
    return (
      <Layout title="Casos">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Casos">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou cidade..."
              className="input-field pl-9"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field sm:max-w-[160px]">
            <option value="todos">Todos os status</option>
            {STATUS_META.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={nichoFilter} onChange={(e) => setNichoFilter(e.target.value)} className="input-field sm:max-w-[160px]">
            <option value="todos">Todos os benefícios</option>
            {tiposBeneficioDisponiveis.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field sm:max-w-[180px]">
            <option value="nome">Ordenar por nome</option>
            <option value="atualizado">Ordenar por último acesso</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 justify-center">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 justify-center">
            <Plus className="w-4 h-4" />
            Novo Caso
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-2" />
            <p className="text-sm">Nenhum caso encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Benefício</th>
                <th className="px-6 py-3 font-medium">Cidade</th>
                <th className="px-6 py-3 font-medium">Contato</th>
                <th className="px-6 py-3 font-medium">Honorário</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c, idx) => {
                const meta = statusMeta(c.status)
                return (
                  <tr key={c.id} className={`border-b border-slate-50 hover:bg-primary-50/40 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-6 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-primary-800">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{c.nicho || '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{c.cidade || '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{c.contato_whatsapp || c.contato_email || '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{formatCurrency(c.plano_valor)}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${meta.badge}`}>
                        <span className={`badge-dot ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/clientes/${c.id}`} className="p-1.5 text-slate-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={() => openEditModal(c)} className="p-1.5 text-slate-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>
            {filtered.length} caso{filtered.length !== 1 ? 's' : ''} · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-night">{editingId ? 'Editar caso' : 'Novo caso'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do cliente</label>
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                  <input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="000.000.000-00"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de benefício</label>
                  <input
                    list="beneficios-sugeridos"
                    value={form.nicho}
                    onChange={(e) => setForm({ ...form, nicho: e.target.value })}
                    placeholder="Ex: Auxílio-doença, Aposentadoria..."
                    className="input-field"
                  />
                  <datalist id="beneficios-sugeridos">
                    {TIPOS_BENEFICIO.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endereço completo</label>
                <input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  <input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.email_comercial}
                  onChange={(e) => setForm({ ...form, email_comercial: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome de quem atende (se não for o cliente)</label>
                  <input
                    value={form.contato_nome}
                    onChange={(e) => setForm({ ...form, contato_nome: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp de contato</label>
                  <input
                    value={form.contato_whatsapp}
                    onChange={(e) => setForm({ ...form, contato_whatsapp: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de contato</label>
                <input
                  type="email"
                  value={form.contato_email}
                  onChange={(e) => setForm({ ...form, contato_email: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor dos honorários (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.plano_valor}
                    onChange={(e) => setForm({ ...form, plano_valor: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input-field"
                  >
                    {STATUS_META.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de início do contrato</label>
                  <input
                    type="date"
                    value={form.data_inicio_contrato}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        data_inicio_contrato: e.target.value,
                        dia_vencimento: form.dia_vencimento === '' ? diaDoMes(e.target.value) : form.dia_vencimento,
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia de vencimento da parcela</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dia_vencimento}
                    onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })}
                    placeholder="Ex: 10"
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de fim do contrato (opcional)</label>
                <input
                  type="date"
                  value={form.data_fim_contrato}
                  onChange={(e) => setForm({ ...form, data_fim_contrato: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações gerais</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="input-field"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
