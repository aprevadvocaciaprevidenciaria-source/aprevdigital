import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Search, Loader2, Layers, ChevronRight } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { statusMeta } from '../../lib/status'

export default function GestaoLista() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, nicho, cidade, status, plano_gestao')
        .order('nome', { ascending: true })
      setClientes(data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clientes
    return clientes.filter(
      (c) => c.nome?.toLowerCase().includes(term) || c.cidade?.toLowerCase().includes(term) || c.nicho?.toLowerCase().includes(term)
    )
  }, [clientes, search])

  if (loading) {
    return (
      <Layout title="Gestão">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Gestão">
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Escolha um cliente pra ver e gerenciar métricas do GBP, calendário de posts, datas especiais, avaliações,
        fotos e termos de busca.
      </p>

      <div className="relative max-w-sm mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade ou nicho..."
          className="input-field pl-9"
        />
      </div>

      <div className="card p-0 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Layers className="w-10 h-10 mb-2" />
            <p className="text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-6 py-3 font-medium">Nicho</th>
                <th className="px-6 py-3 font-medium">Cidade</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Plano</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const meta = statusMeta(c.status)
                return (
                  <tr key={c.id} className={`border-b border-slate-50 hover:bg-primary-50/40 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-6 py-3">
                      <Link href={`/gestao/${c.id}`} className="font-medium text-slate-800 hover:text-primary-800">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{c.nicho || '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{c.cidade || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${meta.badge}`}>
                        <span className={`badge-dot ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{c.plano_gestao ? 'Gestão' : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/gestao/${c.id}`} className="inline-flex p-1.5 text-slate-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
