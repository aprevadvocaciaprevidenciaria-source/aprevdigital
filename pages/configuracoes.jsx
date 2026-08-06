import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Loader2,
  Save,
  User,
  Lock,
  Image as ImageIcon,
  CheckCircle2,
  Users,
  Plus,
  Trash2,
  SlidersHorizontal,
  MapPin,
  Link2,
  Unlink,
} from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

const PAGE_SIZE_KEY = 'seolocalbrasil_page_size'
const PAPEL_OPTIONS = [
  { value: 'socio', label: 'Sócio' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'secretaria', label: 'Secretária' },
  { value: 'colaborador', label: 'Colaborador' },
]

export default function Configuracoes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [email, setEmail] = useState('')
  const [accessToken, setAccessToken] = useState(null)
  const [googleStatus, setGoogleStatus] = useState({ conectado: false, email: null })
  const [conectandoGoogle, setConectandoGoogle] = useState(false)

  const [perfil, setPerfil] = useState({ nome: '', avatar_url: '', telefone_notificacao: '' })
  const [savingPerfil, setSavingPerfil] = useState(false)

  const [novaSenha, setNovaSenha] = useState('')
  const [savingSenha, setSavingSenha] = useState(false)

  const [colaboradores, setColaboradores] = useState([])
  const [novoColaborador, setNovoColaborador] = useState({ nome: '', email: '', papel: 'colaborador' })
  const [savingColaborador, setSavingColaborador] = useState(false)
  const [convidandoId, setConvidandoId] = useState(null)

  const [pageSize, setPageSize] = useState(10)

  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const user = sessionData.session.user
      setUserId(user.id)
      setEmail(user.email || '')
      setAccessToken(sessionData.session.access_token)

      const [{ data: profile }, { data: colaboradoresData }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('colaboradores').select('*').order('created_at', { ascending: false }),
      ])
      if (profile) {
        setPerfil({
          nome: profile.nome || '',
          avatar_url: profile.avatar_url || '',
          telefone_notificacao: profile.telefone_notificacao || '',
        })
      }
      setColaboradores(colaboradoresData || [])

      const storedPageSize = Number(localStorage.getItem(PAGE_SIZE_KEY))
      if (storedPageSize) setPageSize(storedPageSize)

      await carregarStatusGoogle(sessionData.session.access_token)

      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (!router.isReady) return
    const { google } = router.query
    if (google === 'conectado') showFeedback('Conta Google conectada com sucesso!')
    if (google === 'erro') showFeedback('Não foi possível conectar com o Google. Tente novamente.')
    if (google) router.replace('/configuracoes', undefined, { shallow: true })
  }, [router.isReady, router.query])

  async function carregarStatusGoogle(token) {
    const res = await fetch('/api/google/status', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json().catch(() => ({}))
    setGoogleStatus({ conectado: !!json.conectado, email: json.email })
  }

  async function handleConectarGoogle() {
    setConectandoGoogle(true)
    const res = await fetch('/api/google/iniciar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = await res.json().catch(() => ({}))
    setConectandoGoogle(false)
    if (json.url) {
      window.location.href = json.url
    } else {
      showFeedback(json.error || 'Não foi possível iniciar a conexão.')
    }
  }

  async function handleDesconectarGoogle() {
    if (!confirm('Desconectar sua conta Google Business Profile? A sincronização automática vai parar.')) return
    await fetch('/api/google/desconectar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    setGoogleStatus({ conectado: false, email: null })
    showFeedback('Conta Google desconectada.')
  }

  function showFeedback(msg) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  async function handleSavePerfil(e) {
    e.preventDefault()
    setSavingPerfil(true)
    const { error } = await supabase.from('users').update(perfil).eq('id', userId)
    setSavingPerfil(false)
    showFeedback(error ? 'Erro ao salvar perfil.' : 'Perfil atualizado com sucesso.')
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    if (!novaSenha || novaSenha.length < 6) {
      showFeedback('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setSavingSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSavingSenha(false)
    setNovaSenha('')
    showFeedback(error ? 'Erro ao atualizar senha.' : 'Senha atualizada com sucesso.')
  }

  async function handleAddColaborador(e) {
    e.preventDefault()
    if (!novoColaborador.nome.trim()) return
    setSavingColaborador(true)
    const { data, error } = await supabase
      .from('colaboradores')
      .insert([{ ...novoColaborador, user_id: userId }])
      .select()
      .single()
    setSavingColaborador(false)
    if (!error) {
      setColaboradores([data, ...colaboradores])
      setNovoColaborador({ nome: '', email: '', papel: 'colaborador' })
    } else {
      showFeedback('Erro ao adicionar colaborador.')
    }
  }

  async function handleDeleteColaborador(id) {
    if (!confirm('Remover este colaborador?')) return
    await supabase.from('colaboradores').delete().eq('id', id)
    setColaboradores(colaboradores.filter((c) => c.id !== id))
  }

  async function handleConvidarColaborador(colaborador) {
    if (!colaborador.email) {
      showFeedback('Adicione um e-mail pra esse colaborador antes de liberar o acesso.')
      return
    }
    setConvidandoId(colaborador.id)
    const res = await fetch('/api/colaboradores/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ colaboradorId: colaborador.id, email: colaborador.email }),
    })
    const json = await res.json().catch(() => ({}))
    setConvidandoId(null)
    if (!res.ok) {
      showFeedback(json.error || 'Erro ao dar acesso.')
      return
    }
    showFeedback(json.novoUsuario ? 'Convite enviado por e-mail!' : 'Acesso liberado com sucesso.')
    const { data } = await supabase.from('colaboradores').select('*').order('created_at', { ascending: false })
    setColaboradores(data || [])
  }

  function handlePageSizeChange(value) {
    setPageSize(value)
    localStorage.setItem(PAGE_SIZE_KEY, String(value))
    showFeedback('Preferência salva.')
  }

  if (loading) {
    return (
      <Layout title="Configurações">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Configurações">
      {feedback && (
        <div className="mb-6 flex items-center gap-2 bg-secondary-50 text-secondary-700 text-sm px-4 py-3 rounded-lg border border-secondary-200">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSavePerfil} className="card space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Perfil</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input value={email} disabled className="input-field bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input
              value={perfil.nome}
              onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
              className="input-field"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> URL do avatar
            </label>
            <input
              value={perfil.avatar_url}
              onChange={(e) => setPerfil({ ...perfil, avatar_url: e.target.value })}
              className="input-field"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp para avisos (leads, alertas)</label>
            <input
              value={perfil.telefone_notificacao}
              onChange={(e) => setPerfil({ ...perfil, telefone_notificacao: e.target.value })}
              className="input-field"
              placeholder="(11) 98888-7777"
            />
          </div>
          <button type="submit" disabled={savingPerfil} className="btn-primary flex items-center gap-2">
            {savingPerfil ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar perfil
          </button>
        </form>

        <form onSubmit={handleUpdatePassword} className="card space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Senha</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="input-field"
            />
          </div>
          <button type="submit" disabled={savingSenha} className="btn-primary flex items-center gap-2">
            {savingSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Atualizar senha
          </button>
        </form>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Preferências do painel</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Itens por página nas tabelas</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="input-field max-w-[160px]"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>{n} por página</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Integração com Google (Business Profile + Drive)</h2>
          </div>

          {googleStatus.conectado ? (
            <>
              <p className="text-sm text-secondary-700 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2">
                Conectado como <strong>{googleStatus.email}</strong>.
              </p>
              <p className="text-xs text-slate-400">
                A sincronização automática de métricas e avaliações ainda está sendo finalizada — por enquanto os
                dados continuam sendo lançados manualmente. O acesso ao Google Drive (pra Maia ler arquivos de
                clientes) já está ativo com essa conexão.
              </p>
              <button onClick={handleDesconectarGoogle} className="btn-secondary flex items-center gap-2 text-sm">
                <Unlink className="w-4 h-4" />
                Desconectar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Conecte a conta Google do escritório pra: sincronizar métricas/avaliações do Google Business Profile,
                e liberar a Maia pra ler arquivos do Google Drive vinculados aos clientes (aba Assistente Maia). Cada
                cliente precisa te dar acesso de "Gerente" no Google Business Profile dele antes de sincronizar.
              </p>
              <button
                onClick={handleConectarGoogle}
                disabled={conectandoGoogle}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {conectandoGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Conectar com Google
              </button>
            </>
          )}
        </div>

        <div className="card space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-800" />
            <h2 className="font-display font-semibold text-night">Colaboradores</h2>
          </div>

          <form onSubmit={handleAddColaborador} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              value={novoColaborador.nome}
              onChange={(e) => setNovoColaborador({ ...novoColaborador, nome: e.target.value })}
              placeholder="Nome"
              className="input-field sm:col-span-2"
              required
            />
            <input
              type="email"
              value={novoColaborador.email}
              onChange={(e) => setNovoColaborador({ ...novoColaborador, email: e.target.value })}
              placeholder="E-mail"
              className="input-field"
            />
            <div className="flex gap-2">
              <select
                value={novoColaborador.papel}
                onChange={(e) => setNovoColaborador({ ...novoColaborador, papel: e.target.value })}
                className="input-field"
              >
                {PAPEL_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button type="submit" disabled={savingColaborador} className="btn-primary px-3 flex-shrink-0">
                {savingColaborador ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {colaboradores.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum sócio ou colaborador cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {colaboradores.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{c.nome}</p>
                    <p className="text-xs text-slate-400">{c.email || 'sem e-mail'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge bg-primary-50 text-primary-800">
                      {PAPEL_OPTIONS.find((p) => p.value === c.papel)?.label || c.papel}
                    </span>
                    {c.login_user_id ? (
                      <span className="badge bg-secondary-50 text-secondary-700">Acesso ativo</span>
                    ) : (
                      <button
                        onClick={() => handleConvidarColaborador(c)}
                        disabled={convidandoId === c.id}
                        className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5"
                      >
                        {convidandoId === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Dar acesso
                      </button>
                    )}
                    <button onClick={() => handleDeleteColaborador(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
