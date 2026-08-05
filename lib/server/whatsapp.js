// Módulo server-only: nunca importar a partir de páginas/componentes que rodam no navegador.
// As credenciais da Z-API são segredos e só podem existir em variáveis de ambiente sem o
// prefixo NEXT_PUBLIC_ (ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN).

export async function sendWhatsappText(phone, message) {
  const instance = process.env.ZAPI_INSTANCE
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instance || !token || !clientToken) {
    throw new Error(
      'Z-API não configurada: defina ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente do servidor.'
    )
  }

  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    throw new Error('Número de WhatsApp inválido ou não cadastrado para este cliente.')
  }
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }

  const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    },
    body: JSON.stringify({ phone: digits, message }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || `Falha ao enviar mensagem via Z-API (HTTP ${res.status}).`)
  }

  return data
}
