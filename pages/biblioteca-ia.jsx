import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Search, X, Copy, Check, Library, Lightbulb } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function BibliotecaIA() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)

  const [itens, setItens] = useState([])
  const [total, setTotal] = useState(0)
  const [totalGeral, setTotalGeral] = useState(0)
  const [areas, setAreas] = useState([])
  const [carregandoLista, setCarregandoLista] = useState(false)

  const [filtroArea, setFiltroArea] = useState('todas')
  const [busca, setBusca] = useState('')

  const [detalheId, setDetalheId] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setAccessToken(sessionData.session.access_token)
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!accessToken) return
    setCarregandoLista(true)
    const handle = setTimeout(async () => {
      const params = new URLSearchParams()
      if (filtroArea !== 'todas') params.set('area', filtroArea)
      if (busca.trim()) params.set('q', busca.trim())

      const res = await fetch(`/api/biblioteca-ia?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setItens(data.itens || [])
        setTotal(data.total || 0)
        setTotalGeral(data.totalGeral || 0)
        setAreas(data.areas || [])
      }
      setCarregandoLista(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [accessToken, filtroArea, busca])

  async function abrirDetalhe(id) {
    setDetalheId(id)
    setDetalhe(null)
    setCopiado(false)
    setCarregandoDetalhe(true)
    const res = await fetch(`/api/biblioteca-ia/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      setDetalhe(data.item)
    }
    setCarregandoDetalhe(false)
  }

  function fecharDetalhe() {
    setDetalheId(null)
    setDetalhe(null)
    setCopiado(false)
  }

  async function copiarPrompt() {
    if (!detalhe?.prompt) return
    await navigator.clipboard.writeText(detalhe.prompt)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const areaAtual = areas.find((a) => a.value === detalhe?.area)

  if (loading) {
    return (
      <Layout title="Biblioteca Jurídica IA">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Biblioteca Jurídica IA">
      <div className="card mb-6 bg-primary-50/60 border-primary-100 flex items-start gap-3">
        <Library className="w-5 h-5 text-primary-800 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          <strong>
            {totalGeral.toLocaleString('pt-BR')} prompts em {areas.length} áreas do Direito
          </strong>{' '}
          prontos pra usar em qualquer IA (ChatGPT, Claude, etc.). Uso interno da equipe — não redistribuir.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          className="input-field sm:w-64"
        >
          <option value="todas">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} ({a.total})
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="input-field pl-9"
          />
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        {carregandoLista ? 'Buscando...' : `${total.toLocaleString('pt-BR')} prompt${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`}
      </p>

      {!carregandoLista && itens.length === 0 ? (
        <div className="card text-center py-10 text-sm text-slate-400">Nenhum prompt encontrado com esse filtro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {itens.map((item) => {
            const meta = areas.find((a) => a.value === item.area)
            return (
              <div key={item.id} className="card flex flex-col">
                <span className="badge bg-primary-50 text-primary-800 self-start mb-2">{meta?.label || item.area}</span>
                <h3 className="font-display font-semibold text-night text-sm mb-1">{item.nome}</h3>
                <p className="text-sm text-slate-500 flex-1 line-clamp-3">{item.descricao}</p>
                <button
                  onClick={() => abrirDetalhe(item.id)}
                  className="btn-secondary text-sm mt-4 self-start"
                >
                  Ver prompt completo
                </button>
              </div>
            )
          })}
        </div>
      )}

      {detalheId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 my-auto">
            {carregandoDetalhe || !detalhe ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className="badge bg-primary-50 text-primary-800 mb-2">{areaAtual?.label || detalhe.area}</span>
                    <h2 className="font-display font-semibold text-night text-lg">{detalhe.nome}</h2>
                  </div>
                  <button onClick={fecharDetalhe} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {detalhe.quando_usar && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Quando usar</p>
                    <p className="text-sm text-slate-600">{detalhe.quando_usar}</p>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Prompt completo</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{detalhe.prompt}</p>
                  </div>
                </div>

                {detalhe.dicas?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" /> Dicas
                    </p>
                    <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                      {detalhe.dicas.map((dica, i) => (
                        <li key={i}>{dica}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button onClick={copiarPrompt} className="btn-primary flex items-center justify-center gap-2 w-full">
                  {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado ? 'Copiado!' : 'Copiar prompt'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
