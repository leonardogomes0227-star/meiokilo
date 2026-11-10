import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../lib/store'
import { foneBonito, reais } from '../lib/format'
import { Button, Card, Sheet, Vazio, inputCls } from '../components/ui'
import ClienteForm from '../components/ClienteForm'

export default function Clientes() {
  const { clients, loans } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [novo, setNovo] = useState(false)
  const lista = clients.filter((c) => c.nome.toLowerCase().includes(q.trim().toLowerCase()))
  const saldoDe = (id: string) => loans.filter((l) => l.client_id === id && l.status === 'ativo').reduce((s, l) => s + l.saldo, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Clientes</h1>
        <Button small onClick={() => setNovo(true)}>+ Novo</Button>
      </div>
      {clients.length > 4 && <input className={inputCls} type="search" placeholder="Buscar pelo nome…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {clients.length === 0 && <Vazio titulo="Nenhum cliente" texto="Cadastre a primeira pessoa para quem você empresta."><Button onClick={() => setNovo(true)}>Cadastrar cliente</Button></Vazio>}
      {lista.map((c) => {
        const s = saldoDe(c.id)
        return (
          <Link key={c.id} to={`/clientes/${c.id}`}>
            <Card className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-bold text-lg truncate">{c.nome}</div>
                <div className="text-sm opacity-70">{c.whatsapp ? foneBonito(c.whatsapp) : 'Sem WhatsApp'}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm opacity-70">Deve</div>
                <div className="font-bold">{reais(s)}</div>
              </div>
            </Card>
          </Link>
        )
      })}
      {q && lista.length === 0 && <p className="text-center opacity-70">Ninguém com esse nome.</p>}
      <Sheet aberto={novo} onFechar={() => setNovo(false)} titulo="Novo cliente">
        <ClienteForm rotuloBotao="Cadastrar" onSalvo={(c) => { setNovo(false); nav(`/clientes/${c.id}`) }} />
      </Sheet>
    </div>
  )
}
