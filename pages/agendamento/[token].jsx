import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Loader2, CalendarClock, CheckCircle2, XCircle } from 'lucide-react'
import Logo from '../../components/Logo'

const STATUS_LABEL = {
  pendente: 'Aguardando confirmação',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
  nao_compareceu: 'Não compareceu',
}

function formatDateStr(dataStr) {
  return new Date(`${dataStr}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function AgendamentoStatus() {
  const router = useRouter()
  const { token } = router.query

  const [loading, setLoading] = useState(true)
  const [agendamento, setAgendamento] = useState(null)
  const [erro, setErro] = useState('')
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/public/agendamento/cancelar/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setErro(json.error)
        else setAgendamento(json.agendamento)
      })
      .catch(() => setErro('Não foi possível carregar seu agendamento.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleCancelar() {
    if (!confirm('Cancelar este agendamento?')) return
    setCancelando(true)
    const res = await fetch(`/api/public/agendamento/cancelar/${token}`, { method: 'POST' })
    const json = await res.json()
    setCancelando(false)
    if (json.error) {
      setErro(json.error)
      return
    }
    setAgendamento(json.agendamento)
  }

  return (
    <div className="min-h-screen bg-fog">
      <Head>
        <title>Seu agendamento · SEO Local Brasil</title>
      </Head>
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <Logo size={32} />
          <span className="font-display font-bold text-night">SEO Local Brasil</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="card">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
            </div>
          ) : erro ? (
            <div className="text-center py-6">
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600">{erro}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-5 h-5 text-primary-800" />
                <h1 className="font-display font-semibold text-night">Seu agendamento</h1>
              </div>

              <dl className="space-y-3 mb-6">
                <div>
                  <dt className="text-xs text-slate-400">Empresa</dt>
                  <dd className="text-sm font-medium text-slate-700">{agendamento.clientes?.nome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Data e horário</dt>
                  <dd className="text-sm font-medium text-slate-700">
                    {formatDateStr(agendamento.data_agendada)} às {String(agendamento.horario_agendado).slice(0, 5)}
                  </dd>
                </div>
                {agendamento.servico && (
                  <div>
                    <dt className="text-xs text-slate-400">Serviço</dt>
                    <dd className="text-sm font-medium text-slate-700">{agendamento.servico}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-400">Status</dt>
                  <dd
                    className={`badge ${
                      agendamento.status === 'cancelado'
                        ? 'bg-red-100 text-red-700'
                        : agendamento.status === 'concluido'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {STATUS_LABEL[agendamento.status] || agendamento.status}
                  </dd>
                </div>
              </dl>

              {agendamento.status === 'cancelado' ? (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  Este agendamento foi cancelado.
                </p>
              ) : agendamento.status === 'concluido' ? (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Atendimento já concluído.
                </p>
              ) : (
                <button
                  onClick={handleCancelar}
                  disabled={cancelando}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-red-600"
                >
                  {cancelando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cancelar agendamento
                </button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
