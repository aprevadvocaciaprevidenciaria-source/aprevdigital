import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { ONBOARDING_SCHEMAS } from '../../../lib/onboardingSchemas'
import Logo from '../../../components/Logo'

export default function OnboardingForm() {
  const router = useRouter()
  const { clienteId, tipo } = router.query

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [form, setForm] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const schema = ONBOARDING_SCHEMAS[tipo]

  useEffect(() => {
    if (!router.isReady) return
    if (!clienteId || !schema) {
      setNotFound(true)
      setLoading(false)
      return
    }
    fetch(`/api/onboarding/cliente?clienteId=${clienteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.nome) {
          setNotFound(true)
        } else {
          setClienteNome(data.nome)
        }
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [router.isReady, clienteId, schema])

  function setCampo(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    const faltando = schema.fields.filter((f) => f.required && !String(form[f.key] || '').trim())
    if (faltando.length > 0) {
      setErro('Preencha todos os campos obrigatórios antes de enviar.')
      return
    }

    setEnviando(true)
    const res = await fetch('/api/onboarding/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId, tipo, dados: form }),
    })
    setEnviando(false)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErro(json.error || 'Não foi possível enviar. Tente novamente em alguns instantes.')
      return
    }
    setEnviado(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4">
        <div className="card max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-display font-semibold text-night mb-1">Link inválido</h1>
          <p className="text-sm text-slate-500">
            Esse link de formulário não é válido. Peça pra APREV te enviar o link correto.
          </p>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4">
        <div className="card max-w-md text-center">
          <CheckCircle2 className="w-10 h-10 text-secondary-500 mx-auto mb-3" />
          <h1 className="text-lg font-display font-semibold text-night mb-1">Respostas enviadas!</h1>
          <p className="text-sm text-slate-500">
            Obrigado, {clienteNome}! Recebemos suas informações e já vamos dar continuidade ao seu atendimento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-gradient px-4 py-10">
      <Head>
        <title>{schema.title} · APREV</title>
      </Head>
      <div className="w-full max-w-xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="rounded-xl mb-3" />
          <h1 className="text-2xl font-display font-bold text-white text-center">{schema.title}</h1>
          <p className="text-slate-300 text-sm mt-1 text-center">
            {clienteNome} · APREV
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <p className="text-sm text-slate-600">{schema.intro}</p>

          {schema.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>

              {field.type === 'textarea' && (
                <textarea
                  value={form[field.key] || ''}
                  onChange={(e) => setCampo(field.key, e.target.value)}
                  rows={3}
                  className="input-field"
                />
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  value={form[field.key] || ''}
                  onChange={(e) => setCampo(field.key, e.target.value)}
                  className="input-field"
                />
              )}

              {field.type === 'radio' && (
                <div className="flex flex-col gap-2 mt-1">
                  {field.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={field.key}
                        value={opt}
                        checked={form[field.key] === opt}
                        onChange={(e) => setCampo(field.key, e.target.value)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}

          <button type="submit" disabled={enviando} className="btn-primary w-full flex items-center justify-center gap-2">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            Enviar respostas
          </button>
        </form>
      </div>
    </div>
  )
}
