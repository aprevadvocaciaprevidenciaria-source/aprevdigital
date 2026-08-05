import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Gift, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

const STATUS_META = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  contatado: { label: 'Contatado', className: 'bg-sky-100 text-sky-700' },
  convertido: { label: 'Convertido', className: 'bg-emerald-100 text-emerald-700' },
  descartado: { label: 'Descartado', className: 'bg-slate-100 text-slate-500' },
}

export default function Indicacoes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [indicacoes, setIndicacoes] = useState([])

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
    const { data } = await supabase
      .from('indicacoes')
      .select('*, clientes(nome)')
      .order('created_at', { ascending: false })
    setIndicacoes(data || [])
  }

  async function handleStatusChange(id, status) {
    await supabase.from('indicacoes').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await carregar()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir essa indicação?')) return
    await supabase.from('indicacoes').delete().eq('id', id)
    await carregar()
  }

  if (loading) {
    return (
      <Layout title="Indicações">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Indicações">
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">
        Indicações que seus clientes mandaram pelo portal ("Indique e ganhe"). Marque como "Convertido" quando
        fechar negócio com o indicado, pra lembrar de aplicar o desconto/mês grátis combinado pro cliente que
        indicou.
      </p>

      <div className="card">
        <h2 className="font-display font-semibold text-night mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary-800" />
          Indicações recebidas
        </h2>
        {indicacoes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma indicação recebida ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {indicacoes.map((i) => (
              <li key={i.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{i.nome_indicado}</p>
                  <p className="text-xs text-slate-400">
                    {i.whatsapp_indicado} · indicado por {i.clientes?.nome || 'cliente removido'} ·{' '}
                    {formatDateTime(i.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={i.status}
                    onChange={(e) => handleStatusChange(i.id, e.target.value)}
                    className={`badge cursor-pointer border-0 ${STATUS_META[i.status]?.className || ''}`}
                  >
                    {Object.entries(STATUS_META).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleDelete(i.id)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
