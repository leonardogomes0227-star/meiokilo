import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData, type Cobranca } from '../lib/store'
import { dataBR, quandoVence, reais } from '../lib/format'
import { linkWhats, msgCobranca, type Momento } from '../lib/whatsapp'
import { Badge, Button, Card, cx } from './ui'
import PagarSheet from './PagarSheet'

export function momentoDe(c: Cobranca): Momento {
  return c.situacao === 'atrasado' ? 'atrasado' : c.situacao === 'hoje' ? 'hoje' : 'antes'
}

export function linkCobrar(profile: ReturnType<typeof useData>['profile'], c: Cobranca): string | null {
  if (!c.client.whatsapp) return null
  return linkWhats(c.client.whatsapp, msgCobranca(profile, c.client, momentoDe(c), c.divida.devido, c.divida.vencimento, c.dias))
}

export default function CobrancaCard({ c, soCobrar }: { c: Cobranca; soCobrar?: boolean }) {
  const { profile } = useData()
  const [pagando, setPagando] = useState(false)
  const link = linkCobrar(profile, c)
  const cor = c.situacao === 'atrasado' ? 'red' : c.situacao === 'hoje' ? 'yellow' : 'green'
  const borda = { red: 'border-l-red-600', yellow: 'border-l-amber-400', green: 'border-l-emerald-600' }[cor]

  return (
    <Card className={cx('border-l-8', borda)}>
      <Link to={`/emprestimos/${c.loan.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{c.client.nome}</div>
            <div className="opacity-70 text-sm">Vence {dataBR(c.divida.vencimento)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-extrabold">{reais(c.divida.devido)}</div>
            <Badge cor={cor}>{quandoVence(c.dias)}</Badge>
          </div>
        </div>
        {(c.divida.multa > 0 || c.divida.mora > 0) && (
          <div className="text-sm mt-1 text-red-700 dark:text-red-300">Inclui multa {reais(c.divida.multa)} e mora {reais(c.divida.mora)}</div>
        )}
      </Link>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {link
          ? <a href={link} target="_blank" rel="noreferrer"><Button v="whats" block small>Cobrar no WhatsApp</Button></a>
          : <Button v="secondary" small disabled>Sem WhatsApp</Button>}
        {!soCobrar && <Button small onClick={() => setPagando(true)}>Recebi</Button>}
      </div>
      {pagando && <PagarSheet loan={c.loan} client={c.client} onFechar={() => setPagando(false)} />}
    </Card>
  )
}
