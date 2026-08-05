import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { LogOut, Bell, BellRing, Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { pushSuportado, getInscricaoAtual, ativarNotificacoes, desativarNotificacoes } from '../lib/pushClient'
import Logo from './Logo'

// tabs: [{ value, label, icon }] - quando informado, renderiza o menu
// lateral (mesmo padrão do painel do gestor) em vez da barra de abas
// horizontal antiga.
export default function PortalLayout({ children, clienteNome, tabs, activeTab, onTabChange }) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accessToken, setAccessToken] = useState(null)
  const [notifAtivas, setNotifAtivas] = useState(false)
  const [notifCarregando, setNotifCarregando] = useState(false)
  // Começa sempre false (bate com o HTML gerado no servidor, que não tem
  // como saber se o navegador suporta push) - só vira true depois de montar,
  // pra não causar erro de hidratação (mesmo motivo pelo qual pushSuportado()
  // nunca é chamado direto no JSX).
  const [suportaPush, setSuportaPush] = useState(false)

  useEffect(() => {
    setSuportaPush(pushSuportado())
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data?.session?.access_token
      if (!token) return
      setAccessToken(token)
      if (pushSuportado()) {
        const inscricao = await getInscricaoAtual().catch(() => null)
        setNotifAtivas(!!inscricao)
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleToggleNotif() {
    if (!accessToken || notifCarregando) return
    setNotifCarregando(true)
    try {
      if (notifAtivas) {
        await desativarNotificacoes(accessToken)
        setNotifAtivas(false)
      } else {
        await ativarNotificacoes(accessToken)
        setNotifAtivas(true)
      }
    } catch (err) {
      alert(err.message || 'Não foi possível atualizar as notificações.')
    }
    setNotifCarregando(false)
  }

  const tituloAtual = tabs?.find((t) => t.value === activeTab)?.label || clienteNome || 'Portal do cliente'

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-6 h-16 border-b border-white/10">
        <Logo size={32} />
        <div className="min-w-0">
          <p className="text-white font-display font-bold text-sm leading-tight truncate">
            {clienteNome || 'Portal do cliente'}
          </p>
          <p className="text-xs text-slate-400 leading-tight">APREV Advocacia Previdenciária</p>
        </div>
      </div>

      {tabs && (
        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.value
            return (
              <button
                key={t.value}
                onClick={() => {
                  onTabChange(t.value)
                  setMobileOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                  active
                    ? 'bg-white/10 text-white border-secondary-500'
                    : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-secondary-500' : ''}`} />
                {t.label}
              </button>
            )
          })}
        </nav>
      )}

      <div className="px-3 py-4 border-t border-white/10 mt-auto">
        {suportaPush && (
          <button
            onClick={handleToggleNotif}
            disabled={notifCarregando}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            {notifAtivas ? <BellRing className="w-5 h-5 text-secondary-500" /> : <Bell className="w-5 h-5" />}
            {notifAtivas ? 'Notificações ativas' : 'Ativar notificações'}
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-fog">
      <Head>
        <title>{clienteNome ? `${clienteNome} · APREV` : 'Portal do cliente · APREV'}</title>
      </Head>

      {/* Menu lateral (desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-brand-gradient">{SidebarContent}</aside>

      {/* Menu lateral (mobile, sobreposto) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-gradient flex flex-col">{SidebarContent}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between gap-3 px-4 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-slate-600 flex-shrink-0" onClick={() => setMobileOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-display font-semibold text-night truncate">{tituloAtual}</h1>
          </div>
          {mobileOpen && (
            <button className="lg:hidden text-slate-600" onClick={() => setMobileOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          )}
        </header>

        <main className="p-4 lg:p-8 max-w-5xl mx-auto">{children}</main>
      </div>
    </div>
  )
}
