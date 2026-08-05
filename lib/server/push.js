import webpush from 'web-push'

// Módulo server-only: manda notificação push pro(s) navegador(es) que o
// cliente inscreveu no portal dele. Usa a chave privada VAPID, que só pode
// existir em variável de ambiente sem NEXT_PUBLIC_ (VAPID_PRIVATE_KEY).

let configurado = false
function configurar() {
  if (configurado) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID não configurada: defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.')
  }
  webpush.setVapidDetails('mailto:contato@seolocalbrasil.com', publicKey, privateKey)
  configurado = true
}

// Manda a mesma notificação pra todos os navegadores inscritos de um
// cliente. Inscrição expirada/revogada (404/410) é removida em silêncio -
// best-effort, não interrompe o fluxo que chamou.
export async function sendPushToCliente(supabaseAdmin, clienteId, { title, body, url }) {
  configurar()

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('cliente_id', clienteId)

  if (!subs || subs.length === 0) return { enviadas: 0 }

  const payload = JSON.stringify({ title, body, url: url || '/portal' })

  let enviadas = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        enviadas += 1
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )
  return { enviadas }
}

export async function sendPushToClientes(supabaseAdmin, clienteIds, payload) {
  const resultados = await Promise.all(
    [...new Set(clienteIds)].map((clienteId) => sendPushToCliente(supabaseAdmin, clienteId, payload))
  )
  return { enviadas: resultados.reduce((s, r) => s + r.enviadas, 0) }
}
