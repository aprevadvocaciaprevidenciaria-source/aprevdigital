import { createClient } from '@supabase/supabase-js'
import { streamText, convertToModelMessages, tool, jsonSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import promptFontes from '../../data/maia-system-prompt.json'
import { getValidAccessToken } from '../../lib/server/googleAuth'
import { extrairIdPasta, listarArquivosPasta, lerConteudoArquivo, pertenceAPasta } from '../../lib/server/googleDrive'

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
// "Maia" é nome de persona interno do pacote comprado - o painel apresenta
// essa IA pro usuário como "APREV Digital" (item de menu, título de página),
// então instrui o modelo a se referir a si mesma por esse nome, sem reescrever
// o pacote inteiro (que usa "Maia" internamente em várias partes do prompt).
const SYSTEM_PROMPT =
  Object.values(promptFontes).join('\n\n---\n\n') +
  '\n\n---\n\nInstrução do painel: ao se apresentar ou se referir a si mesma na conversa, use o nome "APREV ' +
  'Digital", não "Maia". "Maia" é um nome de projeto interno e não deve aparecer nas respostas pro usuário.'

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

const PASTA_MIME = 'application/vnd.google-apps.folder'

function formatarItens(arquivos) {
  return arquivos.map((a) => ({
    id: a.id,
    nome: a.name,
    tipo: a.mimeType === PASTA_MIME ? 'pasta' : a.mimeType,
    modificadoEm: a.modifiedTime,
  }))
}

// Acha o cliente pelo nome (via cliente RLS-escopado por sou_equipe_de, nunca
// direto por um user_id que o modelo poderia inventar) e resolve o token do
// Google do "dono" dessa linha + o id da pasta raiz vinculada a ele. Toda tool
// de Drive passa por aqui primeiro - é o único lugar que decide qual pasta
// raiz cada cliente enxerga.
async function resolverClienteEPasta({ supabaseUser, supabaseAdmin, nomeCliente }) {
  const { data: clientes, error } = await supabaseUser
    .from('clientes')
    .select('id, nome, user_id, link_pasta_drive')
    .ilike('nome', `%${nomeCliente}%`)
    .limit(5)

  if (error) return { erro: error.message }
  if (!clientes || clientes.length === 0) {
    return { erro: `Nenhum cliente com nome parecido com "${nomeCliente}".` }
  }
  if (clientes.length > 1) {
    return { erro: 'Mais de um cliente bateu com esse nome, peça pra pessoa especificar qual.', candidatos: clientes.map((c) => c.nome) }
  }

  const cliente = clientes[0]
  if (!cliente.link_pasta_drive) {
    return { erro: 'Esse cliente ainda não tem pasta do Drive vinculada (cadastra em Casos > editar > Pasta do Google Drive).' }
  }
  const raizId = extrairIdPasta(cliente.link_pasta_drive)
  if (!raizId) {
    return { erro: 'O link de pasta cadastrado pra esse cliente não parece válido.' }
  }
  const accessToken = await getValidAccessToken(supabaseAdmin, cliente.user_id)
  if (!accessToken) {
    return { erro: 'Ninguém conectou uma conta Google em Configurações ainda, então não dá pra acessar o Drive.' }
  }
  return { cliente, raizId, accessToken }
}

// Ferramentas de Google Drive da Maia: buscar a pasta raiz do cliente (linkada
// em clientes.link_pasta_drive), abrir uma subpasta dentro dela, e ler o
// conteúdo de um arquivo. Tanto listarSubpasta quanto lerArquivoDrive
// verificam com pertenceAPasta() que o id pedido está mesmo dentro da árvore
// da pasta raiz do cliente antes de acessar - mesmo que o token do Drive
// (escopo readonly) tecnicamente enxergasse mais coisa na conta conectada, a
// Maia só consegue navegar dentro da pasta configurada pra cada cliente.
function criarFerramentasDrive({ supabaseUser, supabaseAdmin }) {
  return {
    buscarPastaCliente: tool({
      description:
        'Busca o cliente/caso pelo nome e lista os itens da pasta raiz do Google Drive vinculada a ele (arquivos ' +
        'e subpastas). Use antes de ler um arquivo ou entrar numa subpasta. Se um item listado for do tipo ' +
        '"pasta", use listarSubpasta pra ver o que tem dentro dela.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          nomeCliente: { type: 'string', description: 'Nome (ou parte do nome) do cliente/caso a procurar.' },
        },
        required: ['nomeCliente'],
      }),
      execute: async ({ nomeCliente }) => {
        const resolvido = await resolverClienteEPasta({ supabaseUser, supabaseAdmin, nomeCliente })
        if (resolvido.erro) return resolvido

        const arquivos = await listarArquivosPasta(resolvido.accessToken, resolvido.raizId)
        return { encontrado: true, cliente: resolvido.cliente.nome, pastaId: resolvido.raizId, itens: formatarItens(arquivos) }
      },
    }),
    listarSubpasta: tool({
      description:
        'Lista os itens de uma subpasta dentro da pasta do cliente (a subpasta precisa ter aparecido antes numa ' +
        'chamada de buscarPastaCliente ou listarSubpasta pro mesmo cliente).',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          nomeCliente: { type: 'string', description: 'Nome do cliente/caso dono da pasta, o mesmo usado em buscarPastaCliente.' },
          pastaId: { type: 'string', description: 'id da subpasta, obtido numa listagem anterior.' },
        },
        required: ['nomeCliente', 'pastaId'],
      }),
      execute: async ({ nomeCliente, pastaId }) => {
        const resolvido = await resolverClienteEPasta({ supabaseUser, supabaseAdmin, nomeCliente })
        if (resolvido.erro) return resolvido

        const dentro = await pertenceAPasta(resolvido.accessToken, pastaId, resolvido.raizId)
        if (!dentro) return { erro: 'Essa pasta não está dentro da pasta desse cliente.' }

        const arquivos = await listarArquivosPasta(resolvido.accessToken, pastaId)
        return { encontrado: true, cliente: resolvido.cliente.nome, pastaId, itens: formatarItens(arquivos) }
      },
    }),
    lerArquivoDrive: tool({
      description:
        'Lê o conteúdo de um arquivo específico do Google Drive pelo id (obtido em buscarPastaCliente ou ' +
        'listarSubpasta). Só funciona bem para Google Docs, Google Sheets e arquivos de texto puro.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          nomeCliente: { type: 'string', description: 'Nome do cliente/caso dono do arquivo, o mesmo usado em buscarPastaCliente.' },
          arquivoId: { type: 'string', description: 'id do arquivo, obtido em buscarPastaCliente ou listarSubpasta.' },
        },
        required: ['nomeCliente', 'arquivoId'],
      }),
      execute: async ({ nomeCliente, arquivoId }) => {
        const resolvido = await resolverClienteEPasta({ supabaseUser, supabaseAdmin, nomeCliente })
        if (resolvido.erro) return resolvido

        const dentro = await pertenceAPasta(resolvido.accessToken, arquivoId, resolvido.raizId)
        if (!dentro) return { suportado: false, motivo: 'Esse arquivo não está dentro da pasta desse cliente.' }

        try {
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${arquivoId}?fields=id,name,mimeType,webViewLink,parents`,
            { headers: { Authorization: `Bearer ${resolvido.accessToken}` } }
          )
          if (!metaRes.ok) return { suportado: false, motivo: `Não achei esse arquivo no Drive (HTTP ${metaRes.status}).` }
          const meta = await metaRes.json()
          return await lerConteudoArquivo(resolvido.accessToken, meta)
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
      // Um pouco mais de margem que antes: com subpasta, um pedido pode
      // precisar de várias idas (raiz -> subpasta -> arquivo) antes da
      // resposta final.
      stopWhen: stepCountIs(10),
    })
    await result.pipeUIMessageStreamToResponse(res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Falha ao gerar resposta da APREV Digital.' })
    }
  }
}
