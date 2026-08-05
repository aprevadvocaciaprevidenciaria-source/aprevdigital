import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Save, ChevronDown, ChevronUp, CalendarClock, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/format'
import { dataAplicaAoCliente } from '../../lib/datasEspeciais'
import { notificarClientes } from '../../lib/notificacoes'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY_NOVA_DATA = { nome: '', data: '', cidades: '' }

export default function DatasEspeciais({ clienteId, userId, cidadeCliente, planoGestao, accessToken }) {
  const [datas, setDatas] = useState([])
  const [respostas, setRespostas] = useState({})
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({})
  const [salvandoId, setSalvandoId] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [novaData, setNovaData] = useState(EMPTY_NOVA_DATA)
  const [salvandoNova, setSalvandoNova] = useState(false)
  const [mostrarPassadas, setMostrarPassadas] = useState(false)

  useEffect(() => {
    load()
  }, [clienteId])

  async function load() {
    setLoading(true)
    const [{ data: datasData }, { data: respostasData }] = await Promise.all([
      supabase.from('datas_especiais').select('*').order('data', { ascending: true }),
      supabase.from('datas_especiais_respostas').select('*').eq('cliente_id', clienteId),
    ])
    const relevantes = (datasData || []).filter((d) => dataAplicaAoCliente(d, cidadeCliente))
    setDatas(relevantes)
    const map = {}
    for (const r of respostasData || []) map[r.data_especial_id] = r
    setRespostas(map)
    setDrafts(
      Object.fromEntries(
        relevantes.map((d) => [
          d.id,
          {
            vai_fechar: map[d.id]?.vai_fechar ?? false,
            horario_alternativo: map[d.id]?.horario_alternativo || '',
          },
        ])
      )
    )
    setLoading(false)
  }

  async function handleSalvarResposta(dataEspecialId) {
    setSalvandoId(dataEspecialId)
    const draft = drafts[dataEspecialId]
    const payload = {
      cliente_id: clienteId,
      user_id: userId,
      data_especial_id: dataEspecialId,
      vai_fechar: draft.vai_fechar,
      horario_alternativo: draft.vai_fechar ? null : draft.horario_alternativo?.trim() || null,
      respondido_por: 'admin',
      updated_at: new Date().toISOString(),
    }
    const { data } = await supabase
      .from('datas_especiais_respostas')
      .upsert(payload, { onConflict: 'cliente_id,data_especial_id' })
      .select()
      .single()
    if (data) setRespostas({ ...respostas, [dataEspecialId]: data })
    setSalvandoId(null)
  }

  async function handleCriarData(e) {
    e.preventDefault()
    if (!novaData.nome.trim() || !novaData.data) return
    setSalvandoNova(true)
    const cidades = novaData.cidades.trim() || null
    const { data } = await supabase
      .from('datas_especiais')
      .insert([{ user_id: userId, nome: novaData.nome.trim(), data: novaData.data, cidades }])
      .select()
      .single()
    setSalvandoNova(false)
    if (data) {
      if (dataAplicaAoCliente(data, cidadeCliente)) {
        setDatas([...datas, data].sort((a, b) => a.data.localeCompare(b.data)))
        setDrafts({ ...drafts, [data.id]: { vai_fechar: false, horario_alternativo: '' } })
      }
      setNovaData(EMPTY_NOVA_DATA)
      setMostrarForm(false)
      if (planoGestao && accessToken) {
        notificarClientes(accessToken, {
          clienteIds: [clienteId],
          title: 'Nova data especial 📅',
          body: `Confirme se você vai fechar em "${data.nome}" (${formatDate(data.data)}).`,
          url: '/portal',
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="card flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
      </div>
    )
  }

  const hoje = todayStr()
  const proximas = datas.filter((d) => d.data >= hoje)
  const passadas = datas.filter((d) => d.data < hoje)

  function renderLinha(d) {
    const draft = drafts[d.id] || { vai_fechar: false, horario_alternativo: '' }
    const respondida = !!respostas[d.id]
    return (
      <li key={d.id} className="border border-slate-100 rounded-lg p-3">
        <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{d.nome}</span>
            <span className="text-xs text-slate-400">{formatDate(d.data)}</span>
          </div>
          {respondida && (
            <span className={`badge ${respostas[d.id].vai_fechar ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {respostas[d.id].vai_fechar ? 'Vai fechar' : 'Funciona normal'}
              {respostas[d.id].respondido_por === 'cliente' ? ' · respondido pelo cliente' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={draft.vai_fechar}
              onChange={(e) => setDrafts({ ...drafts, [d.id]: { ...draft, vai_fechar: e.target.checked } })}
            />
            Vai fechar / não funcionar normalmente
          </label>
          {!draft.vai_fechar && (
            <input
              placeholder="Horário alternativo (opcional)"
              value={draft.horario_alternativo}
              onChange={(e) => setDrafts({ ...drafts, [d.id]: { ...draft, horario_alternativo: e.target.value } })}
              className="input-field text-sm flex-1 min-w-[180px]"
            />
          )}
          <button
            onClick={() => handleSalvarResposta(d.id)}
            disabled={salvandoId === d.id}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            {salvandoId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-display font-semibold text-night">Datas especiais</h2>
        <Link href="/datas-especiais" className="text-xs text-primary-800 font-medium flex items-center gap-1 hover:underline">
          Ver todos os clientes do plano Gestão
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Feriados e datas comemorativas relevantes pra {cidadeCliente || 'este cliente'}.
        {planoGestao
          ? ' Como ele é do plano Gestão, o cliente também vê e pode responder isso no portal dele.'
          : ' Esse cliente não é do plano Gestão, então só a agência registra a resposta aqui (não aparece no portal dele).'}
      </p>

      <div className="mb-4">
        <button onClick={() => setMostrarForm((v) => !v)} className="btn-secondary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova data especial
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleCriarData} className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
          <input
            placeholder="Nome (ex: Dia dos Pais)"
            value={novaData.nome}
            onChange={(e) => setNovaData({ ...novaData, nome: e.target.value })}
            className="input-field flex-1 min-w-[160px]"
            required
          />
          <input
            type="date"
            value={novaData.data}
            onChange={(e) => setNovaData({ ...novaData, data: e.target.value })}
            className="input-field"
            required
          />
          <input
            placeholder="Cidades (opcional, separadas por vírgula - vazio vale pra todas)"
            value={novaData.cidades}
            onChange={(e) => setNovaData({ ...novaData, cidades: e.target.value })}
            className="input-field flex-1 min-w-[220px]"
          />
          <button type="submit" disabled={salvandoNova} className="btn-primary flex items-center gap-2">
            {salvandoNova && <Loader2 className="w-4 h-4 animate-spin" />}
            Adicionar
          </button>
        </form>
      )}

      {proximas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma data especial relevante pra este cliente ainda.</p>
      ) : (
        <ul className="space-y-2 mb-4">{proximas.map(renderLinha)}</ul>
      )}

      {passadas.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarPassadas((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-2"
          >
            {mostrarPassadas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {mostrarPassadas ? 'Ocultar' : 'Ver'} datas passadas ({passadas.length})
          </button>
          {mostrarPassadas && <ul className="space-y-2">{passadas.map(renderLinha)}</ul>}
        </div>
      )}
    </div>
  )
}
