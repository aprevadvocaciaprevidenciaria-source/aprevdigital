import { createClient } from '@supabase/supabase-js'
import { generateText, tool, jsonSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getValidAccessToken } from '../../../lib/server/googleAuth'
import { extrairIdPasta, listarArquivosPasta, lerConteudoArquivo, pertenceAPasta } from '../../../lib/server/googleDrive'

// Repassa o JWT do usuário logado pro Supabase pra ler a conversa (RLS via
// sou_equipe_de garante que só vê o que é da própria equipe). Gera a
// sugestão direto com Claude (mesmo modelo usado no resto do painel) e
// grava o resultado em sugestoes_ia com o service_role - essa tabela só
// aceita insert via service role de propósito (ver migration
// 20260805000000_crm_whatsapp_ia.sql).
//
// Duas fontes de contexto, dependendo do tipo de contato:
// - Sempre: base_conhecimento_ia (playbook aprovado pelo sócio).
// - Só quando a conversa está marcada como Cliente (conversa.cliente_id) e
//   o cliente tem pasta do Drive vinculada (clientes.link_pasta_drive): o
//   histórico/documentos do caso, pelas mesmas ferramentas de Drive que a
//   extinta Maia usava (lib/server/googleDrive.js) - só que aqui a pasta
//   raiz já vem resolvida pelo cliente_id da conversa, sem precisar de uma
//   tool de busca por nome como a Maia tinha.
const SYSTEM_PROMPT = `Você é a assistente de atendimento da APREV Digital, escritório de advocacia previdenciária em Parnaíba-PI.

Sua única função aqui é sugerir, para a secretária revisar e enviar, a próxima mensagem de WhatsApp para o contato.

Regras obrigatórias:
- Baseie a resposta só na base de conhecimento aprovada e, quando disponível, nos documentos do caso do cliente. Nunca invente prazo, valor, lei ou informação sobre o caso específico.
- Nunca dê parecer jurídico: não avalie chance de êxito, valor a receber, estratégia de recurso ou qualquer julgamento sobre o caso. Isso é sempre "Fora do escopo" e deve ser escalado ao Dr.
- Se a pergunta não estiver coberta pela base de conhecimento nem pelos documentos do caso, ou for claramente "Fora do escopo", responda de forma breve confirmando o recebimento e avisando que o Dr. vai retornar - não tente responder o mérito.
- Escreva só o texto pronto pra enviar no WhatsApp: direto, cordial, sem saudação redundante se a conversa já estiver andando, sem assinatura, sem comentário sobre o que você está fazendo.`

const PASTA_MIME = 'application/vnd.google-apps.folder'

function formatarBaseConhecimento(itens) {
  if (!itens || itens.length === 0) return '(nenhum item cadastrado ainda)'
  return itens.map((i) => `[${i.categoria}] ${i.topico}\n${i.resposta_aprovada}`).join('\n\n')
}

function historicoParaMensagens(mensagens) {
  const convertidas = (mensagens || [])
    .filter((m) => m.texto)
    .map((m) => ({ role: m.direcao === 'recebida' ? 'user' : 'assistant', content: m.texto }))
  if (convertidas.length === 0) {
    convertidas.push({ role: 'user', content: 'Contato ainda sem mensagens de texto registradas.' })
  }
  return convertidas
}

function formatarItens(arquivos) {
  return arquivos.map((a) => ({
    id: a.id,
    nome: a.name,
    tipo: a.mimeType === PASTA_MIME ? 'pasta' : a.mimeType,
    modificadoEm: a.modifiedTime,
  }))
}

// Resolve a pasta raiz do Drive do cliente vinculado à conversa (se houver)
// e já lista o conteúdo dela - devolve null se a conversa não é de um
// cliente, ou se esse cliente ainda não tem pasta/conexão Google.
async function buscarContextoCliente({ supabaseUser, supabaseAdmin, clienteId }) {
  if (!clienteId) return null

  const { data: cliente } = await supabaseUser
    .from('clientes')
    .select('id, nome, user_id, link_pasta_drive')
    .eq('id', clienteId)
    .maybeSingle()
  if (!cliente?.link_pasta_drive) return null

  const raizId = extrairIdPasta(cliente.link_pasta_drive)
  if (!raizId) return null

  const accessToken = await getValidAccessToken(supabaseAdmin, cliente.user_id)
  if (!accessToken) return null

  try {
    const arquivosRaiz = await listarArquivosPasta(accessToken, raizId)
    return { cliente, raizId, accessToken, arquivosRaiz: formatarItens(arquivosRaiz) }
  } catch {
    return null
  }
}

// Ferramentas de Drive escopadas à pasta do caso já resolvida acima - ao
// contrário da Maia, não existe tool de busca por nome: a raiz já é
// conhecida (vem do cliente_id da própria conversa), então só sobra
// explorar subpastas e ler arquivos específicos, sempre validando com
// pertenceAPasta() que o item pedido está dentro da árvore do caso.
function criarFerramentasDriveCliente({ raizId, accessToken }) {
  return {
    listarSubpasta: tool({
      description:
        'Lista os itens de uma subpasta dentro da pasta do caso (a subpasta precisa ter aparecido antes na listagem raiz ou numa chamada anterior de listarSubpasta).',
      inputSchema: jsonSchema({
        type: 'object',
        properties: { pastaId: { type: 'string', description: 'id da subpasta, obtido numa listagem anterior.' } },
        required: ['pastaId'],
      }),
      execute: async ({ pastaId }) => {
        const dentro = await pertenceAPasta(accessToken, pastaId, raizId)
        if (!dentro) return { erro: 'Essa pasta não está dentro da pasta desse caso.' }
        const arquivos = await listarArquivosPasta(accessToken, pastaId)
        return { itens: formatarItens(arquivos) }
      },
    }),
    lerArquivoDrive: tool({
      description:
        'Lê o conteúdo de um arquivo do caso pelo id (obtido na listagem raiz ou em listarSubpasta). Só funciona bem pra Google Docs, Sheets e arquivos de texto puro.',
      inputSchema: jsonSchema({
        type: 'object',
        properties: { arquivoId: { type: 'string', description: 'id do arquivo, obtido na listagem raiz ou em listarSubpasta.' } },
        required: ['arquivoId'],
      }),
      execute: async ({ arquivoId }) => {
        const dentro = await pertenceAPasta(accessToken, arquivoId, raizId)
        if (!dentro) return { suportado: false, motivo: 'Esse arquivo não está dentro da pasta desse caso.' }
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

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { conversaId } = req.body || {}
  if (!conversaId) {
    return res.status(400).json({ error: 'conversaId é obrigatório.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: conversa, error: conversaError } = await supabaseUser
    .from('conversas_whatsapp')
    .select('id, user_id, nome_contato, telefone, cliente_id')
    .eq('id', conversaId)
    .single()

  if (conversaError || !conversa) {
    return res.status(404).json({ error: 'Conversa não encontrada ou sem permissão de acesso.' })
  }

  const [{ data: mensagens }, { data: baseConhecimento }, contextoCliente] = await Promise.all([
    supabaseUser
      .from('mensagens_conversa')
      .select('id, direcao, texto, enviado_em')
      .eq('conversa_id', conversaId)
      .order('enviado_em', { ascending: true })
      .limit(30),
    supabaseUser
      .from('base_conhecimento_ia')
      .select('categoria, topico, resposta_aprovada')
      .eq('ativo', true)
      .limit(30),
    buscarContextoCliente({ supabaseUser, supabaseAdmin, clienteId: conversa.cliente_id }),
  ])

  let systemPrompt = `${SYSTEM_PROMPT}\n\nContato: ${conversa.nome_contato || conversa.telefone}\n\nBase de conhecimento aprovada:\n\n${formatarBaseConhecimento(baseConhecimento)}`

  if (contextoCliente) {
    systemPrompt += `\n\nEsse contato é o cliente "${contextoCliente.cliente.nome}", com caso na pasta do Drive do escritório. Arquivos na raiz da pasta do caso:\n\n${JSON.stringify(contextoCliente.arquivosRaiz, null, 2)}\n\nUse listarSubpasta e lerArquivoDrive se precisar entrar numa subpasta ou ler um arquivo específico pra responder com precisão sobre o andamento do caso. Continua valendo: nunca dar parecer jurídico, só informar fato que estiver documentado.`
  }

  let sugestaoTexto
  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-5'),
      system: systemPrompt,
      messages: historicoParaMensagens(mensagens),
      ...(contextoCliente
        ? {
            tools: criarFerramentasDriveCliente(contextoCliente),
            stopWhen: stepCountIs(6),
          }
        : {}),
    })
    sugestaoTexto = text?.trim()
  } catch (err) {
    return res.status(502).json({ error: `Falha ao gerar sugestão: ${err.message}` })
  }

  if (!sugestaoTexto) {
    return res.status(502).json({ error: 'A IA não retornou nenhuma sugestão.' })
  }

  const ultimaMensagem = (mensagens || [])[mensagens.length - 1]
  const { data: sugestao, error: insertError } = await supabaseAdmin
    .from('sugestoes_ia')
    .insert({
      conversa_id: conversaId,
      mensagem_gatilho_id: ultimaMensagem?.id || null,
      sugestao_texto: sugestaoTexto,
    })
    .select()
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  return res.status(200).json({ sugestao })
}
