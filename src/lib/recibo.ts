import { imprimirHtml, esc } from './pdf'
import { dataBR, reais } from './format'
import { TIPO_LABEL, type Client, type Payment, type Profile, type Loan } from './types'
import { proximoVencimento } from '@calc'

export function reciboPdf(p: Profile, c: Client, loan: Loan, pg: Payment) {
  const prox = loan.status === 'ativo' ? dataBR(proximoVencimento(loan)) : '—'
  imprimirHtml(`Recibo - ${c.nome}`, `
    <h1>Recibo de pagamento</h1>
    <div class="mut">${esc(p.nome || '')}</div>
    <div class="box">
      <div class="mut">Recebido de</div><div class="big">${esc(c.nome)}</div>
      <p class="mut" style="margin-bottom:0">Valor recebido</p><div class="big">${reais(pg.valor)}</div>
    </div>
    <table>
      <tr><td>Data</td><td class="n">${dataBR(pg.data)}</td></tr>
      <tr><td>Tipo</td><td class="n">${TIPO_LABEL[pg.tipo]}</td></tr>
      <tr><td>Saldo do empréstimo</td><td class="n">${reais(loan.saldo)}</td></tr>
      <tr><td>Próximo vencimento</td><td class="n">${prox}</td></tr>
    </table>`)
}

export function extratoPdf(p: Profile, c: Client, linhas: { loan: Loan; pagamentos: Payment[] }[]) {
  const corpo = linhas.map(({ loan, pagamentos }) => `
    <h2>Empréstimo de ${reais(loan.principal)} em ${dataBR(loan.data_inicio)} · ${loan.taxa_mes}% ao mês (${loan.status})</h2>
    <p class="mut">Saldo atual: ${reais(loan.saldo)}</p>
    <table><tr><th>Data</th><th>Tipo</th><th class="n">Valor</th><th class="n">Principal</th><th class="n">Juros</th></tr>
    ${pagamentos.map((x) => `<tr><td>${dataBR(x.data)}${x.atrasado ? ' (atrasado)' : ''}</td><td>${TIPO_LABEL[x.tipo]}</td><td class="n">${reais(x.valor)}</td><td class="n">${reais(x.principal_pago)}</td><td class="n">${reais(x.valor - x.principal_pago)}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">Nenhum pagamento.</td></tr>'}
    </table>`).join('')
  imprimirHtml(`Extrato - ${c.nome}`, `<h1>Extrato de ${esc(c.nome)}</h1><div class="mut">${esc(p.nome || '')}</div>${corpo}`)
}
