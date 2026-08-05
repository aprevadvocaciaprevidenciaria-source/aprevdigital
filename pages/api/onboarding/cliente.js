import { createClient } from '@supabase/supabase-js'

// Rota pública (sem autenticação) - alimenta a página de onboarding que o
// cliente preenche pelo link enviado no WhatsApp. Só devolve o nome/nicho
// do cliente (não é dado sensível) pra saudar a pessoa certa no formulário;
// o próprio ID do cliente já funciona como o "token" do link, então não
// tem busca/listagem aqui, só leitura por ID exato.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const { clienteId } = req.query
  if (!clienteId) {
    return res.status(400).json({ error: 'clienteId é obrigatório.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cliente, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, nicho')
    .eq('id', clienteId)
    .maybeSingle()

  if (error || !cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado.' })
  }

  return res.status(200).json({ nome: cliente.nome, nicho: cliente.nicho })
}
