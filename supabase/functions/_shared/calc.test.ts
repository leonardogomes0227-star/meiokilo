import { describe, it, expect } from 'vitest'
import {
  somarMeses, proximoVencimento, jurosDoMes, cobrancaDoMes, calcularDivida,
  aplicarPagamento, amortizar, quitar, adiar, simular, scorePontualidade, diffDias, type LoanCalc,
} from './calc'

const cfg = { multa_pct: 2, mora_pct_dia: 0.1 }
const base = (o: Partial<LoanCalc> = {}): LoanCalc => ({
  principal: 1000, saldo: 1000, taxa_mes: 10, data_inicio: '2026-01-15', tipo: 'juros',
  n_parcelas: null, meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo', ...o,
})

describe('datas', () => {
  it('dia 31 vira último dia do mês curto', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31')
    expect(somarMeses('2026-01-31', 3)).toBe('2026-04-30')
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29') // bissexto
  })
  it('vira o ano', () => {
    expect(somarMeses('2026-11-10', 3)).toBe('2027-02-10')
    expect(somarMeses('2026-12-05', 1)).toBe('2027-01-05')
  })
  it('vencimento = início + (pagos + adiados + 1) meses', () => {
    expect(proximoVencimento(base())).toBe('2026-02-15')
    expect(proximoVencimento(base({ meses_pagos: 2, meses_adiados: 1 }))).toBe('2026-05-15')
  })
  it('diffDias', () => expect(diffDias('2026-02-15', '2026-02-18')).toBe(3))
})

describe('juros e cobrança', () => {
  it('só juros: saldo × taxa', () => {
    expect(jurosDoMes(base())).toBe(100)
    expect(cobrancaDoMes(base())).toBe(100)
  })
  it('parcelado: principal/n + juros sobre o saldo', () => {
    const l = base({ tipo: 'parcelas', n_parcelas: 4 })
    expect(cobrancaDoMes(l)).toBe(350)
    expect(cobrancaDoMes({ ...l, saldo: 750, meses_pagos: 1 })).toBe(325)
  })
})

describe('atraso, multa e mora', () => {
  it('em dia: sem multa nem mora', () => {
    const d = calcularDivida(base(), cfg, '2026-02-15')
    expect(d.diasAtraso).toBe(0)
    expect(d.devido).toBe(100)
  })
  it('3 dias de atraso: multa 2% + mora 0,1%/dia', () => {
    const d = calcularDivida(base(), cfg, '2026-02-18')
    expect(d.diasAtraso).toBe(3)
    expect(d.multa).toBe(2)
    expect(d.mora).toBe(0.3)
    expect(d.devido).toBe(102.3)
  })
  it('desconta o parcial já pago', () => {
    const d = calcularDivida(base({ valor_parcial_pago: 40 }), cfg, '2026-02-15')
    expect(d.devido).toBe(60)
  })
})

describe('pagamento', () => {
  it('paga o juros: fecha o mês, principal intacto', () => {
    const r = aplicarPagamento(base(), 100, '2026-02-15', cfg)
    expect(r.novo.meses_pagos).toBe(1)
    expect(r.novo.saldo).toBe(1000)
    expect(r.pagamento.tipo).toBe('juros')
    expect(r.pagamento.principal_pago).toBe(0)
    expect(r.pagamento.atrasado).toBe(false)
  })
  it('pagou a mais: excedente abate o principal; lucro = valor − principal', () => {
    const r = aplicarPagamento(base(), 300, '2026-02-15', cfg)
    expect(r.novo.saldo).toBe(800)
    expect(r.pagamento.principal_pago).toBe(200)
    expect(r.pagamento.valor - r.pagamento.principal_pago).toBe(100)
  })
  it('parcial: vencimento não muda e acumula', () => {
    const l = base()
    const r1 = aplicarPagamento(l, 30, '2026-02-15', cfg)
    expect(r1.pagamento.tipo).toBe('parcial')
    expect(r1.novo.meses_pagos).toBe(0)
    expect(r1.novo.valor_parcial_pago).toBe(30)
    const r2 = aplicarPagamento({ ...l, ...r1.novo }, 70, '2026-02-16', cfg)
    // dia 16: 1 dia de atraso => devido = 100 + 2 + 0,1 − 30 = 72,1; 70 ainda é parcial
    expect(r2.pagamento.tipo).toBe('parcial')
    expect(r2.novo.valor_parcial_pago).toBe(100)
    const r3 = aplicarPagamento({ ...l, ...r2.novo }, 2.1, '2026-02-16', cfg)
    expect(r3.pagamento.tipo).toBe('juros')
    expect(r3.novo.meses_pagos).toBe(1)
    expect(r3.novo.valor_parcial_pago).toBe(0)
  })
  it('pago atrasado é marcado', () => {
    const r = aplicarPagamento(base(), 102.3, '2026-02-18', cfg)
    expect(r.pagamento.atrasado).toBe(true)
    expect(r.novo.meses_pagos).toBe(1)
  })
  it('parcelado: abate principal/n e quita na última parcela', () => {
    let l = base({ tipo: 'parcelas', n_parcelas: 2 })
    const r1 = aplicarPagamento(l, 600, '2026-02-15', cfg) // 500 + 100
    expect(r1.novo.saldo).toBe(500)
    expect(r1.pagamento.principal_pago).toBe(500)
    expect(r1.pagamento.tipo).toBe('parcela')
    l = { ...l, ...r1.novo }
    const r2 = aplicarPagamento(l, 550, '2026-03-15', cfg) // 500 + 50
    expect(r2.novo.status).toBe('quitado')
    expect(r2.novo.saldo).toBe(0)
  })
  it('excedente maior que o saldo quita', () => {
    const r = aplicarPagamento(base({ saldo: 100, principal: 100 }), 500, '2026-02-15', cfg)
    expect(r.novo.status).toBe('quitado')
    expect(r.pagamento.principal_pago).toBe(100)
  })
  it('rejeita valor zero e empréstimo quitado', () => {
    expect(() => aplicarPagamento(base(), 0, '2026-02-15', cfg)).toThrow()
    expect(() => aplicarPagamento(base({ status: 'quitado' }), 10, '2026-02-15', cfg)).toThrow()
  })
  it('desfazer: o snapshot restaura o estado anterior', () => {
    const l = base()
    const r = aplicarPagamento(l, 300, '2026-02-15', cfg)
    expect(r.pagamento.snapshot).toEqual({ saldo: 1000, meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo' })
  })
})

describe('amortizar, quitar, adiar', () => {
  it('amortizar abate o principal e não muda o vencimento', () => {
    const r = amortizar(base(), 400, '2026-02-01')
    expect(r.novo.saldo).toBe(600)
    expect(r.novo.meses_pagos).toBe(0)
    expect(r.pagamento.principal_pago).toBe(400)
  })
  it('amortizar tudo quita', () => {
    expect(amortizar(base(), 1000, '2026-02-01').novo.status).toBe('quitado')
    expect(() => amortizar(base(), 1500, '2026-02-01')).toThrow()
  })
  it('quitar = saldo + juros do mês (+ multa/mora)', () => {
    const r = quitar(base(), cfg, '2026-02-15')
    expect(r.pagamento.valor).toBe(1100)
    expect(r.pagamento.principal_pago).toBe(1000)
    expect(r.novo.status).toBe('quitado')
  })
  it('adiar empurra 1 mês sem contar parcela', () => {
    const l = base({ tipo: 'parcelas', n_parcelas: 3 })
    const r = adiar(l, '2026-02-15')
    expect(r.novo.meses_adiados).toBe(1)
    expect(r.novo.meses_pagos).toBe(0)
    expect(proximoVencimento({ ...l, ...r.novo })).toBe('2026-03-15')
  })
})

describe('simulador', () => {
  it('só juros', () => {
    const s = simular({ valor: 1000, taxa_mes: 10, data_inicio: '2026-01-31', tipo: 'juros', n_parcelas: 0 })
    expect(s.primeiraCobranca).toBe(100)
    expect(s.primeiroVencimento).toBe('2026-02-28')
  })
  it('parcelado 4x', () => {
    const s = simular({ valor: 1000, taxa_mes: 10, data_inicio: '2026-01-15', tipo: 'parcelas', n_parcelas: 4 })
    expect(s.primeiraCobranca).toBe(350)
    expect(s.totalJuros).toBe(250) // 100+75+50+25
    expect(s.totalReceber).toBe(1250)
  })
})

describe('score', () => {
  it('classifica', () => {
    const ok = Array(10).fill({ tipo: 'juros', atrasado: false })
    expect(scorePontualidade(ok, false).selo).toBe('Bom pagador')
    expect(scorePontualidade([...ok, { tipo: 'juros', atrasado: true }, { tipo: 'juros', atrasado: true }], false).selo).toBe('Atrasa às vezes')
    expect(scorePontualidade(ok, true).selo).toBe('Atenção')
    expect(scorePontualidade([], false).selo).toBe('Sem histórico')
  })
})
