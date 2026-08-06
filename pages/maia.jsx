import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Send, Loader2, ShieldAlert, Paperclip, X, FileText } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

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

export default function Maia() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [arquivos, setArquivos] = useState([])
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

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

  const { messages, sendMessage, status, error } = useChat({ transport })
  const enviando = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      setLoading(false)
    }
    init()
  }, [router])

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

    const files = arquivos.length ? await Promise.all(arquivos.map(arquivoParaFileUIPart)) : undefined
    sendMessage(texto ? { text: texto, files } : { files })
    setInput('')
    setArquivos([])
  }

  if (loading) {
    return (
      <Layout title="Assistente Maia">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Assistente Maia">
      <div className="card mb-4 bg-amber-50 border-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Ferramenta de apoio, não substitui o advogado responsável.</strong> Toda resposta é rascunho e exige
          revisão humana antes de qualquer uso ou protocolo. Não insira dados sensíveis de clientes sem necessidade.
        </p>
      </div>

      <div className="card flex flex-col h-[70vh] p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">
              Descreva o que você precisa resolver e a Maia monta a equipe.
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
            {error.message || 'Falha ao falar com a Maia. Tente novamente.'}
          </div>
        )}

        <div className="border-t border-slate-100 p-3">
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {arquivos.map((arquivo, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs bg-primary-50 text-primary-800 rounded-full pl-2.5 pr-1.5 py-1"
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="max-w-[160px] truncate">{arquivo.name}</span>
                  <button
                    type="button"
                    onClick={() => removerArquivo(i)}
                    className="text-primary-400 hover:text-primary-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={TIPOS_ACEITOS}
              onChange={adicionarArquivos}
              className="hidden"
            />
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
      </div>
    </Layout>
  )
}
