const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (n: number) => brl.format(n || 0)

/** 2026-02-15 -> 15/02/2026 */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export const soDigitos = (s: string) => s.replace(/\D/g, '')

export function foneBonito(s: string): string {
  const d = soDigitos(s).replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return s
}

/** "Vence em 3 dias", "Vence hoje", "Atrasado há 2 dias" */
export function quandoVence(dias: number): string {
  if (dias < 0) return `Atrasado há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  return `Vence em ${dias} dias`
}

export const num = (s: string): number => {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

/** Número para campo de texto: 1234.5 -> "1234,50" */
export const paraCampo = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
