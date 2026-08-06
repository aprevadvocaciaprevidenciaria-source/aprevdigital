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

  const phoneOriginal = String(body.phone || '')
  // O WhatsApp às vezes manda um "LID" (identificador de privacidade novo,
  // formato "123456@lid") no lugar do telefone de verdade, pro mesmo contato
  // - dependendo de como a mensagem chegou (ex: através de um anúncio ou
  // dispositivo vinculado). Sem isso, o mesmo cliente vira duas conversas
  // diferentes no painel.
  const ehLid = phoneOriginal.includes('@lid')
  let telefone = phoneOriginal.replace(/\D/g, '')
  if (!telefone) {
    return res.status(200).json({ ok: true, ignorado: true })
  }

  // Mídia: a Z-API manda um objeto por tipo (image.imageUrl, video.videoUrl,
  // audio.audioUrl, document.documentUrl, sticker.stickerUrl), cada um com
  // legenda opcional em .caption. Guardamos a URL em midia_url; o front decide
  // como renderizar (imagem/vídeo/áudio/link) pela extensão do arquivo.
  const midia = body.image || body.video || body.audio || body.document || body.sticker || null
  const midiaUrl = midia?.imageUrl || midia?.videoUrl || midia?.audioUrl || midia?.documentUrl || midia?.stickerUrl || null
  const legendasPorTipo = { image: '📷 Foto', video: '🎥 Vídeo', audio: '🎤 Áudio', document: '📄 Documento', sticker: '🎨 Figurinha' }
  const tipoMidia = body.image ? 'image' : body.video ? 'video' : body.audio ? 'audio' : body.document ? 'document' : body.sticker ? 'sticker' : null

  const texto = body.text?.message || body.body || midia?.caption || null
  if (!texto && !midiaUrl) {
    return res.status(200).json({ ok: true, ignorado: true })
  }

  const fromMe = !!body.fromMe
  const messageId = body.messageId || body.id || null
  const nomeContato = body.chatName || body.senderName || null
  const momento = body.momment ? new Date(Number(body.momment)) : new Date()
  const preview = texto || (tipoMidia ? legendasPorTipo[tipoMidia] : '[mídia]')

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
  const { data: dono, error: erroDono } = await supabaseAdmin
    .from('users')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (erroDono) {
    return res.status(500).json({ error: `Falha ao consultar users: ${erroDono.message}` })
  }
  if (!dono) {
    return res.status(500).json({ error: 'Nenhum usuário dono cadastrado no painel (consulta OK, mas veio vazia - confira se SUPABASE_SERVICE_ROLE_KEY é mesmo a service_role e não a anon).' })
  }

  let { data: conversa } = await supabaseAdmin
    .from('conversas_whatsapp')
    .select('id, nao_lidas')
    .eq('user_id', dono.id)
    .eq('telefone', telefone)
    .maybeSingle()

  // Se veio de um LID e ainda não existe conversa pra esse LID específico,
  // tenta juntar com uma conversa já existente do mesmo nome de contato (que
  // provavelmente tem o telefone de verdade) em vez de criar uma segunda.
  if (!conversa && ehLid && nomeContato) {
    const { data: porNome } = await supabaseAdmin
      .from('conversas_whatsapp')
      .select('id, nao_lidas')
      .eq('user_id', dono.id)
      .eq('nome_contato', nomeContato)
      .maybeSingle()
    if (porNome) conversa = porNome
  }

  if (!conversa) {
    // Tenta já nascer vinculada a um caso (cliente) ou lead existente pelo
    // telefone - cliente tem prioridade (se virou cliente, o lead antigo já
    // cumpriu seu papel). Isso é o que alimenta o filtro Leads/Clientes na
    // tela de Conversas.
    const [{ data: clienteMatch }, { data: leadMatch }] = await Promise.all([
      supabaseAdmin.from('clientes').select('id').eq('user_id', dono.id).eq('contato_whatsapp', telefone).maybeSingle(),
      supabaseAdmin.from('leads').select('id').eq('user_id', dono.id).eq('telefone', telefone).maybeSingle(),
    ])

    const { data: novaConversa, error: erroConversa } = await supabaseAdmin
      .from('conversas_whatsapp')
      .insert({
        user_id: dono.id,
        telefone,
        nome_contato: nomeContato,
        status: 'aberta',
        cliente_id: clienteMatch?.id || null,
        lead_id: !clienteMatch && leadMatch ? leadMatch.id : null,
      })
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
    texto: texto || (midiaUrl ? null : '[mídia recebida]'),
    midia_url: midiaUrl,
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
