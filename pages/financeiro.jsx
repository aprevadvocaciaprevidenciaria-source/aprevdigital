import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  Plus,
  Trash2,
  Wallet,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/format'
import { STATUS_META, SUGESTOES_DESCRICAO, statusExibido } from '../lib/financeiro'

const EMPTY = { cliente_id: '', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), status: 'pendente' }

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

export default function Financeiro() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lancamentos, setLancamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [novo, setNovo] = useState(EMPTY)
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [valoresOcultos, setValoresOcultos] = useState(false)

  const [editandoId, setEditandoId] = useState(null)
  const [editValues, setEditValues] = useState(EMPTY)

  const [filtroMes, setFiltroMes] = useState(mesAtual())
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')

  useEffect(() => {
    setValoresOcultos(localStorage.getItem('financeiro-valores-ocultos') === '1')
  }, [])

  function toggleValoresOcultos() {
    const novoValor = !valoresOcultos
    setValoresOcultos(novoValor)
    localStorage.setItem('financeiro-valores-ocultos', novoValor ? '1' : '0')
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      await carregar()
      setLoading(false)
    }
    init()
  }, [router])

  async function carregar() {
    const [{ data: lancData }, { data: clientesData }] = await Promise.all([
      supabase
        .from('financeiro_lancamentos')
        .select('*, clientes(nome)')
        .order('data', { ascending: false }),
      supabase.from('clientes').select('id, nome').order('nome', { ascending: true }),
    ])
    setLancamentos(lancData || [])
    setClientes(clientesData || [])
  }

  function showFeedback(msg) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 4000)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!novo.descricao.trim() || !novo.valor) return
    setSalvando(true)
    await supabase.from('financeiro_lancamentos').insert({
      cliente_id: novo.cliente_id || null,
      descricao: novo.descricao.trim(),
      valor: Number(novo.valor),
      data: novo.data,
      status: novo.status,
      origem: 'avulso',
    })
    setNovo(EMPTY)
    await carregar()
    setSalvando(false)
    showFeedback('Lançamento registrado.')
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('financeiro_lancamentos').delete().eq('id', id)
    await carregar()
  }

  async function handleToggleStatus(l) {
    const novoStatus = l.status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('financeiro_lancamentos').update({ status: novoStatus }).eq('id', l.id)
    await carregar()
  }

  function startEdit(l) {
    setEditandoId(l.id)
    setEditValues({
      cliente_id: l.cliente_id || '',
      descricao: l.descricao,
      valor: String(l.valor),
      data: l.data,
      status: l.status,
    })
  }

  async function handleSaveEdit(id) {
    if (!editValues.descricao.trim() || !editValues.valor) return
    await supabase
      .from('financeiro_lancamentos')
      .update({
        cliente_id: editValues.cliente_id || null,
        descricao: editValues.descricao.trim(),
        valor: Number(editValues.valor),
        data: editValues.data,
        status: editValues.status,
      })
      .eq('id', id)
    setEditandoId(null)
    await carregar()
  }

  async function handleGerarMensalidades() {
    setGerando(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    try {
      const res = await fetch('/api/financeiro/gerar-mensalidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar mensalidades.')
      showFeedback(
        json.geradas > 0
          ? `${json.geradas} mensalidade(s) gerada(s) pro mês atual.`
          : 'Nenhuma mensalidade nova pra gerar (já geradas ou nenhum cliente com plano ativo).'
      )
      await carregar()
    } catch (err) {
      showFeedback(err.message)
    }
    setGerando(false)
  }

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroMes && !l.data.startsWith(filtroMes)) return false
      if (filtroStatus && statusExibido(l) !== filtroStatus) return false
      if (filtroCliente && l.cliente_id !== filtroCliente) return false
      return true
    })
  }, [lancamentos, filtroMes, filtroStatus, filtroCliente])

  const totais = useMemo(() => {
    const base = { pago: 0, pendente: 0, atrasado: 0, total: 0 }
    for (const l of lancamentosFiltrados) {
      const status = statusExibido(l)
      base[status] += Number(l.valor)
      base.total += Number(l.valor)
    }
    return base
  }, [lancamentosFiltrados])

  function exibirValor(valor) {
    return valoresOcultos ? '••••' : formatCurrency(valor)
  }

  if (loading) {
    return (
      <Layout title="Financeiro">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Financeiro">
      <div className="flex items-start justify-between gap-4 mb-6">
        <p className="text-sm text-slate-500 max-w-2xl">
          Registre vendas avulsas (otimização, criação de perfil, serviços por fora) e acompanhe as mensalidades dos
          clientes com plano recorrente, com controle do que já foi pago e do que ainda falta receber.
        </p>
        <button
          onClick={toggleValoresOcultos}
          className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary-800 px-2.5 py-1.5 rounded-lg hover:bg-primary-50"
        >
          {valoresOcultos ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
        </button>
      </div>

      {feedback && (
        <div className="mb-6 flex items-center gap-2 bg-secondary-50 text-secondary-700 text-sm px-4 py-3 rounded-lg border border-secondary-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Recebido no período</p>
          <p className="text-xl font-display font-bold text-emerald-600">{exibirValor(totais.pago)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Pendente</p>
          <p className="text-xl font-display font-bold text-amber-600">{exibirValor(totais.pendente)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Atrasado</p>
          <p className="text-xl font-display font-bold text-red-600">{exibirValor(totais.atrasado)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400 mb-1">Total do período</p>
          <p className="text-xl font-display font-bold text-night">{exibirValor(totais.total)}</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="card mb-8">
        <h2 className="font-display font-semibold text-night mb-4">Registrar venda avulsa</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente (opcional)</label>
            <select
              value={novo.cliente_id}
              onChange={(e) => setNovo({ ...novo, cliente_id: e.target.value })}
              className="input-field"
            >
              <option value="">Sem cliente vinculado</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              list="sugestoes-descricao"
              placeholder="Ex: Criação de perfil"
              value={novo.descricao}
              onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
              className="input-field"
            />
            <datalist id="sugestoes-descricao">
              {SUGESTOES_DESCRICAO.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={novo.valor}
              onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
            <input
              type="date"
              required
              value={novo.data}
              onChange={(e) => setNovo({ ...novo, data: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={novo.status}
              onChange={(e) => setNovo({ ...novo, status: e.target.value })}
              className="input-field"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <button type="submit" disabled={salvando} className="btn-primary flex items-center gap-2">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Registrar
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mês</label>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input-field">
              <option value="">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
            <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="input-field">
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleGerarMensalidades}
          disabled={gerando}
          className="btn-secondary flex items-center gap-2"
        >
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Gerar mensalidades do mês
        </button>
      </div>

      <div className="card">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary-800" />
          Lançamentos
        </h2>
        {lancamentosFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum lançamento nesse filtro.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lancamentosFiltrados.map((l) => {
              const status = statusExibido(l)
              const meta = STATUS_META[status]
              const editando = editandoId === l.id

              if (editando) {
                return (
                  <li key={l.id} className="py-3 flex flex-wrap items-end gap-3">
                    <select
                      value={editValues.cliente_id}
                      onChange={(e) => setEditValues({ ...editValues, cliente_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Sem cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editValues.descricao}
                      onChange={(e) => setEditValues({ ...editValues, descricao: e.target.value })}
                      className="input-field flex-1 min-w-[180px]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValues.valor}
                      onChange={(e) => setEditValues({ ...editValues, valor: e.target.value })}
                      className="input-field w-28"
                    />
                    <input
                      type="date"
                      value={editValues.data}
                      onChange={(e) => setEditValues({ ...editValues, data: e.target.value })}
                      className="input-field"
                    />
                    <select
                      value={editValues.status}
                      onChange={(e) => setEditValues({ ...editValues, status: e.target.value })}
                      className="input-field"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                    </select>
                    <button
                      onClick={() => handleSaveEdit(l.id)}
                      className="text-emerald-600 hover:text-emerald-700 p-1.5"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditandoId(null)} className="text-slate-400 hover:text-slate-600 p-1.5">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                )
              }

              return (
                <li key={l.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {l.descricao}
                      {l.origem === 'mensalidade' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                          mensalidade
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(l.data)} {l.clientes?.nome ? `· ${l.clientes.nome}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-night">{exibirValor(l.valor)}</span>
                    <button
                      onClick={() => handleToggleStatus(l)}
                      className={`badge ${meta.className} cursor-pointer`}
                      title="Clique pra alternar entre pago e pendente"
                    >
                      {meta.label}
                    </button>
                    <button onClick={() => startEdit(l)} className="text-slate-400 hover:text-primary-800 p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(l.id)} className="text-red-500 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Layout>
  )
}
