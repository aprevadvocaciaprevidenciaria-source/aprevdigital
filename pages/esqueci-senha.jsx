import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setLoading(false)
    if (resetError) {
      setError('Não foi possível enviar o e-mail. Tente novamente em instantes.')
      return
    }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4">
      <Head>
        <title>Recuperar senha · APREV</title>
      </Head>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="rounded-xl mb-3" />
          <h1 className="text-2xl font-display font-bold text-white">APREV</h1>
          <p className="text-slate-300 text-sm mt-1">Recuperar acesso à sua conta</p>
        </div>

        <div className="card space-y-4">
          {enviado ? (
            <div className="flex items-start gap-2 bg-secondary-50 text-secondary-700 text-sm px-3 py-3 rounded-lg border border-secondary-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Se existir uma conta com o e-mail <strong>{email}</strong>, você vai receber um link para
                redefinir sua senha.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-night">Esqueci minha senha</h2>
              <p className="text-sm text-slate-500">
                Informe o e-mail da sua conta. Vamos te enviar um link para criar uma nova senha.
              </p>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    className="input-field pl-9"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar link de recuperação
              </button>
            </form>
          )}

          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-primary-800 hover:text-primary-900 pt-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
