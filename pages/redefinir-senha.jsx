import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function RedefinirSenha() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [linkValido, setLinkValido] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // O link do e-mail já deixa uma sessão de recuperação ativa
    // (detectSessionInUrl cuida disso automaticamente).
    supabase.auth.getSession().then(({ data }) => {
      setLinkValido(!!data?.session)
      setChecking(false)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (updateError) {
      setError('Não foi possível atualizar a senha. Tente pedir um novo link.')
      return
    }
    setSucesso(true)
    setTimeout(() => router.replace('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient px-4">
      <Head>
        <title>Nova senha · APREV</title>
      </Head>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="rounded-xl mb-3" />
          <h1 className="text-2xl font-display font-bold text-white">APREV</h1>
          <p className="text-slate-300 text-sm mt-1">Definir nova senha</p>
        </div>

        <div className="card space-y-4">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
            </div>
          ) : sucesso ? (
            <div className="flex items-start gap-2 bg-secondary-50 text-secondary-700 text-sm px-3 py-3 rounded-lg border border-secondary-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Senha atualizada! Redirecionando para o login...
            </div>
          ) : !linkValido ? (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-3 py-3 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Este link é inválido ou já expirou. Peça um novo link em{' '}
              <a href="/esqueci-senha" className="underline font-medium">
                esqueci minha senha
              </a>
              .
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="input-field pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nova senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    placeholder="Repita a senha"
                    className="input-field pl-9"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar nova senha
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
