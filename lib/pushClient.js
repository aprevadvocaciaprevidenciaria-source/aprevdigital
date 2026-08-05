// Helpers do lado do navegador pra inscrever/desinscrever o portal do
// cliente nas notificações push. Roda só no cliente (usa APIs do navegador
// que não existem no server).

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSuportado() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getInscricaoAtual() {
  if (!pushSuportado()) return null
  // Registra antes de esperar "ready" - sem isso, na primeira visita (antes
  // de qualquer registro existir) a Promise de "ready" nunca resolve.
  await navigator.serviceWorker.register('/sw.js')
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function ativarNotificacoes(accessToken) {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error('Permissão de notificação negada.')
  }

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('Notificações push não configuradas ainda.')
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const res = await fetch('/api/portal/notificacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Não foi possível ativar as notificações.')
  }
}

export async function desativarNotificacoes(accessToken) {
  const subscription = await getInscricaoAtual()
  if (!subscription) return

  await fetch('/api/portal/notificacoes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  await subscription.unsubscribe()
}
