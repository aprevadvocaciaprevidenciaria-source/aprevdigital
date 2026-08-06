import { createClient } from '@supabase/supabase-js'
import { streamText, convertToModelMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import promptFontes from '../../data/maia-system-prompt.json'

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
    responseLimit: false,
  },
}

// System prompt = concatenação do pacote "Escritório IA" (SKILL.md define a
// persona Maia; os demais arquivos são "base permanente" citada no próprio
// SKILL.md). Empacotado em data/maia-system-prompt.json e importado (em vez
// de fs.readFileSync em runtime) pro build do Next.js garantir que o
// conteúdo entra no bundle da função serverless na Vercel - mesmo raciocínio
// do data/biblioteca-ia.json.
const SYSTEM_PROMPT = Object.values(promptFontes).join('\n\n---\n\n')

async function usuarioAutenticado(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// Limite simples de mensagens/hora por usuário. Em memória (reseta a cada
// cold start) - suficiente pro MVP, já que ainda não há tabela no Supabase
// pra isso (fica pra quando as conversas forem persistidas).
const LIMITE_MENSAGENS_HORA = 30
const JANELA_MS = 60 * 60 * 1000
const historicoPorUsuario = new Map()

function dentroDoLimite(userId) {
  const agora = Date.now()
  const historico = (historicoPorUsuario.get(userId) || []).filter((t) => agora - t < JANELA_MS)
  if (historico.length >= LIMITE_MENSAGENS_HORA) {
    historicoPorUsuario.set(userId, historico)
    return false
  }
  historico.push(agora)
  historicoPorUsuario.set(userId, historico)
  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const user = await usuarioAutenticado(req)
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  if (!dentroDoLimite(user.id)) {
    return res.status(429).json({ error: 'Limite de mensagens por hora atingido. Tente novamente mais tarde.' })
  }

  const { messages } = req.body || {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages é obrigatório.' })
  }

  try {
    const result = streamText({
      model: anthropic('claude-sonnet-5'),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages.slice(-20)),
    })
    await result.pipeUIMessageStreamToResponse(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Falha ao gerar resposta da Maia.' })
    }
  }
}
