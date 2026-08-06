import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  Clock,
  Zap,
  Target,
  MessageCircle,
  BookOpen,
  Sparkles,
  Library,
  Bot,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import Logo from './Logo'

// roles: quem vê o item no menu (e pode acessar a rota). Sem "roles" = só
// sócio/dono (acesso total). 'secretaria' cobre também qualquer papel de
// colaborador que não seja sócio (gerente, colaborador genérico), como
// visão restrita padrão mais segura enquanto não houver papel específico.
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Funil de Leads', icon: Target, roles: ['secretaria'] },
  { href: '/conversas', label: 'Conversas WhatsApp', icon: MessageCircle, roles: ['secretaria'] },
  { href: '/clientes', label: 'Casos', icon: Users, roles: ['secretaria'] },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare, roles: ['secretaria'] },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/digital', label: 'Central do Digital', icon: Sparkles },
  { href: '/automacoes', label: 'Automações', icon: Zap },
  { href: '/base-conhecimento', label: 'Base de Conhecimento IA', icon: BookOpen, roles: ['secretaria'] },
  { href: '/biblioteca-ia', label: 'Biblioteca Jurídica IA', icon: Library, roles: ['secretaria'] },
  { href: '/maia', label: 'Assistente Maia', icon: Bot, roles: ['secretaria'] },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

function podeAcessar(item, papel) {
  const acessoTotal = !papel || papel === 'socio'
  if (acessoTotal) return true
  return (item.roles || []).includes('secretaria')
}

export default function Layout({ children, title }) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [papel, setPapel] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBoxRef = useRef(null)

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifTarefas, setNotifTarefas] = useState([])
  const notifBoxRef = useRef(null)

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userBoxRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user
      if (!user) return
      setUserEmail(user.email || '')
      const { data: perfil } = await supabase.from('users').select('tipo').eq('id', user.id).maybeSingle()
      if (perfil?.tipo === 'cliente') {
        router.replace('/portal')
        return
      }
      if (perfil?.tipo === 'colaborador') {
        const { data: colaborador } = await supabase
          .from('colaboradores')
          .select('papel')
          .eq('login_user_id', user.id)
          .maybeSingle()
        setPapel(colaborador?.papel || 'colaborador')
      }
    })
  }, [router])

  // Guarda de rota: se o papel logado não tem acesso a essa página, manda
  // pra primeira seção que ele pode ver. É só camada de UI - o RLS no
  // Supabase é quem garante de verdade que dado sensível não vaza.
  useEffect(() => {
    if (papel === null) return
    const itemAtual = NAV_ITEMS.find((item) => router.pathname === item.href || router.pathname.startsWith(item.href + '/'))
    if (itemAtual && !podeAcessar(itemAtual, papel)) {
      const primeiroPermitido = NAV_ITEMS.find((item) => podeAcessar(item, papel))
      router.replace(primeiroPermitido?.href || '/conversas')
    }
  }, [papel, router.pathname])

  useEffect(() => {
    async function loadNotifs() {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('tarefas')
        .select('id, titulo, vencimento, clientes(nome)')
        .neq('status', 'concluida')
        .lte('vencimento', hoje)
        .order('vencimento', { ascending: true })
        .limit(8)
      setNotifTarefas(data || [])
    }
    loadNotifs()
  }, [])

  useEffect(() => {
    const term = searchTerm.trim()
    if (term.length < 2) {
      setSearchResults([])
      return
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, nicho')
        .ilike('nome', `%${term}%`)
        .limit(6)
      setSearchResults(data || [])
    }, 300)
    return () => clearTimeout(handle)
  }, [searchTerm])

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSearchOpen(false)
      if (notifBoxRef.current && !notifBoxRef.current.contains(e.target)) setNotifOpen(false)
      if (userBoxRef.current && !userBoxRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-6 h-16 border-b border-white/10">
        <Logo size={32} />
        <span className="text-white font-display font-bold text-lg leading-tight">APREV</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.filter((item) => podeAcessar(item, papel)).map((item) => {
          const Icon = item.icon
          const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                active
                  ? 'bg-white/10 text-white border-secondary-500'
                  : 'text-slate-300 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-secondary-500' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-slate-400 truncate">{userEmail}</p>
        </div>
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

  const tarefasVencidas = notifTarefas.filter((t) => t.vencimento < new Date().toISOString().slice(0, 10))

  return (
    <div className="min-h-screen bg-fog">
      <Head>
        <title>{title ? `${title} · APREV` : 'APREV Advocacia Previdenciária'}</title>
      </Head>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-brand-gradient">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-gradient flex flex-col">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between gap-3 px-4 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-slate-600 flex-shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-display font-semibold text-night truncate">{title}</h1>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Busca global de clientes */}
            <div className="relative hidden sm:block" ref={searchBoxRef}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar caso..."
                className="w-48 lg:w-64 pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
              />
              {searchOpen && searchTerm.trim().length >= 2 && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-40">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Nenhum caso encontrado.</p>
                  ) : (
                    searchResults.map((c) => (
                      <Link
                        key={c.id}
                        href={`/clientes/${c.id}`}
                        onClick={() => {
                          setSearchOpen(false)
                          setSearchTerm('')
                        }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-primary-50 text-sm"
                      >
                        <span className="text-slate-700 font-medium">{c.nome}</span>
                        <span className="text-xs text-slate-400">{c.nicho || ''}</span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Notificações */}
            <div className="relative" ref={notifBoxRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 text-slate-500 hover:text-primary-800 hover:bg-primary-50 rounded-lg"
              >
                <Bell className="w-5 h-5" />
                {notifTarefas.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                    {notifTarefas.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-700">
                    Tarefas vencendo hoje / atrasadas
                  </div>
                  {notifTarefas.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-400">Nenhuma tarefa vencendo.</p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {notifTarefas.map((t) => (
                        <li key={t.id} className="px-4 py-2.5 border-b border-slate-50 last:border-0">
                          <p className="text-sm text-slate-700 font-medium">{t.titulo}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {t.vencimento} · {t.clientes?.nome || 'sem cliente'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {tarefasVencidas.length > 0 && (
                    <Link
                      href="/tarefas"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-sm text-primary-800 font-medium py-2.5 hover:bg-primary-50"
                    >
                      Ver todas as tarefas
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Avatar do usuário */}
            <div className="relative" ref={userBoxRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100"
              >
                <div className="w-8 h-8 rounded-full bg-primary-800 text-white flex items-center justify-center text-sm font-semibold">
                  {userEmail ? userEmail[0].toUpperCase() : '?'}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-40">
                  <p className="px-4 py-3 text-xs text-slate-400 truncate border-b border-slate-100">{userEmail}</p>
                  <Link
                    href="/configuracoes"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-primary-50"
                  >
                    <Settings className="w-4 h-4" />
                    Configurações
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>

          {mobileOpen && (
            <button className="lg:hidden text-slate-600" onClick={() => setMobileOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          )}
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
