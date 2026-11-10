import { calcularDivida, proximoVencimento, somarDias, somarMeses, type Config } from '@calc'
import type { Client, Loan } from './types'
import { reais } from './format'

const d8 = (iso: string) => iso.replace(/-/g, '')
const esc = (s: string) => s.replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n')

/** Arquivo .ics com os próximos vencimentos (3 meses à frente) e alarme às 8h do dia. */
export function gerarIcs(loans: Loan[], clients: Client[], cfg: Config, hoje: string): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MeioKilo//PT-BR', 'CALSCALE:GREGORIAN']
  for (const l of loans.filter((x) => x.status === 'ativo')) {
    const nome = clients.find((c) => c.id === l.client_id)?.nome ?? 'Cliente'
    const venc = proximoVencimento(l)
    const valor = calcularDivida(l, cfg, hoje).cobranca
    for (let i = 0; i < 3; i++) {
      const dia = somarMeses(venc, i)
      L.push('BEGIN:VEVENT', `UID:${l.id}-${d8(dia)}@meiokilo`, `DTSTAMP:${d8(hoje)}T000000Z`,
        `DTSTART;VALUE=DATE:${d8(dia)}`, `DTEND;VALUE=DATE:${d8(somarDias(dia, 1))}`,
        `SUMMARY:${esc(`Cobrar ${nome} (${reais(valor)})`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Vencimento hoje', 'TRIGGER:PT8H', 'END:VALARM', 'END:VEVENT')
    }
  }
  L.push('END:VCALENDAR')
  return L.join('\r\n')
}

export function linkGoogleAgenda(nome: string, vencimento: string, valor: number): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: `Cobrar ${nome} (${reais(valor)})`,
    dates: `${d8(vencimento)}/${d8(somarDias(vencimento, 1))}`, details: 'Vencimento de empréstimo (MeioKilo)',
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
