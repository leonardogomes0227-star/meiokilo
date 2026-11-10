import { calcularDivida, proximoVencimento, situacao, somarMeses, round2, type Config } from '@calc'
import type { Client, Loan, Payment } from './types'

export function resumo(loans: Loan[], payments: Payment[], cfg: Config, hoje: string) {
  const mes = hoje.slice(0, 7)
  const fimMes = `${mes}-31`
  const ativos = loans.filter((l) => l.status === 'ativo')
  const naRua = round2(ativos.reduce((s, l) => s + l.saldo, 0))
  const doMes = payments.filter((p) => p.data.startsWith(mes))
  const aReceberMes = round2(ativos.filter((l) => proximoVencimento(l) <= fimMes).reduce((s, l) => s + calcularDivida(l, cfg, hoje).devido, 0))
  const atrasados = ativos.filter((l) => situacao(l, hoje) === 'atrasado')
  const valorAtrasado = round2(atrasados.reduce((s, l) => s + calcularDivida(l, cfg, hoje).devido, 0))
  const saldoAtrasado = round2(atrasados.reduce((s, l) => s + l.saldo, 0))
  return {
    naRua,
    aReceberMes,
    recebidoMes: round2(doMes.reduce((s, p) => s + p.valor, 0)),
    lucroMes: round2(doMes.reduce((s, p) => s + p.valor - p.principal_pago, 0)),
    lucroTotal: round2(payments.reduce((s, p) => s + p.valor - p.principal_pago, 0)),
    qtdAtrasados: atrasados.length,
    valorAtrasado,
    inadimplencia: naRua > 0 ? round2((saldoAtrasado / naRua) * 100) : 0,
  }
}

export function serieMensal(payments: Payment[], hoje: string, meses: number) {
  const out: { mes: string; recebido: number; lucro: number }[] = []
  for (let i = meses - 1; i >= 0; i--) out.push({ mes: somarMeses(hoje.slice(0, 7) + '-01', -i).slice(0, 7), recebido: 0, lucro: 0 })
  for (const p of payments) {
    const m = out.find((x) => x.mes === p.data.slice(0, 7))
    if (m) { m.recebido += p.valor; m.lucro += p.valor - p.principal_pago }
  }
  return out.map((m) => ({ ...m, recebido: round2(m.recebido), lucro: round2(m.lucro) }))
}

export function ranking(clients: Client[], loans: Loan[], payments: Payment[]) {
  const dono = new Map(loans.map((l) => [l.id, l.client_id]))
  const por = new Map<string, { juros: number; atrasos: number }>()
  for (const p of payments) {
    const cid = dono.get(p.loan_id)
    if (!cid) continue
    const r = por.get(cid) ?? { juros: 0, atrasos: 0 }
    r.juros += p.valor - p.principal_pago
    if (p.atrasado && p.tipo !== 'parcial') r.atrasos++
    por.set(cid, r)
  }
  const lista = clients.map((c) => ({ c, ...(por.get(c.id) ?? { juros: 0, atrasos: 0 }) }))
  return {
    rendem: [...lista].filter((x) => x.juros > 0).sort((a, b) => b.juros - a.juros).slice(0, 5),
    atrasam: [...lista].filter((x) => x.atrasos > 0).sort((a, b) => b.atrasos - a.atrasos).slice(0, 5),
  }
}
