// Regras de cálculo do MeioKilo.
// Arquivo SEM imports: é usado pelo app (via alias @calc) e pela Edge Function de lembretes.

export type TipoEmprestimo = 'juros' | 'parcelas'
export type TipoPagamento =
  | 'juros' | 'parcela' | 'parcial' | 'amortizacao' | 'quitacao' | 'adiado' | 'renegociacao'

export interface LoanCalc {
  principal: number
  saldo: number
  taxa_mes: number
  data_inicio: string // YYYY-MM-DD
  tipo: TipoEmprestimo
  n_parcelas: number | null
  meses_pagos: number
  meses_adiados: number
  valor_parcial_pago: number
  status: 'ativo' | 'quitado' | 'renegociado'
}

export interface Config {
  multa_pct: number
  mora_pct_dia: number
}

/** Campos do empréstimo que mudam num pagamento (guardados em snapshot para desfazer). */
export interface Estado {
  saldo: number
  meses_pagos: number
  meses_adiados: number
  valor_parcial_pago: number
  status: 'ativo' | 'quitado' | 'renegociado'
}

export interface Pagamento {
  data: string
  valor: number
  tipo: TipoPagamento
  principal_pago: number
  vencimento_ref: string | null
  atrasado: boolean
  snapshot: Estado
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ---------- datas (sempre strings YYYY-MM-DD, sem fuso) ----------

const pad = (n: number) => String(n).padStart(2, '0')

export function diasNoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate()
}

/** Soma meses mantendo o dia da data base; dia 31 vira o último dia de meses curtos. */
export function somarMeses(base: string, meses: number): string {
  const [a, m, d] = base.split('-').map(Number)
  const idx = a * 12 + (m - 1) + meses
  const ano = Math.floor(idx / 12)
  const mes = (idx % 12) + 1
  const dia = Math.min(d, diasNoMes(ano, mes))
  return `${ano}-${pad(mes)}-${pad(dia)}`
}

export function diffDias(de: string, ate: string): number {
  const t = (s: string) => {
    const [a, m, d] = s.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  return Math.round((t(ate) - t(de)) / 86400000)
}

export function somarDias(base: string, dias: number): string {
  const [a, m, d] = base.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Data de hoje no fuso de Brasília. */
export function hojeISO(agora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
  return p // en-CA => YYYY-MM-DD
}

export function horaBrasilia(agora: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23',
  }).format(agora)
  return Number(h)
}

// ---------- empréstimo ----------

export function proximoVencimento(l: Pick<LoanCalc, 'data_inicio' | 'meses_pagos' | 'meses_adiados'>): string {
  return somarMeses(l.data_inicio, l.meses_pagos + l.meses_adiados + 1)
}

export function jurosDoMes(l: Pick<LoanCalc, 'saldo' | 'taxa_mes'>): number {
  return round2((l.saldo * l.taxa_mes) / 100)
}

/** Parte do principal que a parcela do mês abate (só para tipo parcelas). */
export function principalDaParcela(l: LoanCalc): number {
  if (l.tipo !== 'parcelas' || !l.n_parcelas) return 0
  return round2(Math.min(l.principal / l.n_parcelas, l.saldo))
}

/** Cobrança base do mês, sem multa nem mora. */
export function cobrancaDoMes(l: LoanCalc): number {
  return round2(jurosDoMes(l) + principalDaParcela(l))
}

export interface Divida {
  vencimento: string
  diasAtraso: number
  cobranca: number
  juros: number
  principalParcela: number
  multa: number
  mora: number
  parcialPago: number
  devido: number // devido agora
}

export function calcularDivida(l: LoanCalc, cfg: Config, hoje: string): Divida {
  const vencimento = proximoVencimento(l)
  const diasAtraso = Math.max(0, diffDias(vencimento, hoje))
  const juros = jurosDoMes(l)
  const principalParcela = principalDaParcela(l)
  const cobranca = round2(juros + principalParcela)
  const multa = diasAtraso > 0 ? round2((cobranca * cfg.multa_pct) / 100) : 0
  const mora = diasAtraso > 0 ? round2((cobranca * cfg.mora_pct_dia * diasAtraso) / 100) : 0
  const devido = Math.max(0, round2(cobranca + multa + mora - l.valor_parcial_pago))
  return { vencimento, diasAtraso, cobranca, juros, principalParcela, multa, mora, parcialPago: l.valor_parcial_pago, devido }
}

/** Dias até vencer (negativo = atrasado). */
export function diasParaVencer(l: LoanCalc, hoje: string): number {
  return diffDias(hoje, proximoVencimento(l))
}

export type Situacao = 'atrasado' | 'hoje' | 'em_dia'
export function situacao(l: LoanCalc, hoje: string): Situacao {
  const d = diasParaVencer(l, hoje)
  return d < 0 ? 'atrasado' : d === 0 ? 'hoje' : 'em_dia'
}

const estadoDe = (l: LoanCalc): Estado => ({
  saldo: l.saldo,
  meses_pagos: l.meses_pagos,
  meses_adiados: l.meses_adiados,
  valor_parcial_pago: l.valor_parcial_pago,
  status: l.status,
})

export interface Resultado {
  novo: Estado
  pagamento: Pagamento
}

/**
 * Registra um pagamento normal (botão "Recebi").
 * - valor >= devido: fecha o mês; o excedente abate o principal.
 * - valor < devido: fica como pagamento parcial; vencimento não muda.
 */
export function aplicarPagamento(l: LoanCalc, valorBruto: number, data: string, cfg: Config): Resultado {
  const valor = round2(valorBruto)
  if (!(valor > 0)) throw new Error('Informe um valor maior que zero.')
  if (l.status !== 'ativo') throw new Error('Este empréstimo não está ativo.')
  const div = calcularDivida(l, cfg, data)
  const snapshot = estadoDe(l)
  const novo: Estado = { ...snapshot }
  const atrasado = div.diasAtraso > 0

  if (valor < div.devido) {
    novo.valor_parcial_pago = round2(l.valor_parcial_pago + valor)
    return {
      novo,
      pagamento: { data, valor, tipo: 'parcial', principal_pago: 0, vencimento_ref: div.vencimento, atrasado, snapshot },
    }
  }

  const excedente = round2(valor - div.devido)
  let principalPago = 0
  novo.meses_pagos = l.meses_pagos + 1
  novo.valor_parcial_pago = 0

  if (l.tipo === 'parcelas') principalPago = div.principalParcela
  principalPago = round2(Math.min(l.saldo, principalPago + excedente))
  novo.saldo = round2(l.saldo - principalPago)

  const acabou =
    novo.saldo <= 0.004 || (l.tipo === 'parcelas' && !!l.n_parcelas && novo.meses_pagos >= l.n_parcelas)
  if (acabou) {
    novo.status = 'quitado'
    novo.saldo = Math.max(0, novo.saldo)
  }
  return {
    novo,
    pagamento: {
      data, valor, tipo: l.tipo === 'parcelas' ? 'parcela' : 'juros',
      principal_pago: principalPago, vencimento_ref: div.vencimento, atrasado, snapshot,
    },
  }
}

/** Abate do principal sem fechar o mês. */
export function amortizar(l: LoanCalc, valorBruto: number, data: string): Resultado {
  const valor = round2(valorBruto)
  if (!(valor > 0)) throw new Error('Informe um valor maior que zero.')
  if (valor > l.saldo + 0.004) throw new Error('O valor é maior que o saldo do empréstimo.')
  const snapshot = estadoDe(l)
  const novo: Estado = { ...snapshot, saldo: round2(l.saldo - valor) }
  if (novo.saldo <= 0.004) { novo.saldo = 0; novo.status = 'quitado' }
  return {
    novo,
    pagamento: { data, valor, tipo: 'amortizacao', principal_pago: valor, vencimento_ref: proximoVencimento(l), atrasado: false, snapshot },
  }
}

/** Valor para quitar tudo hoje: saldo + juros do mês + multa + mora − parcial já pago. */
export function valorQuitacao(l: LoanCalc, cfg: Config, hoje: string): number {
  const d = calcularDivida(l, cfg, hoje)
  return Math.max(0, round2(l.saldo + d.juros + d.multa + d.mora - l.valor_parcial_pago))
}

export function quitar(l: LoanCalc, cfg: Config, data: string): Resultado {
  if (l.status !== 'ativo') throw new Error('Este empréstimo não está ativo.')
  const d = calcularDivida(l, cfg, data)
  const valor = valorQuitacao(l, cfg, data)
  const snapshot = estadoDe(l)
  return {
    novo: { ...snapshot, saldo: 0, valor_parcial_pago: 0, status: 'quitado' },
    pagamento: { data, valor, tipo: 'quitacao', principal_pago: l.saldo, vencimento_ref: d.vencimento, atrasado: d.diasAtraso > 0, snapshot },
  }
}

/** Empurra o vencimento 1 mês, sem receber nada e sem contar como parcela paga. */
export function adiar(l: LoanCalc, data: string): Resultado {
  if (l.status !== 'ativo') throw new Error('Este empréstimo não está ativo.')
  const snapshot = estadoDe(l)
  return {
    novo: { ...snapshot, meses_adiados: l.meses_adiados + 1 },
    pagamento: { data, valor: 0, tipo: 'adiado', principal_pago: 0, vencimento_ref: proximoVencimento(l), atrasado: false, snapshot },
  }
}

// ---------- simulador ----------

export interface Simulacao {
  primeiraCobranca: number
  primeiroVencimento: string
  jurosPrimeiroMes: number
  /** Para parcelado: total do plano. Para só-juros: juros de 12 meses + principal (referência). */
  totalReceber: number
  totalJuros: number
  meses: number
}

export function simular(
  p: { valor: number; taxa_mes: number; data_inicio: string; tipo: TipoEmprestimo; n_parcelas: number },
): Simulacao {
  const n = p.tipo === 'parcelas' ? Math.max(1, Math.floor(p.n_parcelas || 1)) : 12
  let saldo = p.valor
  let totalJuros = 0
  let primeira = 0
  let jurosPrimeiro = 0
  const amort = p.tipo === 'parcelas' ? p.valor / n : 0
  for (let i = 0; i < n; i++) {
    const j = round2((saldo * p.taxa_mes) / 100)
    if (i === 0) { primeira = round2(j + amort); jurosPrimeiro = j }
    totalJuros += j
    saldo = round2(saldo - amort)
  }
  totalJuros = round2(totalJuros)
  return {
    primeiraCobranca: primeira,
    primeiroVencimento: somarMeses(p.data_inicio, 1),
    jurosPrimeiroMes: jurosPrimeiro,
    totalReceber: round2(p.valor + totalJuros),
    totalJuros,
    meses: n,
  }
}

// ---------- score de pontualidade ----------

export type Selo = 'Bom pagador' | 'Atrasa às vezes' | 'Atenção' | 'Sem histórico'

export function scorePontualidade(pagamentos: { tipo: string; atrasado: boolean }[], temAtrasoAgora: boolean) {
  const validos = pagamentos.filter((p) => p.tipo === 'juros' || p.tipo === 'parcela' || p.tipo === 'quitacao' || p.tipo === 'parcial')
  const atrasos = validos.filter((p) => p.atrasado).length
  const total = validos.length
  let selo: Selo
  if (total === 0 && !temAtrasoAgora) selo = 'Sem histórico'
  else if (temAtrasoAgora || (total > 0 && atrasos / total > 0.4)) selo = 'Atenção'
  else if (atrasos / Math.max(total, 1) > 0.1) selo = 'Atrasa às vezes'
  else selo = 'Bom pagador'
  return { atrasos, total, selo }
}
