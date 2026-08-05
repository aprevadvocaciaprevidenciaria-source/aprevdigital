import { createClient } from '@supabase/supabase-js'

// Repassa o JWT do usuário logado pro Supabase pra ler a conversa (RLS via
// sou_equipe_de garante que só vê o que é da própria equipe). Chama o n8n
// (workflow "APREV Digital — Sugestão de Resposta") pra gerar o texto com
// Claude, e grava o resultado em sugestoes_ia com o service_role - essa
// tabela só aceita insert via service role de propósito (ver migration
// 20260805000000_crm_whatsapp_ia.sql).
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

  const n8nUrl = process.env.N8N_URL
  const n8nSecret = process.env.N8N_PAINEL_SECRET
  if (!n8nUrl || !n8nSecret) {
    return res.status(500).json({ error: 'N8N_URL ou N8N_PAINEL_SECRET não configuradas no servidor.' })
  }

  let sugestaoTexto
  try {
    const resp = await fetch(`${n8nUrl}/webhook/aprevdigital-sugestao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-painel-secret': n8nSecret },
      body: JSON.stringify({
        nomeContato: conversa.nome_contato,
        historico: mensagens || [],
        baseConhecimento: baseConhecimento || [],
      }),
    })
    const data = await resp.json()
    if (!resp.ok || data.error) {
      throw new Error(data.error || `n8n retornou HTTP ${resp.status}`)
    }
    sugestaoTexto = data.sugestao
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
