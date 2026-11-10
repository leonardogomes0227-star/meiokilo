import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/store'
import { calcularDivida, situacao, proximoVencimento } from '@calc'
import { dataBR, reais } from '../lib/format'
import { Badge, Button, Card, Vazio, cx } from '../components/ui'

type Filtro = 'ativos' | 'atrasados' | 'quitados'

export default function Emprestimos() {
  const { loans, clients, profile, hoje } = useData()
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const nome = (id: string) => clients.find((c) => c.id === id)?.nome ?? '—'
  const lista = loans
    .filter((l) => filtro === 'quitados' ? l.status !== 'ativo' : l.status === 'ativo' && (filtro === 'ativos' || situacao(l, hoje) === 'atrasado'))
    .sort((a, b) => proximoVencimento(a).localeCompare(proximoVencimento(b)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Empréstimos</h1>
        <Link to="/emprestimos/novo"><Button small>+ Novo</Button></Link>
      </div>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(['ativos', 'atrasados', 'quitados'] as Filtro[]).map((f) => (
          <button key={f} role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
            className={cx('min-h-11 rounded-xl font-semibold capitalize', filtro === f ? 'bg-emerald-700 text-white' : 'bg-black/5 dark:bg-white/10')}>{f === 'quitados' ? 'Encerrados' : f}</button>
        ))}
      </div>
      {lista.length === 0 && <Vazio titulo="Nada por aqui" texto={loans.length === 0 ? 'Crie o primeiro empréstimo.' : undefined} />}
      {lista.map((l) => {
        const d = calcularDivida(l, profile, hoje)
        return (
          <Link key={l.id} to={`/emprestimos/${l.id}`}>
            <Card className="mb-3 flex justify-between items-center gap-2">
              <div className="min-w-0">
                <div className="font-bold text-lg truncate">{nome(l.client_id)}</div>
                <div className="text-sm opacity-70">{reais(l.principal)} · {l.taxa_mes}% · {l.tipo === 'juros' ? 'só juros' : `${l.meses_pagos}/${l.n_parcelas}`}</div>
              </div>
              {l.status === 'ativo' ? (
                <div className="text-right shrink-0">
                  <div className="font-bold">{reais(d.devido)}</div>
                  <Badge cor={d.diasAtraso > 0 ? 'red' : situacao(l, hoje) === 'hoje' ? 'yellow' : 'green'}>{dataBR(d.vencimento).slice(0, 5)}</Badge>
                </div>
              ) : <Badge cor="gray">{l.status === 'quitado' ? 'Quitado' : 'Renegociado'}</Badge>}
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
