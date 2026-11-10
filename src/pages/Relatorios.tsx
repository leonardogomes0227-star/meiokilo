import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCobrancas, useData } from '../lib/store'
import { TIPO_LABEL } from '../lib/types'
import { dataBR, reais } from '../lib/format'
import { baixarCsv } from '../lib/csv'
import { esc, imprimirHtml } from '../lib/pdf'
import { extratoPdf } from '../lib/recibo'
import { Button, Card, Field, inputCls } from '../components/ui'

export default function Relatorios() {
  const { payments, loans, clients, profile, hoje } = useData()
  const cob = useCobrancas()
  const [de, setDe] = useState(hoje.slice(0, 7) + '-01')
  const [ate, setAte] = useState(hoje)
  const [cli, setCli] = useState('')
  const nomeDe = (loanId: string) => clients.find((c) => c.id === loans.find((l) => l.id === loanId)?.client_id)?.nome ?? '—'
  const pgs = payments.filter((p) => p.data >= de && p.data <= ate).sort((a, b) => a.data.localeCompare(b.data))
  const devedores = cob.filter((c) => c.divida.diasAtraso > 0)

  const linhasPg = () => pgs.map((p) => [dataBR(p.data), nomeDe(p.loan_id), TIPO_LABEL[p.tipo], p.valor, p.principal_pago, p.valor - p.principal_pago, p.atrasado ? 'Sim' : 'Não'])

  return (
    <div className="space-y-4">
      <Link to="/mais" className="underline">← Mais</Link>
      <h1 className="text-2xl font-extrabold">Relatórios</h1>

      <Card className="space-y-3">
        <h2 className="font-bold">Pagamentos por período</h2>
        <div className="grid grid-cols-2 gap-2">
          <Field label="De"><input className={inputCls} type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Field>
          <Field label="Até"><input className={inputCls} type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Field>
        </div>
        <p>{pgs.length} pagamentos · {reais(pgs.reduce((s, p) => s + p.valor, 0))}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button v="secondary" small onClick={() => baixarCsv(`pagamentos_${de}_${ate}.csv`, [['Data', 'Cliente', 'Tipo', 'Valor', 'Principal', 'Juros', 'Atrasado'], ...linhasPg()])}>Baixar CSV</Button>
          <Button v="secondary" small onClick={() => imprimirHtml('Pagamentos', `<h1>Pagamentos</h1><div class="mut">${dataBR(de)} a ${dataBR(ate)}</div><table><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th class="n">Valor</th><th class="n">Juros</th></tr>${pgs.map((p) => `<tr><td>${dataBR(p.data)}</td><td>${esc(nomeDe(p.loan_id))}</td><td>${TIPO_LABEL[p.tipo]}</td><td class="n">${reais(p.valor)}</td><td class="n">${reais(p.valor - p.principal_pago)}</td></tr>`).join('')}</table><p class="big">Total: ${reais(pgs.reduce((s, p) => s + p.valor, 0))}</p>`)}>PDF</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Lista de devedores (atrasados)</h2>
        <p>{devedores.length} atrasados · {reais(devedores.reduce((s, c) => s + c.divida.devido, 0))}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button v="secondary" small onClick={() => baixarCsv('devedores.csv', [['Cliente', 'WhatsApp', 'Vencimento', 'Dias de atraso', 'Saldo', 'Devido agora'], ...devedores.map((c) => [c.client.nome, c.client.whatsapp, dataBR(c.divida.vencimento), c.divida.diasAtraso, c.loan.saldo, c.divida.devido])])}>Baixar CSV</Button>
          <Button v="secondary" small onClick={() => imprimirHtml('Devedores', `<h1>Devedores</h1><table><tr><th>Cliente</th><th>Venceu</th><th class="n">Dias</th><th class="n">Devido</th></tr>${devedores.map((c) => `<tr><td>${esc(c.client.nome)}</td><td>${dataBR(c.divida.vencimento)}</td><td class="n">${c.divida.diasAtraso}</td><td class="n">${reais(c.divida.devido)}</td></tr>`).join('')}</table>`)}>PDF</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Extrato do cliente</h2>
        <select className={inputCls} value={cli} onChange={(e) => setCli(e.target.value)} aria-label="Cliente"><option value="">Escolha o cliente…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <Button small disabled={!cli} onClick={() => {
          const c = clients.find((x) => x.id === cli)!
          extratoPdf(profile, c, loans.filter((l) => l.client_id === cli).map((l) => ({ loan: l, pagamentos: payments.filter((p) => p.loan_id === l.id).sort((a, b) => a.data.localeCompare(b.data)) })))
        }}>Gerar PDF</Button>
        <p className="text-sm opacity-70">Para mandar no WhatsApp: salve como PDF e compartilhe o arquivo.</p>
      </Card>
    </div>
  )
}
