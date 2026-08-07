import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from '../../../lib/server/googleAuth'
import { extrairIdPasta, listarArquivosPasta, pertenceAPasta } from '../../../lib/server/googleDrive'

const PASTA_MIME = 'application/vnd.google-apps.folder'

function formatarItens(arquivos) {
  return arquivos
    .map((a) => ({
      id: a.id,
      nome: a.name,
      tipo: a.mimeType === PASTA_MIME ? 'pasta' : a.mimeType,
      link: a.webViewLink || null,
      modificadoEm: a.modifiedTime,
    }))
    .sort((a, b) => {
      if (a.tipo === 'pasta' && b.tipo !== 'pasta') return -1
      if (a.tipo !== 'pasta' && b.tipo === 'pasta') return 1
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
}

// Lista a pasta do Drive de um cliente (raiz ou uma subpasta), pra secretária
// folhear os documentos do caso direto na tela de atendimento (Conversas),
// sem precisar sair do painel nem passar pela IA. Mesmas ferramentas de Drive
// (lib/server/googleDrive.js) que a sugestão de resposta usa em
// pages/api/conversas/sugestao.js, só que aqui é navegação simples, sem IA.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { clienteId, pastaId } = req.query
  if (!clienteId) {
    return res.status(400).json({ error: 'clienteId é obrigatório.' })
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

  const { data: cliente, error: clienteError } = await supabaseUser
    .from('clientes')
    .select('id, nome, user_id, link_pasta_drive')
    .eq('id', clienteId)
    .maybeSingle()

  if (clienteError || !cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado ou sem permissão de acesso.' })
  }
  if (!cliente.link_pasta_drive) {
    return res.status(404).json({ error: 'Esse cliente ainda não tem pasta do Drive vinculada.' })
  }

  const raizId = extrairIdPasta(cliente.link_pasta_drive)
  if (!raizId) {
    return res.status(400).json({ error: 'O link de pasta cadastrado pra esse cliente não parece válido.' })
  }

  const accessToken = await getValidAccessToken(supabaseAdmin, cliente.user_id)
  if (!accessToken) {
    return res.status(400).json({ error: 'Ninguém conectou uma conta Google em Configurações ainda.' })
  }

  let pastaAlvo = raizId
  if (pastaId && pastaId !== raizId) {
    const dentro = await pertenceAPasta(accessToken, pastaId, raizId)
    if (!dentro) {
      return res.status(403).json({ error: 'Essa pasta não está dentro da pasta desse cliente.' })
    }
    pastaAlvo = pastaId
  }

  try {
    const arquivos = await listarArquivosPasta(accessToken, pastaAlvo)
    return res.status(200).json({
      cliente: { id: cliente.id, nome: cliente.nome },
      raizId,
      pastaAtualId: pastaAlvo,
      itens: formatarItens(arquivos),
    })
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Falha ao listar arquivos do Drive.' })
  }
}
