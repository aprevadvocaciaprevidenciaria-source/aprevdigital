import { createClient } from '@supabase/supabase-js'

// Gera (ou completa) a checklist de documentos de um caso a partir do
// modelo ativo pro tipo de benefício escolhido. Roda com o token do próprio
// usuário (RLS via sou_equipe_de garante que só mexe em cliente da própria
// equipe) - o índice único (cliente_id, nome_documento) em documentos_cliente
// faz o insert ignorar item que já existe, então chamar de novo (ex: depois
// do sócio acrescentar um documento novo no modelo) só adiciona o que
// faltava, nunca duplica nem reseta status já marcado como recebido.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  const { clienteId, tipoBeneficio } = req.body || {}
  if (!clienteId || !tipoBeneficio) {
    return res.status(400).json({ error: 'clienteId e tipoBeneficio são obrigatórios.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cliente, error: clienteError } = await supabaseUser
    .from('clientes')
    .select('id, user_id')
    .eq('id', clienteId)
    .maybeSingle()
  if (clienteError || !cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado ou sem permissão de acesso.' })
  }

  const { data: modelo, error: modeloError } = await supabaseUser
    .from('documentos_checklist')
    .select('nome_documento')
    .eq('tipo_beneficio', tipoBeneficio)
    .eq('ativo', true)
    .order('ordem')
  if (modeloError) {
    return res.status(500).json({ error: modeloError.message })
  }
  if (!modelo || modelo.length === 0) {
    return res.status(400).json({ error: 'Não há documentos ativos cadastrados pra esse tipo de benefício ainda.' })
  }

  const { error: insertError } = await supabaseUser
    .from('documentos_cliente')
    .upsert(
      modelo.map((m) => ({ user_id: cliente.user_id, cliente_id: clienteId, nome_documento: m.nome_documento })),
      { onConflict: 'cliente_id,nome_documento', ignoreDuplicates: true }
    )
  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  const { data: itens, error: listError } = await supabaseUser
    .from('documentos_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at')
  if (listError) {
    return res.status(500).json({ error: listError.message })
  }

  return res.status(200).json({ itens })
}
