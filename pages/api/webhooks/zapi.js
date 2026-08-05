import { createClient } from '@supabase/supabase-js'

// Rota pública (sem sessão) - configurada como webhook "Ao receber"/"Ao enviar"
// na Z-API. Protegida por um segredo simples na query string (?secret=...)
// porque fica exposta na internet e qualquer POST sem o segredo certo é
// recusado antes de tocar no banco.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const secret = process.env.ZAPI_WEBHOOK_SECRET
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  const body = req.body || {}

  let telefone = String(body.phone || '').replace(/\D/g, '')
  if (!telefone) {
    return res.status(200).json({ ok: true, ignorado: true })
  }

  // Só tratamos mensagem de texto por enquanto; mídia (imagem/áudio/documento)
  // ainda entra na conversa como um marcador, pra não sumir da linha do tempo.
  const texto = body.text?.message || body.body || null
  const temMidia = !!(body.image || body.audio || body.document || body.video || body.sticker)
  if (!texto && !temMidia) {
    return res.status(200).json({ ok: true, ignorado: true })
  }

  const fromMe = !!body.fromMe
  const messageId = body.messageId || body.id || null
  const nomeContato = body.chatName || body.senderName || null
  const momento = body.momment ? new Date(Number(body.momment)) : new Date()
  const preview = texto || '[mídia]'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // App de escritório único por enquanto: toda conversa cai na conta do
  // primeiro usuário cadastrado (o dono da APREV) - mesmo padrão já usado em
  // pages/api/leads/capturar.js.
  const { data: dono } = await supabaseAdmin
    .from('users')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!dono) {
    return res.status(500).json({ error: 'Nenhum usuário dono cadastrado no painel.' })
  }

  let { data: conversa } = await supabaseAdmin
    .from('conversas_whatsapp')
    .select('id, nao_lidas')
    .eq('user_id', dono.id)
    .eq('telefone', telefone)
    .maybeSingle()

  if (!conversa) {
    const { data: novaConversa, error: erroConversa } = await supabaseAdmin
      .from('conversas_whatsapp')
      .insert({ user_id: dono.id, telefone, nome_contato: nomeContato, status: 'aberta' })
      .select('id, nao_lidas')
      .single()
    if (erroConversa) {
      return res.status(500).json({ error: erroConversa.message })
    }
    conversa = novaConversa
  }

  const atualizacaoConversa = {
    ultima_mensagem_em: momento.toISOString(),
    ultima_mensagem_preview: preview,
    updated_at: new Date().toISOString(),
  }
  if (nomeContato) atualizacaoConversa.nome_contato = nomeContato
  if (fromMe) {
    atualizacaoConversa.status = 'aberta'
  } else {
    atualizacaoConversa.nao_lidas = (conversa.nao_lidas || 0) + 1
    atualizacaoConversa.status = 'aguardando_resposta'
  }

  await supabaseAdmin.from('conversas_whatsapp').update(atualizacaoConversa).eq('id', conversa.id)

  const { error: erroMensagem } = await supabaseAdmin.from('mensagens_conversa').insert({
    conversa_id: conversa.id,
    direcao: fromMe ? 'enviada' : 'recebida',
    remetente: fromMe ? 'secretaria' : 'contato',
    texto: texto || '[mídia recebida]',
    message_id_externo: messageId,
    enviado_em: momento.toISOString(),
    lida: fromMe,
  })

  // message_id_externo é unique na tabela - se a Z-API reenviar o mesmo
  // webhook (acontece de vez em quando), o insert falha por duplicidade e
  // isso é esperado, não um erro real.
  if (erroMensagem && erroMensagem.code !== '23505') {
    return res.status(500).json({ error: erroMensagem.message })
  }

  return res.status(200).json({ ok: true })
}
