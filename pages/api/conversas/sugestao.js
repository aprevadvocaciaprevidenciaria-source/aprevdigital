import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

// Repassa o JWT do usuário logado pro Supabase pra ler a conversa (RLS via
// sou_equipe_de garante que só vê o que é da própria equipe). Gera a
// sugestão direto com Claude (mesmo modelo usado no resto do painel),
// restrita ao conteúdo aprovado em base_conhecimento_ia, e grava o
// resultado em sugestoes_ia com o service_role - essa tabela só aceita
// insert via service role de propósito (ver migration
// 20260805000000_crm_whatsapp_ia.sql).
const SYSTEM_PROMPT = `Você é a assistente de atendimento da APREV Digital, escritório de advocacia previdenciária em Parnaíba-PI.

Sua única função aqui é sugerir, para a secretária revisar e enviar, a próxima mensagem de WhatsApp para o contato - com base exclusivamente nos itens da base de conhecimento aprovada abaixo.

Regras obrigatórias:
- Baseie a resposta só no que estiver na base de conhecimento. Nunca invente prazo, valor, lei ou informação sobre o caso específico.
- Nunca dê parecer jurídico: não avalie chance de êxito, valor a receber, estratégia de recurso ou qualquer julgamento sobre o caso. Isso é sempre "Fora do escopo" e deve ser escalado ao Dr.
- Se a pergunta não estiver coberta pela base de conhecimento, ou for claramente "Fora do escopo", responda de forma breve confirmando o recebimento e avisando que o Dr. vai retornar - não tente responder o mérito.
- Escreva só o texto pronto pra enviar no WhatsApp: direto, cordial, sem saudação redundante se a conversa já estiver andando, sem assinatura, sem comentário sobre o que você está fazendo.`

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
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: conversa, error: conversaError } = await supabaseUser
    .from('conversas_whatsapp')
    .select('id, user_id, nome_contato, telefone')
    .eq('id', conversaId)
    .single()

  if (conversaError || !conversa) {
    return res.status(404).json({ error: 'Conversa não encontrada ou sem permissão de acesso.' })
  }

  const [{ data: mensagens }, { data: baseConhecimento }] = await Promise.all([
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
  ])

  let sugestaoTexto
  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-5'),
      system: `${SYSTEM_PROMPT}\n\nContato: ${conversa.nome_contato || conversa.telefone}\n\nBase de conhecimento aprovada:\n\n${formatarBaseConhecimento(baseConhecimento)}`,
      messages: historicoParaMensagens(mensagens),
    })
    sugestaoTexto = text?.trim()
  } catch (err) {
    return res.status(502).json({ error: `Falha ao gerar sugestão: ${err.message}` })
  }

  if (!sugestaoTexto) {
    return res.status(502).json({ error: 'A IA não retornou nenhuma sugestão.' })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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
