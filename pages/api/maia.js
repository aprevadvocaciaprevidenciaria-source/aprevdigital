import { createClient } from '@supabase/supabase-js'
import { streamText, convertToModelMessages, tool, jsonSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import promptFontes from '../../data/maia-system-prompt.json'
import { getValidAccessToken } from '../../lib/server/googleAuth'
import { extrairIdPasta, listarArquivosPasta, lerConteudoArquivo } from '../../lib/server/googleDrive'

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

// Ferramentas de Google Drive da Maia: buscar a pasta do cliente (linkada em
// clientes.link_pasta_drive) e ler o conteúdo de um arquivo específico dela.
// `supabaseUser` já é escopado pelo JWT de quem está conversando, então o
// RLS de sou_equipe_de() garante que só acha clientes da própria equipe. O
// token do Drive é sempre o do "dono" da linha do cliente (quem conectou o
// Google em Configurações), não o do usuário logado - equipe usa o Google
// conectado do escritório, igual já acontece com o Business Profile.
function criarFerramentasDrive({ supabaseUser, supabaseAdmin }) {
  return {
    buscarPastaCliente: tool({
      description:
        'Busca o cliente/caso pelo nome e lista os arquivos da pasta do Google Drive vinculada a ele. ' +
        'Use antes de tentar ler o conteúdo de um arquivo específico do cliente.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          nomeCliente: { type: 'string', description: 'Nome (ou parte do nome) do cliente/caso a procurar.' },
        },
        required: ['nomeCliente'],
      }),
      execute: async ({ nomeCliente }) => {
        const { data: clientes, error } = await supabaseUser
          .from('clientes')
          .select('id, nome, user_id, link_pasta_drive')
          .ilike('nome', `%${nomeCliente}%`)
          .limit(5)

        if (error) return { erro: error.message }
        if (!clientes || clientes.length === 0) {
          return { encontrado: false, motivo: `Nenhum cliente com nome parecido com "${nomeCliente}".` }
        }
        if (clientes.length > 1) {
          return {
            encontrado: false,
            motivo: 'Mais de um cliente bateu com esse nome, peça pra pessoa especificar qual.',
            candidatos: clientes.map((c) => c.nome),
          }
        }

        const cliente = clientes[0]
        if (!cliente.link_pasta_drive) {
          return { encontrado: true, cliente: cliente.nome, temPasta: false, motivo: 'Esse cliente ainda não tem pasta do Drive vinculada (cadastra em Casos > editar > Pasta do Google Drive).' }
        }

        const folderId = extrairIdPasta(cliente.link_pasta_drive)
        if (!folderId) {
          return { encontrado: true, cliente: cliente.nome, temPasta: false, motivo: 'O link de pasta cadastrado pra esse cliente não parece válido.' }
        }

        const accessToken = await getValidAccessToken(supabaseAdmin, cliente.user_id)
        if (!accessToken) {
          return { encontrado: true, cliente: cliente.nome, temPasta: true, motivo: 'Ninguém conectou uma conta Google em Configurações ainda, então não dá pra acessar o Drive.' }
        }

        const arquivos = await listarArquivosPasta(accessToken, folderId)
        return {
          encontrado: true,
          cliente: cliente.nome,
          temPasta: true,
          arquivos: arquivos.map((a) => ({ id: a.id, nome: a.name, tipo: a.mimeType, modificadoEm: a.modifiedTime })),
        }
      },
    }),
    lerArquivoDrive: tool({
      description:
        'Lê o conteúdo de um arquivo específico do Google Drive pelo id (use buscarPastaCliente antes pra achar o id). ' +
        'Só funciona bem para Google Docs, Google Sheets e arquivos de texto puro.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          nomeCliente: { type: 'string', description: 'Nome do cliente/caso dono do arquivo, o mesmo usado em buscarPastaCliente.' },
          arquivoId: { type: 'string', description: 'id do arquivo, obtido em buscarPastaCliente.' },
        },
        required: ['nomeCliente', 'arquivoId'],
      }),
      execute: async ({ nomeCliente, arquivoId }) => {
        // Não confia num user_id vindo do modelo pra buscar o token do Google -
        // re-resolve o cliente pelo nome via cliente RLS-escopado (sou_equipe_de),
        // assim só acessa o Drive de um dono que a própria equipe já enxerga.
        const { data: cliente } = await supabaseUser
          .from('clientes')
          .select('id, nome, user_id')
          .ilike('nome', `%${nomeCliente}%`)
          .limit(1)
          .maybeSingle()

        if (!cliente) return { suportado: false, motivo: `Nenhum cliente com nome parecido com "${nomeCliente}".` }

        const accessToken = await getValidAccessToken(supabaseAdmin, cliente.user_id)
        if (!accessToken) return { suportado: false, motivo: 'Conta Google não conectada.' }

        try {
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${arquivoId}?fields=id,name,mimeType,webViewLink,parents`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (!metaRes.ok) return { suportado: false, motivo: `Não achei esse arquivo no Drive (HTTP ${metaRes.status}).` }
          const meta = await metaRes.json()
          return await lerConteudoArquivo(accessToken, meta)
        } catch (err) {
          return { suportado: false, motivo: err.message || 'Falha ao ler o arquivo.' }
        }
      },
    }),
  }
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

  const supabaseUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const result = streamText({
      model: anthropic('claude-sonnet-5'),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages.slice(-20)),
      tools: criarFerramentasDrive({ supabaseUser, supabaseAdmin }),
      stopWhen: stepCountIs(6),
    })
    await result.pipeUIMessageStreamToResponse(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Falha ao gerar resposta da Maia.' })
    }
  }
}
