// Chamada client-side pra /api/notificacoes/enviar. Best-effort de propósito
// (nunca lança erro pro chamador) - o fluxo que chama isso já salvou o que
// importa (avaliação, relatório, data especial); a notificação é só um
// bônus, não pode travar a tela se falhar.
export async function notificarClientes(accessToken, { clienteIds, title, body, url }) {
  try {
    await fetch('/api/notificacoes/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ clienteIds, title, body, url }),
    })
  } catch (err) {
    // silencioso de propósito
  }
}
