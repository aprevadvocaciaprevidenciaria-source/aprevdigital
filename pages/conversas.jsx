import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Loader2, Plus, Send, Sparkles, Phone, X, MessageCircle, FileText, Download } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { resolveEquipeContext } from '../lib/session'
import { formatDateTime } from '../lib/format'
import { tocarSomNotificacao } from '../lib/notificationSound'

const EXT_IMAGEM = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const EXT_VIDEO = ['mp4', 'mov', '3gp', 'webm']
const EXT_AUDIO = ['ogg', 'oga', 'mp3', 'm4a', 'aac', 'opus']

function extensaoDe(url) {
  const semQuery = (url || '').split('?')[0]
  const partes = semQuery.split('.')
  return partes.length > 1 ? partes.pop().toLowerCase() : ''
}

function MensagemMidia({ url }) {
  const ext = extensaoDe(url)
  if (EXT_IMAGEM.includes(ext)) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="Imagem enviada" className="rounded-lg max-w-full max-h-64 mb-1" />
      </a>
    )
  }
  if (EXT_VIDEO.includes(ext)) {
    return <video src={url} controls className="rounded-lg max-w-full max-h-64 mb-1" />
  }
  if (EXT_AUDIO.includes(ext)) {
    return <audio src={url} controls className="mb-1 max-w-full" />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 mb-1 underline">
      <FileText className="w-4 h-4 flex-shrink-0" />
      Ver arquivo
      <Download className="w-3.5 h-3.5 flex-shrink-0" />
    </a>
  )
}

const STATUS_META = {
  aberta: { label: 'Aberta', badge: 'bg-sky-100 text-sky-700' },
  aguardando_resposta: { label: 'Aguardando', badge: 'bg-amber-100 text-amber-700' },
  resolvida: { label: 'Resolvida', badge: 'bg-emerald-100 text-emerald-700' },
  perdida: { label: 'Perdida', badge: 'bg-slate-100 text-slate-500' },
}

const EMPTY_CONVERSA = { nome_contato: '', telefone: '' }

export default function Conversas() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contexto, setContexto] = useState(null)
  const [conversas, setConversas] = useState([])
  const [conversaSelecionada, setConversaSelecionada] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [sugestao, setSugestao] = useState(null)
  const [carregandoThread, setCarregandoThread] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [gerandoSugestao, setGerandoSugestao] = useState(false)
  const [erroSugestao, setErroSugestao] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [novaConversa, setNovaConversa] = useState(EMPTY_CONVERSA)
  const [salvandoConversa, setSalvandoConversa] = useState(false)
  const bottomRef = useRef(null)
  const conversaSelecionadaRef = useRef(null)

  useEffect(() => {
    conversaSelecionadaRef.current = conversaSelecionada
  }, [conversaSelecionada])

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.replace('/login')
        return
      }
      const ctx = await resolveEquipeContext()
      setContexto(ctx)
      await carregarConversas()
      setLoading(false)
    }
    init()
  }, [router])

  // Tempo real: qualquer mensagem/conversa nova (de qualquer secretária, em
  // qualquer aba aberta) chega aqui sem precisar dar F5. Um único canal pra
  // vida inteira da página - usa a ref pra saber qual conversa está aberta
  // no momento em que o evento chega, sem precisar reabrir a inscrição toda
  // vez que a seleção muda.
  useEffect(() => {
    if (loading) return

    const canal = supabase
      .channel('conversas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_conversa' }, (payload) => {
        const nova = payload.new
        const aberta = conversaSelecionadaRef.current
        if (aberta && nova.conversa_id === aberta.id) {
          setMensagens((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev
            const idxOtimista = prev.findIndex(
              (m) => typeof m.id === 'string' && m.id.startsWith('otimista-') && m.direcao === nova.direcao && m.texto === nova.texto
            )
            if (idxOtimista >= 0) {
              const copia = [...prev]
              copia[idxOtimista] = nova
              return copia
            }
            return [...prev, nova]
          })
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
          if (nova.direcao === 'recebida') {
            // Já está com a conversa aberta na tela - marca como lida na hora
            // em vez de deixar o badge de não lidas acender à toa.
            supabase.from('conversas_whatsapp').update({ nao_lidas: 0 }).eq('id', aberta.id).then(() => {})
          }
        }
        if (nova.direcao === 'recebida') {
          tocarSomNotificacao()
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas_whatsapp' }, (payload) => {
        const linha = payload.new
        if (!linha) return
        setConversas((prev) => {
          const existe = prev.some((c) => c.id === linha.id)
          const atualizadas = existe ? prev.map((c) => (c.id === linha.id ? { ...c, ...linha } : c)) : [linha, ...prev]
          return atualizadas.sort((a, b) => new Date(b.ultima_mensagem_em || b.created_at) - new Date(a.ultima_mensagem_em || a.created_at))
        })
        if (conversaSelecionadaRef.current?.id === linha.id) {
          setConversaSelecionada((prev) => (prev ? { ...prev, ...linha } : prev))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [loading])

  async function carregarConversas() {
    const { data } = await supabase
      .from('conversas_whatsapp')
      .select('*')
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
    setConversas(data || [])
  }

  async function abrirConversa(conversa) {
    setConversaSelecionada(conversa)
    setResposta('')
    setCarregandoThread(true)
    const [{ data: msgs }, { data: sug }] = await Promise.all([
      supabase
        .from('mensagens_conversa')
        .select('*')
        .eq('conversa_id', conversa.id)
        .order('enviado_em', { ascending: true }),
      supabase
        .from('sugestoes_ia')
        .select('*')
        .eq('conversa_id', conversa.id)
        .eq('usada', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setMensagens(msgs || [])
    setSugestao(sug || null)
    setCarregandoThread(false)

    if (conversa.nao_lidas > 0) {
      await supabase.from('conversas_whatsapp').update({ nao_lidas: 0 }).eq('id', conversa.id)
      setConversas((prev) => prev.map((c) => (c.id === conversa.id ? { ...c, nao_lidas: 0 } : c)))
    }

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function usarSugestao() {
    if (!sugestao) return
    setResposta(sugestao.sugestao_texto)
    await supabase
      .from('sugestoes_ia')
      .update({ usada: true, usada_em: new Date().toISOString(), usada_por_colaborador_id: contexto?.colaboradorId || null })
      .eq('id', sugestao.id)
    setSugestao(null)
  }

  async function enviarResposta(e) {
    e.preventDefault()
    if (!resposta.trim() || !conversaSelecionada) return
    setEnviando(true)
    setErroEnvio('')

    const textoEnviado = resposta.trim()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const resp = await fetch('/api/conversas/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversaId: conversaSelecionada.id, mensagem: textoEnviado }),
    })
    const data = await resp.json().catch(() => ({}))

    if (resp.ok) {
      const agora = new Date().toISOString()
      // Mostra otimista na tela - a mensagem "de verdade" chega logo em seguida
      // via webhook da Z-API (o mesmo n8n que já grava todo o histórico), então
      // não gravamos em mensagens_conversa aqui pra não duplicar.
      setMensagens((prev) => [
        ...prev,
        { id: `otimista-${Date.now()}`, conversa_id: conversaSelecionada.id, direcao: 'enviada', remetente: 'secretaria', texto: textoEnviado, enviado_em: agora },
      ])
      setConversas((prev) =>
        prev
          .map((c) =>
            c.id === conversaSelecionada.id
              ? { ...c, ultima_mensagem_em: agora, ultima_mensagem_preview: textoEnviado.slice(0, 140), status: 'aberta' }
              : c
          )
          .sort((a, b) => new Date(b.ultima_mensagem_em || b.created_at) - new Date(a.ultima_mensagem_em || a.created_at))
      )
      setResposta('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } else {
      setErroEnvio(data?.error || 'Falha ao enviar a mensagem pelo WhatsApp.')
    }
    setEnviando(false)
  }

  async function gerarSugestao() {
    if (!conversaSelecionada || gerandoSugestao) return
    setGerandoSugestao(true)
    setErroSugestao('')

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const resp = await fetch('/api/conversas/sugestao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversaId: conversaSelecionada.id }),
    })
    const data = await resp.json().catch(() => ({}))

    if (resp.ok) {
      setSugestao(data.sugestao)
    } else {
      setErroSugestao(data?.error || 'Falha ao gerar sugestão.')
    }
    setGerandoSugestao(false)
  }

  async function atualizarStatusConversa(status) {
    if (!conversaSelecionada) return
    await supabase.from('conversas_whatsapp').update({ status }).eq('id', conversaSelecionada.id)
    setConversaSelecionada({ ...conversaSelecionada, status })
    setConversas((prev) => prev.map((c) => (c.id === conversaSelecionada.id ? { ...c, status } : c)))
  }

  async function handleNovaConversa(e) {
    e.preventDefault()
    if (!novaConversa.telefone.trim() || !contexto?.donoUserId) return
    setSalvandoConversa(true)
    const { data, error } = await supabase
      .from('conversas_whatsapp')
      .insert([
        {
          user_id: contexto.donoUserId,
          nome_contato: novaConversa.nome_contato.trim() || null,
          telefone: novaConversa.telefone.trim(),
          status: 'aberta',
        },
      ])
      .select()
      .single()
    setSalvandoConversa(false)
    if (!error) {
      setConversas((prev) => [data, ...prev])
      setNovaConversa(EMPTY_CONVERSA)
      setMostrarForm(false)
      abrirConversa(data)
    }
  }

  if (loading) {
    return (
      <Layout title="Conversas WhatsApp">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-800 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Conversas WhatsApp">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-8rem)]">
        {/* Lista de conversas */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-night text-sm">Conversas</h2>
            <button onClick={() => setMostrarForm((v) => !v)} className="p-1.5 text-primary-800 hover:bg-primary-50 rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {mostrarForm && (
            <form onSubmit={handleNovaConversa} className="p-3 border-b border-slate-100 space-y-2 bg-slate-50">
              <input
                placeholder="Nome do contato"
                value={novaConversa.nome_contato}
                onChange={(e) => setNovaConversa({ ...novaConversa, nome_contato: e.target.value })}
                className="input-field text-sm"
              />
              <input
                placeholder="WhatsApp (com DDD)"
                value={novaConversa.telefone}
                onChange={(e) => setNovaConversa({ ...novaConversa, telefone: e.target.value })}
                className="input-field text-sm"
                required
              />
              <button type="submit" disabled={salvandoConversa} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                {salvandoConversa && <Loader2 className="w-4 h-4 animate-spin" />}
                Iniciar conversa
              </button>
            </form>
          )}

          <div className="flex-1 overflow-y-auto">
            {conversas.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Nenhuma conversa ainda. Assim que o WhatsApp da APREV for conectado (Z-API), as conversas caem aqui automaticamente.
              </div>
            ) : (
              conversas.map((c) => {
                const meta = STATUS_META[c.status] || STATUS_META.aberta
                const ativa = conversaSelecionada?.id === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => abrirConversa(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-primary-50/50 transition-colors ${
                      ativa ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-slate-700 truncate">{c.nome_contato || c.telefone}</p>
                      {c.nao_lidas > 0 && (
                        <span className="w-5 h-5 rounded-full bg-secondary-500 text-primary-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {c.nao_lidas}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{c.ultima_mensagem_preview || c.telefone}</p>
                    <span className={`badge ${meta.badge} mt-1.5`}>{meta.label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="card p-0 overflow-hidden flex flex-col">
          {!conversaSelecionada ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-6 text-center">
              Selecione uma conversa à esquerda pra ver o histórico e responder.
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-display font-semibold text-night">{conversaSelecionada.nome_contato || 'Sem nome'}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {conversaSelecionada.telefone}
                  </p>
                </div>
                <select
                  value={conversaSelecionada.status}
                  onChange={(e) => atualizarStatusConversa(e.target.value)}
                  className="input-field text-sm w-auto"
                >
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {carregandoThread ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 text-primary-800 animate-spin" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-10">Sem mensagens registradas ainda nessa conversa.</p>
                ) : (
                  mensagens.map((m) => (
                    <div key={m.id} className={`flex ${m.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          m.direcao === 'enviada' ? 'bg-primary-800 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.midia_url && <MensagemMidia url={m.midia_url} />}
                        {m.texto && <p className="whitespace-pre-wrap">{m.texto}</p>}
                        <p className={`text-[10px] mt-1 ${m.direcao === 'enviada' ? 'text-primary-200' : 'text-slate-400'}`}>
                          {formatDateTime(m.enviado_em)}
                          {m.remetente === 'ia' && ' · IA'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {sugestao ? (
                <div className="mx-4 mb-3 p-3 rounded-xl border border-secondary-300 bg-secondary-50 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-secondary-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-secondary-700 mb-0.5">Sugestão da IA</p>
                    <p className="text-sm text-slate-700">{sugestao.sugestao_texto}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={usarSugestao} className="btn-accent text-xs px-2.5 py-1">
                      Usar
                    </button>
                    <button onClick={() => setSugestao(null)} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mx-4 mb-3 flex items-center justify-between gap-2">
                  <button
                    onClick={gerarSugestao}
                    disabled={gerandoSugestao}
                    className="text-xs flex items-center gap-1.5 text-secondary-700 hover:text-secondary-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
                  >
                    {gerandoSugestao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {gerandoSugestao ? 'Gerando sugestão...' : 'Gerar sugestão da IA'}
                  </button>
                  {erroSugestao && <p className="text-xs text-red-600">{erroSugestao}</p>}
                </div>
              )}

              {erroEnvio && (
                <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                  {erroEnvio}
                </div>
              )}

              <form onSubmit={enviarResposta} className="p-3 border-t border-slate-100 flex items-end gap-2">
                <textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Escreva a resposta..."
                  rows={2}
                  className="input-field flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      enviarResposta(e)
                    }
                  }}
                />
                <button type="submit" disabled={enviando || !resposta.trim()} className="btn-primary flex items-center gap-1.5 h-fit">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
