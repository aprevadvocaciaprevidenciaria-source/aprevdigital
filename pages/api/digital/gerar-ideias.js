import { createClient } from '@supabase/supabase-js'

// Repassa o JWT do usuário logado - RLS de conteudo_digital só libera
// dono/sócio (pode_administrar), então isso já barra quem não pode aprovar
// conteúdo de marketing. Chama o webhook n8n "Sugestão de Ideias de
// Conteúdo" (Claude, mesmas regras da OAB da skill ideias-instagram) e já
// cria os cards na coluna "Ideia".
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { tema } = req.body || {}

  const n8nUrl = process.env.N8N_URL
  const n8nSecret = process.env.N8N_PAINEL_SECRET
  if (!n8nUrl || !n8nSecret) {
    return res.status(500).json({ error: 'N8N_URL ou N8N_PAINEL_SECRET não configuradas no servidor.' })
  }

  let ideias
  try {
    const resp = await fetch(`${n8nUrl}/webhook/aprevdigital-ideias-conteudo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-painel-secret': n8nSecret },
      body: JSON.stringify({ tema: tema || null }),
    })
    const data = await resp.json()
    if (!resp.ok || data.error) {
      throw new Error(data.error || `n8n retornou HTTP ${resp.status}`)
    }
    ideias = data.ideias
  } catch (err) {
    return res.status(502).json({ error: `Falha ao gerar ideias: ${err.message}` })
  }

  if (!Array.isArray(ideias) || ideias.length === 0) {
    return res.status(502).json({ error: 'A IA não retornou nenhuma ideia.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const linhas = ideias.map((ideia) => ({
    tipo: 'post',
    plataforma: 'instagram',
    titulo: ideia.gancho,
    descricao: [
      `Gancho alternativo (revisar antes de publicar): ${ideia.gancho_alternativo || '-'}`,
      '',
      `Texto médio: ${ideia.texto_medio || '-'}`,
      '',
      `CTA: ${ideia.cta || '-'}`,
      '',
      `Sugestão de imagem: ${ideia.imagem_sugestao || '-'}`,
    ].join('\n'),
    status: 'ideia',
  }))

  const { data: criados, error } = await supabase.from('conteudo_digital').insert(linhas).select()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ criados })
}
