const K = 'mk_pin'
async function hash(pin: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('meiokilo:' + pin))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}
export const temPin = () => { try { return !!localStorage.getItem(K) } catch { return false } }
export async function definirPin(pin: string) { localStorage.setItem(K, await hash(pin)) }
export const removerPin = () => localStorage.removeItem(K)
export async function conferePin(pin: string) { return localStorage.getItem(K) === (await hash(pin)) }
