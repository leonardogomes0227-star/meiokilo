import { Link } from 'react-router-dom'
import { useCobrancas, useData } from '../lib/store'
import { reais } from '../lib/format'
import { linkCobrar } from '../components/CobrancaCard'
import { Button, Card, Vazio } from '../components/ui'

export default function CobrarAtrasados() {
  const { profile } = useData()
  const lista = useCobrancas().filter((c) => c.situacao === 'atrasado')
  return (
    <div className="space-y-3">
      <Link to="/" className="underline">← Voltar</Link>
      <h1 className="text-2xl font-extrabold">Cobrar atrasados</h1>
      <p className="opacity-70">Toque em um por vez. O WhatsApp abre com a mensagem pronta.</p>
      {lista.length === 0 && <Vazio titulo="Ninguém atrasado 🎉" />}
      {lista.map((c) => {
        const link = linkCobrar(profile, c)
        return (
          <Card key={c.loan.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{c.client.nome}</div>
              <div className="text-sm opacity-70">{-c.dias} dias · {reais(c.divida.devido)}</div>
            </div>
            {link ? <a href={link} target="_blank" rel="noreferrer"><Button v="whats" small>Cobrar</Button></a> : <span className="text-sm opacity-60">Sem WhatsApp</span>}
          </Card>
        )
      })}
    </div>
  )
}
