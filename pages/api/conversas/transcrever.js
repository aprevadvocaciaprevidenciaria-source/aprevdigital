import { createClient } from '@supabase/supabase-js'

// Transcreve um áudio de mensagem do WhatsApp sob demanda (botão na mensagem,
// não automático - decisão do usuário pra não gastar em áudio que ninguém vai
// pedir). Claude não escuta áudio direto, então usa a API de transcrição da
// OpenAI (Whisper) como passo intermediário: baixa o áudio do Z-API, manda
// pro Whisper, e grava o texto reconhecido direto em mensagens_conversa.texto
// - assim a transcrição aparece na tela igual uma mensagem de texto normal, e
// o workflow de sugestão de resposta (n8n) passa a "ver" o que foi dito no
// áudio de graça, já que ele já lê esse mesmo campo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { mensagemId } = req.body || {}
  if (!mensagemId) {
    return res.status(400).json({ error: 'mensagemId é obrigatório.' })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: mensagem, error: mensagemError } = await supabaseUser
    .from('mensagens_conversa')
    .select('id, midia_url, texto')
    .eq('id', mensagemId)
    .single()

  if (mensagemError || !mensagem) {
    return res.status(404).json({ error: 'Mensagem não encontrada ou sem permissão de acesso.' })
  }
  if (!mensagem.midia_url) {
    return res.status(400).json({ error: 'Essa mensagem não tem áudio pra transcrever.' })
  }

  try {
    const audioRes = await fetch(mensagem.midia_url)
    if (!audioRes.ok) {
      return res.status(502).json({ error: `Falha ao baixar o áudio (HTTP ${audioRes.status}).` })
    }
    const audioBuffer = await audioRes.arrayBuffer()
    const mimeType = audioRes.headers.get('content-type') || 'audio/ogg'

    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })
    const whisperData = await whisperRes.json()
    if (!whisperRes.ok) {
      return res.status(502).json({ error: whisperData.error?.message || `Whisper retornou HTTP ${whisperRes.status}.` })
    }

    const transcricao = (whisperData.text || '').trim()
    if (!transcricao) {
      return res.status(502).json({ error: 'A transcrição voltou vazia.' })
    }

    const textoFinal = `🎤 ${transcricao}`
    const { error: updateError } = await supabaseUser
      .from('mensagens_conversa')
      .update({ texto: textoFinal })
      .eq('id', mensagemId)

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({ texto: textoFinal })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Falha ao transcrever o áudio.' })
  }
}
