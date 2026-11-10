import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/store'
import { TIPO_LABEL } from '../lib/types'
import { dataBR, reais } from '../lib/format'
import { Card, Vazio, inputCls } from '../components/ui'

export default function Historico() {
  const { payments, loans, clients } = useData()
  const [cliente, setCliente] = useState('')
  const [tipo, setTipo] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const dono = new Map(loans.map((l) => [l.id, l]))
  const nome = (loanId: string) => clients.find((c) => c.id === dono.get(loanId)?.client_id)?.nome ?? '—'
  const lista = payments
    .filter((p) => (!cliente || dono.get(p.loan_id)?.client_id === cliente) && (!tipo || p.tipo === tipo) && (!de || p.data >= de) && (!ate || p.data <= ate))
    .sort((a, b) => (b.data + b.created_at).localeCompare(a.data + a.created_at))
  const total = lista.reduce((s, p) => s + p.valor, 0)

  return (
    <div className="space-y-3">
      <Link to="/mais" className="underline">← Mais</Link>
      <h1 className="text-2xl font-extrabold">Histórico de pagamentos</h1>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className={inputCls} type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="De" />
        <input className={inputCls} type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Até" />
      </div>
      <p className="font-semibold">{lista.length} pagamentos · {reais(total)}</p>
      {lista.length === 0 && <Vazio titulo="Nenhum pagamento" />}
      {lista.slice(0, 200).map((p) => (
        <Link key={p.id} to={`/emprestimos/${p.loan_id}`}>
          <Card className="mb-2 flex justify-between items-center">
            <div><div className="font-bold">{nome(p.loan_id)}</div><div className="text-sm opacity-70">{dataBR(p.data)} · {TIPO_LABEL[p.tipo]}{p.atrasado && ' · atrasado'}</div></div>
            <b>{reais(p.valor)}</b>
          </Card>
        </Link>
      ))}
    </div>
  )
}
