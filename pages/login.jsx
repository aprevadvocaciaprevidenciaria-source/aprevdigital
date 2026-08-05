import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { resolveHomeRoute } from '../lib/session'
import Logo from '../components/Logo'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) router.replace(await resolveHomeRoute())
    })
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setLoading(false)
      setError('E-mail ou senha inválidos. Tente novamente.')
      return
    }

    router.push(await resolveHomeRoute())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4">
      <Head>
        <title>Entrar · APREV</title>
      </Head>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="rounded-xl mb-3" />
          <h1 className="text-2xl font-display font-bold text-white">APREV</h1>
          <p className="text-slate-300 text-sm mt-1">Dr. Fábio Araújo · Advocacia Previdenciária</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-display font-semibold text-night">Entrar na sua conta</h2>

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-9"
              />
            </div>
            <Link href="/esqueci-senha" className="block text-right text-xs text-primary-800 hover:text-primary-900 mt-1.5">
              Esqueci minha senha
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-300 mt-6">
          Acesso restrito à APREV Advocacia Previdenciária
        </p>
      </div>
    </div>
  )
}
