import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Trash2, CalendarHeart, ChevronDown } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import { dataAplicaAoCliente } from '../lib/datasEspeciais'
import { notificarClientes } from '../lib/notificacoes'

const EMPTY = { data: '', nome: '', cidades: '' }

export default function DatasEspeciais() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [datas, setDatas] = useState([])
  const [clientesGestao, setClientesGestao] = useState([])
  const [respostas, setRespostas] = useState([])
  const [novo, setNovo] = useState(EMPTY)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(null)

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
    const [{ data: datasData }, { data: clientesData }, { data: respostasData }] = await Promise.all([
      supabase.from('datas_especiais').select('*').order('data', { ascending: true }),
      supabase.from('clientes').select('id, nome, cidade').eq('plano_gestao', true).order('nome', { ascending: true }),
      supabase.from('datas_especiais_respostas').select('*'),
    ])
    setDatas(datasData || [])
    setClientesGestao(clientesData || [])
    setRespostas(respostasData || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!novo.data || !novo.nome.trim()) return
    setSalvando(true)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const nome = novo.nome.trim()
    const cidades = novo.cidades.trim() || null
    await supabase.from('datas_especiais').insert({
      user_id: session.user.id,
      data: novo.data,
      nome,
      cidades,
    })
    setNovo(EMPTY)
    await carregar()
    setSalvando(false)

    const clientesAvisar = clientesGestao.filter((c) => dataAplicaAoCliente({ cidades }, c.cidade))
    if (clientesAvisar.length > 0) {
      notificarClientes(session.access_token, {
        clienteIds: clientesAvisar.map((c) => c.id),
        title: 'Nova data especial 📅',
        body: `Confirme se você vai fechar em "${nome}" (${formatDate(novo.data)}).`,
        url: '/portal',
      })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta data especial? As respostas dos clientes pra ela também serão apagadas.')) return
    await supabase.from('datas_especiais').delete().eq('id', id)
    await carregar()
  }

  async function handleResposta(dataEspecialId, clienteId, vaiFechar) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('datas_especiais_respostas').upsert(
      {
        user_id: user.id,
        cliente_id: clienteId,
        data_especial_id: dataEspecialId,
        vai_fechar: vaiFechar,
        respondido_por: 'admin',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cliente_id,data_especial_id' }
    )
    await carregar()
  }

  function respostaDe(dataEspecialId, clienteId) {
    return respostas.find((r) => r.data_especial_id === dataEspecialId && r.cliente_id === clienteId)
  }

  if (loading) {
    return (
      <Layout title="Datas especiais">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Datas especiais">
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Cadastre feriados e eventos locais (aniversário da cidade, feriados municipais, etc.). Clientes do plano
        Gestão veem essas datas no portal deles e confirmam se vão fechar ou funcionar normal — pra você manter o
        horário do perfil no Google sempre certo.
      </p>

      <form onSubmit={handleAdd} className="card flex flex-wrap items-end gap-3 mb-8">
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
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do feriado/evento</label>
          <input
            type="text"
            required
            placeholder="Ex: Aniversário da cidade"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            className="input-field"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Cidade(s) (opcional)</label>
          <input
            type="text"
            placeholder="Ex: Parnaíba, Luís Correia — vazio vale pra todas"
            value={novo.cidades}
            onChange={(e) => setNovo({ ...novo, cidades: e.target.value })}
            className="input-field"
          />
        </div>
        <button type="submit" disabled={salvando} className="btn-primary flex items-center gap-2">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Adicionar
        </button>
      </form>

      <div className="card">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <CalendarHeart className="w-5 h-5 text-primary-800" />
          Datas cadastradas
        </h2>
        {datas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma data especial cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {datas.map((d) => {
              const expandido = aberto === d.id
              const clientesDaData = clientesGestao.filter((c) => dataAplicaAoCliente(d, c.cidade))
              const pendentes = clientesDaData.filter((c) => !respostaDe(d.id, c.id)).length
              return (
                <li key={d.id} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={() => setAberto(expandido ? null : d.id)}
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >
                      <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{d.nome}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(d.data)} · {d.cidades ? d.cidades : 'todas as cidades'}
                          {clientesDaData.length > 0 && (
                            <> · {pendentes > 0 ? `${pendentes} cliente(s) sem resposta` : 'todos os clientes responderam'}</>
                          )}
                        </p>
                      </div>
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-600 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {expandido && (
                    <div className="mt-3 ml-7 space-y-2">
                      {clientesDaData.length === 0 ? (
                        <p className="text-xs text-slate-400">Nenhum cliente do plano Gestão nessa(s) cidade(s) ainda.</p>
                      ) : (
                        clientesDaData.map((c) => {
                          const resposta = respostaDe(d.id, c.id)
                          return (
                            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                              <span className="text-sm text-slate-700">{c.nome}</span>
                              {resposta ? (
                                <span
                                  className={`badge ${resposta.vai_fechar ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
                                >
                                  {resposta.vai_fechar ? 'Vai fechar' : 'Funciona normal'}
                                  {resposta.respondido_por === 'cliente' ? ' · respondido pelo cliente' : ' · você marcou'}
                                </span>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleResposta(d.id, c.id, true)}
                                    className="text-xs px-2.5 py-1 rounded-full border border-slate-300 hover:bg-white"
                                  >
                                    Vai fechar
                                  </button>
                                  <button
                                    onClick={() => handleResposta(d.id, c.id, false)}
                                    className="text-xs px-2.5 py-1 rounded-full border border-slate-300 hover:bg-white"
                                  >
                                    Funciona normal
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Layout>
  )
}
