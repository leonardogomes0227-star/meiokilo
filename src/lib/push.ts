import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type EstadoPush = 'sem-suporte' | 'sem-chave' | 'bloqueado' | 'desligado' | 'ligado' | 'precisa-instalar'

export const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export async function estadoPush(): Promise<EstadoPush> {
  if (ehIphone() && !instalado()) return 'precisa-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem-suporte'
  if (!VAPID) return 'sem-chave'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

export async function ativarPush(): Promise<void> {
  if (!VAPID) throw new Error('Falta a chave VITE_VAPID_PUBLIC_KEY (veja o README).')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Você não permitiu as notificações. Libere nas configurações do celular.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, keys: j.keys, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

export async function enviarTeste(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('lembretes', { body: { teste: true } })
  if (error) throw new Error('Não consegui enviar o teste. A função "lembretes" já foi publicada?')
  if (data && data.enviados === 0) throw new Error('Nenhum aparelho ativado ainda.')
}
