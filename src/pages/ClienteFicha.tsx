import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/store'
import { calcularDivida, scorePontualidade, situacao } from '@calc'
import { dataBR, foneBonito, reais } from '../lib/format'
import { TIPO_LABEL } from '../lib/types'
import { excluirCliente } from '../lib/ops'
import { extratoPdf } from '../lib/recibo'
import { Badge, Button, Card, Sheet, useAcao, useUi } from '../components/ui'
import ClienteForm from '../components/ClienteForm'
import { linkWhats } from '../lib/whatsapp'

export default function ClienteFicha() {
  const { id } = useParams()
  const nav = useNavigate()
  const { clients, loans, payments, profile, hoje, reload } = useData()
  const { confirmar, aviso } = useUi()
  const { rodar } = useAcao()
  const [editando, setEditando] = useState(false)
  const c = clients.find((x) => x.id === id)
  if (!c) return <div className="space-y-3"><Link to="/clientes" className="underline">← Clientes</Link><p>Cliente não encontrado.</p></div>

  const emp = loans.filter((l) => l.client_id === c.id)
  const ids = new Set(emp.map((l) => l.id))
  const pgs = payments.filter((p) => ids.has(p.loan_id)).sort((a, b) => (b.data + b.created_at).localeCompare(a.data + a.created_at))
  const ativos = emp.filter((l) => l.status === 'ativo')
  const totalEmprestado = emp.filter((l) => l.status !== 'renegociado').reduce((s, l) => s + l.principal, 0)
  const totalPago = pgs.reduce((s, p) => s + p.valor, 0)
  const saldo = ativos.reduce((s, l) => s + l.saldo, 0)
  const atrasoAgora = ativos.some((l) => situacao(l, hoje) === 'atrasado')
  const score = scorePontualidade(pgs, atrasoAgora)
  const corSelo = score.selo === 'Bom pagador' ? 'green' : score.selo === 'Atrasa às vezes' ? 'yellow' : score.selo === 'Atenção' ? 'red' : 'gray'

  async function excluir() {
    if (!(await confirmar({ titulo: `Excluir ${c!.nome}?`, texto: 'O cadastro será apagado de vez. Só é possível se ele não tiver empréstimos.', botao: 'Excluir cliente', perigo: true }))) return
    if (await rodar(async () => { await excluirCliente(c!.id); await reload() })) { aviso('Cliente excluído.'); nav('/clientes') }
  }

  return (
    <div className="space-y-4">
      <Link to="/clientes" className="underline">← Clientes</Link>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">{c.nome}</h1>
          <div className="opacity-70">{c.whatsapp ? foneBonito(c.whatsapp) : 'Sem WhatsApp'}</div>
        </div>
        <Badge cor={corSelo}>{score.selo}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Resumo r="Emprestado" v={reais(totalEmprestado)} />
        <Resumo r="Já pagou" v={reais(totalPago)} />
        <Resumo r="Ainda deve" v={reais(saldo)} destaque />
      </div>
      {score.total > 0 && <p className="text-sm opacity-70">Pagou atrasado {score.atrasos} de {score.total} vezes.</p>}

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/emprestimos/novo?cliente=${c.id}`}><Button block small>+ Novo empréstimo</Button></Link>
        {c.whatsapp ? <a href={linkWhats(c.whatsapp, `Olá ${c.nome.split(' ')[0]}!`)} target="_blank" rel="noreferrer"><Button v="whats" block small>WhatsApp</Button></a> : <span />}
        <Button v="secondary" small onClick={() => setEditando(true)}>Editar</Button>
        <Button v="secondary" small onClick={() => extratoPdf(profile, c, emp.map((l) => ({ loan: l, pagamentos: payments.filter((p) => p.loan_id === l.id).sort((a, b) => a.data.localeCompare(b.data)) })))}>Extrato em PDF</Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Empréstimos ({ativos.length} ativos · {emp.length - ativos.length} encerrados)</h2>
        {emp.length === 0 && <p className="opacity-70">Nenhum empréstimo ainda.</p>}
        {emp.map((l) => {
          const d = calcularDivida(l, profile, hoje)
          return (
            <Link key={l.id} to={`/emprestimos/${l.id}`}>
              <Card className="mb-2 flex justify-between items-center">
                <div>
                  <div className="font-bold">{reais(l.principal)} · {l.taxa_mes}% ao mês</div>
                  <div className="text-sm opacity-70">{dataBR(l.data_inicio)} · {l.tipo === 'juros' ? 'só juros' : `${l.meses_pagos}/${l.n_parcelas} parcelas`}</div>
                </div>
                {l.status === 'ativo'
                  ? <div className="text-right"><div className="font-bold">{reais(l.saldo)}</div><Badge cor={d.diasAtraso > 0 ? 'red' : 'green'}>{d.diasAtraso > 0 ? 'Atrasado' : 'Em dia'}</Badge></div>
                  : <Badge cor="gray">{l.status === 'quitado' ? 'Quitado' : 'Renegociado'}</Badge>}
              </Card>
            </Link>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Pagamentos</h2>
        {pgs.length === 0 && <p className="opacity-70">Ainda não pagou nada.</p>}
        {pgs.slice(0, 30).map((p) => (
          <div key={p.id} className="flex justify-between border-b border-black/10 dark:border-white/10 py-2">
            <span>{dataBR(p.data)} · {TIPO_LABEL[p.tipo]}{p.atrasado && <span className="text-red-600"> (atrasado)</span>}</span>
            <b>{reais(p.valor)}</b>
          </div>
        ))}
      </section>

      {(c.endereco || c.cpf || c.observacao) && (
        <Card className="text-sm space-y-1">
          {c.cpf && <div><b>CPF:</b> {c.cpf}</div>}
          {c.endereco && <div><b>Endereço:</b> {c.endereco}</div>}
          {c.observacao && <div><b>Obs.:</b> {c.observacao}</div>}
        </Card>
      )}
      <Button v="ghost" small onClick={excluir} className="!text-red-600">Excluir cliente</Button>
      <Sheet aberto={editando} onFechar={() => setEditando(false)} titulo="Editar cliente">
        <ClienteForm cliente={c} onSalvo={() => setEditando(false)} />
      </Sheet>
    </div>
  )
}

const Resumo = ({ r, v, destaque }: { r: string; v: string; destaque?: boolean }) => (
  <Card className={`!p-2 ${destaque ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}><div className="text-xs opacity-70">{r}</div><div className="font-bold text-sm sm:text-base">{v}</div></Card>
)
