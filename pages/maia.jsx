import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Send, Loader2, ShieldAlert, Paperclip, X, FileText, Plus, MessageCircle } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { resolveEquipeContext } from '../lib/session'

// SKILL.md define o formato "[AGENTE — FUNÇÃO]" pra marcar troca de
// especialista dentro da resposta da Maia. Parseamos essas linhas pra
// renderizar como badge em vez de texto corrido.
const HEADER_REGEX = /^\[([^—\]]+?)\s*[—-]\s*([^\]]+?)\]\s*$/
const TIPOS_ACEITOS = '.pdf,.doc,.docx,.txt,image/*'

function arquivoParaFileUIPart(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () =>
      resolve({ type: 'file', mediaType: arquivo.type || 'application/octet-stream', filename: arquivo.name, url: leitor.result })
    leitor.onerror = reject
    leitor.readAsDataURL(arquivo)
  })
}

function blocosDaMensagem(texto) {
  const blocos = []
  let textoAtual = []

  function fecharTexto() {
    const conteudo = textoAtual.join('\n').trim()
    if (conteudo) blocos.push({ tipo: 'texto', conteudo })
    textoAtual = []
  }

  for (const linha of texto.split('\n')) {
    const match = linha.match(HEADER_REGEX)
    if (match) {
      fecharTexto()
      blocos.push({ tipo: 'agente', nome: match[1].trim(), funcao: match[2].trim() })
    } else {
      textoAtual.push(linha)
    }
  }
  fecharTexto()
  return blocos
}

function textoDaMensagem(uiMessage) {
  return uiMessage.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim()
}

async function carregarMensagens(conversaId) {
  const { data } = await supabase
    .from('mensagens_maia')
    .select('*')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
  return (data || []).map((m) => ({ id: m.id, role: m.papel, parts: [{ type: 'text', text: m.conteudo || '' }] }))
}

// Painel de chat isolado: remonta (via key, no componente pai) toda vez que
// o usuário troca de conversa ou clica em "Nova conversa" - assim o
// useChat sempre começa com o histórico certo, sem precisar sincronizar
// estado entre conversas na mão.
function ChatPanel({ conversaInicialId, mensagensIniciais, donoUserId, onConversaCriada }) {
  const [input, setInput] = useState('')
  const [arquivos, setArquivos] = useState([])
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const conversaIdRef = useRef(conversaInicialId)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/maia',
        headers: async () => {
          const { data } = await supabase.auth.getSession()
          return data?.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}
        },
      }),
    []
  )

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: mensagensIniciais,
    onFinish: async ({ message }) => {
      const conversaId = conversaIdRef.current
      const texto = textoDaMensagem(message)
      if (!conversaId || !texto) return
      await supabase.from('mensagens_maia').insert({ conversa_id: conversaId, papel: 'assistant', conteudo: texto })
      await supabase.from('conversas_maia').update({ updated_at: new Date().toISOString() }).eq('id', conversaId)
    },
  })
  const enviando = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function adicionarArquivos(e) {
    const novos = Array.from(e.target.files || [])
    setArquivos((prev) => [...prev, ...novos])
    e.target.value = ''
  }

  function removerArquivo(indice) {
    setArquivos((prev) => prev.filter((_, i) => i !== indice))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const texto = input.trim()
    if ((!texto && arquivos.length === 0) || enviando) return

    let conversaId = conversaIdRef.current
    if (!conversaId) {
      const titulo = (texto || arquivos[0]?.name || 'Nova conversa').slice(0, 60)
      const { data } = await supabase.from('conversas_maia').insert({ user_id: donoUserId, titulo }).select().single()
      if (data) {
        conversaId = data.id
        conversaIdRef.current = conversaId
        onConversaCriada(data)
      }
    }

    if (conversaId) {
      const conteudo = texto || `[Anexo: ${arquivos.map((a) => a.name).join(', ')}]`
      await supabase.from('mensagens_maia').insert({ conversa_id: conversaId, papel: 'user', conteudo })
      await supabase.from('conversas_maia').update({ updated_at: new Date().toISOString() }).eq('id', conversaId)
    }

    const files = arquivos.length ? await Promise.all(arquivos.map(arquivoParaFileUIPart)) : undefined
    sendMessage(texto ? { text: texto, files } : { files })
    setInput('')
    setArquivos([])
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            Descreva o que você precisa resolver e a APREV Digital monta a equipe.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm space-y-2 ${
                  m.role === 'user' ? 'bg-primary-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {m.parts.some((p) => p.type === 'file') && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.parts
                      .filter((p) => p.type === 'file')
                      .map((p, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
                            m.role === 'user' ? 'bg-white/15 text-white' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          {p.filename || 'arquivo'}
                        </span>
                      ))}
                  </div>
                )}
                {m.parts
                  .filter((p) => p.type === 'text')
                  .flatMap((p) => blocosDaMensagem(p.text))
                  .map((bloco, i) =>
                    bloco.tipo === 'agente' ? (
                      <span key={i} className="badge bg-secondary-100 text-secondary-700 font-semibold block w-fit">
                        {bloco.nome} — {bloco.funcao}
                      </span>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">
                        {bloco.conteudo}
                      </p>
                    )
                  )}
              </div>
            </div>
          ))
        )}
        {status === 'submitted' && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
          {error.message || 'Falha ao falar com a APREV Digital. Tente novamente.'}
        </div>
      )}

      <div className="border-t border-slate-100 p-3">
        {arquivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {arquivos.map((arquivo, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-primary-50 text-primary-800 rounded-full pl-2.5 pr-1.5 py-1">
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="max-w-[160px] truncate">{arquivo.name}</span>
                <button type="button" onClick={() => removerArquivo(i)} className="text-primary-400 hover:text-primary-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" multiple accept={TIPOS_ACEITOS} onChange={adicionarArquivos} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={enviando}
            title="Anexar documento ou imagem"
            className="btn-secondary px-2.5 h-fit"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva sua demanda..."
            rows={2}
            className="input-field flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <button
            type="submit"
            disabled={enviando || (!input.trim() && arquivos.length === 0)}
            className="btn-primary flex items-center gap-1.5 h-fit"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </>
  )
}

export default function Maia() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contexto, setContexto] = useState(null)
  const [conversas, setConversas] = useState([])
  const [conversaSelecionada, setConversaSelecionada] = useState(null)
  const [mensagensIniciais, setMensagensIniciais] = useState([])
  const [chatKey, setChatKey] = useState('nova')
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const ctx = await resolveEquipeContext()
      setContexto(ctx)

      const { data } = await supabase.from('conversas_maia').select('*').order('updated_at', { ascending: false })
      const lista = data || []
      setConversas(lista)

      if (lista.length > 0) {
        setConversaSelecionada(lista[0])
        setMensagensIniciais(await carregarMensagens(lista[0].id))
        setChatKey(lista[0].id)
      }

      setLoading(false)
    }
    init()
  }, [router])

  async function selecionarConversa(conversa) {
    if (conversa.id === conversaSelecionada?.id) return
    setCarregandoMensagens(true)
    const msgs = await carregarMensagens(conversa.id)
    setConversaSelecionada(conversa)
    setMensagensIniciais(msgs)
    setChatKey(conversa.id)
    setCarregandoMensagens(false)
  }

  function novaConversa() {
    setConversaSelecionada(null)
    setMensagensIniciais([])
    setChatKey(`nova-${Date.now()}`)
  }

  function handleConversaCriada(novaLinha) {
    setConversas((prev) => [novaLinha, ...prev])
    setConversaSelecionada(novaLinha)
  }

  if (loading) {
    return (
      <Layout title="APREV Digital">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="APREV Digital">
      <div className="card mb-4 bg-amber-50 border-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Ferramenta de apoio, não substitui o advogado responsável.</strong> Toda resposta é rascunho e exige
          revisão humana antes de qualquer uso ou protocolo. Não insira dados sensíveis de clientes sem necessidade.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[70vh]">
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-night text-sm">Conversas</h2>
            <button onClick={novaConversa} className="p-1.5 text-primary-800 hover:bg-primary-50 rounded-lg" title="Nova conversa">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversas.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Nenhuma conversa ainda.
              </div>
            ) : (
              conversas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selecionarConversa(c)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-primary-50/50 text-sm truncate transition-colors ${
                    conversaSelecionada?.id === c.id ? 'bg-primary-50 text-primary-800 font-medium' : 'text-slate-600'
                  }`}
                >
                  {c.titulo || 'Conversa sem título'}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card flex flex-col p-0 overflow-hidden">
          {carregandoMensagens ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
            </div>
          ) : (
            <ChatPanel
              key={chatKey}
              conversaInicialId={conversaSelecionada?.id || null}
              mensagensIniciais={mensagensIniciais}
              donoUserId={contexto?.donoUserId}
              onConversaCriada={handleConversaCriada}
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
