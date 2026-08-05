// Módulo server-only: nunca importar a partir de páginas/componentes que rodam no navegador.
// A chave da WAME é um segredo e só pode existir em variável de ambiente sem o
// prefixo NEXT_PUBLIC_ (WAME_API_KEY). Documentação: https://us.api-wa.me/docs/

export async function sendWhatsappText(phone, message) {
  const apiKey = process.env.WAME_API_KEY

  if (!apiKey) {
    throw new Error('WAME não configurada: defina WAME_API_KEY nas variáveis de ambiente do servidor.')
  }

  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    throw new Error('Número de WhatsApp inválido ou não cadastrado para este cliente.')
  }
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }

  const res = await fetch(`https://us.api-wa.me/${apiKey}/message/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: digits, text: message }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || `Falha ao enviar mensagem via WAME (HTTP ${res.status}).`)
  }

  return data
}
