import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../lib/store'
import { adiar, amortizar, calcularDivida, quitar, valorQuitacao, diasParaVencer } from '@calc'
import { dataBR, num, paraCampo, quandoVence, reais } from '../lib/format'
import { TIPO_LABEL } from '../lib/types'
import { aplicar, desfazerPagamento, excluirEmprestimo, renegociar } from '../lib/ops'
import { linkCobrar } from '../components/CobrancaCard'
import PagarSheet from '../components/PagarSheet'
import LoanForm from '../components/LoanForm'
import { Badge, Button, Card, Field, Sheet, inputCls, useAcao, useUi } from '../components/ui'
import { reciboPdf } from '../lib/recibo'
import { linkGoogleAgenda } from '../lib/ics'

export default function EmprestimoDetalhe() {
  const { id } = useParams()
  const nav = useNavigate()
  const { loans, clients, payments, profile, hoje, reload } = useData()
  const { confirmar, aviso } = useUi()
  const { ocupado, rodar } = useAcao()
  const [painel, setPainel] = useState<null | 'pagar' | 'amortizar' | 'editar' | 'renegociar'>(null)
  const [valorAmort, setValorAmort] = useState('')

  const loan = loans.find((l) => l.id === id)
  const client = clients.find((c) => c.id === loan?.client_id)
  if (!loan || !client) return <div className="space-y-3"><Link to="/emprestimos" className="underline">← Empréstimos</Link><p>Empréstimo não encontrado.</p></div>

  const pgs = payments.filter((p) => p.loan_id === loan.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const ultimo = pgs[0]
  const ativo = loan.status === 'ativo'
  const d = calcularDivida(loan, profile, hoje)
  const dias = diasParaVencer(loan, hoje)
  const link = ativo ? linkCobrar(profile, { loan, client, divida: d, situacao: dias < 0 ? 'atrasado' : dias === 0 ? 'hoje' : 'em_dia', dias }) : null

  async function operacao(fn: () => ReturnType<typeof quitar>, msg: string) {
    await rodar(async () => {
      const r = fn()
      const pg = await aplicar(loan!.id, r)
      await reload()
      aviso(msg, { desfazer: async () => { await desfazerPagamento(pg.id); await reload() } })
    })
  }

  async function aoQuitar() {
    const v = valorQuitacao(loan!, profile, hoje)
    if (!(await confirmar({ titulo: 'Quitar empréstimo?', texto: `${client!.nome} paga ${reais(v)} (saldo + juros do mês${d.multa + d.mora > 0 ? ' + multa e mora' : ''}) e o empréstimo é encerrado.`, botao: `Quitar por ${reais(v)}` }))) return
    await operacao(() => quitar(loan!, profile, hoje), 'Empréstimo quitado.')
  }
  async function aoAdiar() {
    if (!(await confirmar({ titulo: 'Adiar vencimento?', texto: `O vencimento de ${dataBR(d.vencimento)} passa para o mês seguinte. Nada é cobrado agora.`, botao: 'Adiar 1 mês' }))) return
    await operacao(() => adiar(loan!, hoje), 'Vencimento adiado em 1 mês.')
  }
  async function aoAmortizar() {
    setPainel(null)
    await operacao(() => amortizar(loan!, num(valorAmort), hoje), `Abatido ${reais(num(valorAmort))} do que ele deve.`)
    setValorAmort('')
  }
  async function aoDesfazer() {
    if (!ultimo) return
    if (!(await confirmar({ titulo: 'Desfazer o último pagamento?', texto: `${TIPO_LABEL[ultimo.tipo]} de ${reais(ultimo.valor)} em ${dataBR(ultimo.data)} será apagado e o empréstimo volta ao que era antes.`, botao: 'Desfazer pagamento', perigo: true }))) return
    if (await rodar(async () => { await desfazerPagamento(ultimo.id); await reload() })) aviso('Pagamento desfeito.')
  }
  async function aoExcluir() {
    if (!(await confirmar({ titulo: 'Excluir empréstimo?', texto: 'O empréstimo e todo o histórico de pagamentos dele serão apagados.', botao: 'Excluir', perigo: true }))) return
    let restaurar: (() => Promise<void>) | undefined
    if (await rodar(async () => { restaurar = await excluirEmprestimo(loan!, pgs); await reload() })) {
      aviso('Empréstimo excluído.', { desfazer: async () => { await restaurar!(); await reload() } })
      nav('/emprestimos')
    }
  }

  return (
    <div className="space-y-4">
      <Link to={`/clientes/${client.id}`} className="underline">← {client.nome}</Link>
      <div className="flex justify-between items-start gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">{client.nome}</h1>
          <div className="opacity-70">{reais(loan.principal)} em {dataBR(loan.data_inicio)} · {loan.taxa_mes}% ao mês</div>
        </div>
        {!ativo && <Badge cor="gray">{loan.status === 'quitado' ? 'Quitado' : 'Renegociado'}</Badge>}
      </div>

      {ativo && (
        <Card className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="opacity-70">Quanto ainda deve</span><b className="text-2xl">{reais(loan.saldo)}</b>
          </div>
          <div className="flex justify-between"><span className="opacity-70">Próximo vencimento</span><b>{dataBR(d.vencimento)}</b></div>
          <div><Badge cor={dias < 0 ? 'red' : dias === 0 ? 'yellow' : 'green'}>{quandoVence(dias)}</Badge></div>
          <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1">
            <Linha a={loan.tipo === 'parcelas' ? `Parcela ${loan.meses_pagos + 1}/${loan.n_parcelas} + juros` : 'Juros do mês'} b={reais(d.cobranca)} />
            {d.multa > 0 && <Linha a="Multa" b={reais(d.multa)} />}
            {d.mora > 0 && <Linha a={`Mora (${d.diasAtraso} dias)`} b={reais(d.mora)} />}
            {d.parcialPago > 0 && <Linha a="Já pago neste mês" b={`− ${reais(d.parcialPago)}`} />}
            <div className="flex justify-between text-lg font-bold"><span>Devido agora</span><span>{reais(d.devido)}</span></div>
          </div>
        </Card>
      )}

      {ativo && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setPainel('pagar')}>Recebi</Button>
          {link ? <a href={link} target="_blank" rel="noreferrer"><Button v="whats" block>Cobrar</Button></a> : <Button v="secondary" disabled>Sem WhatsApp</Button>}
          <Button v="secondary" small onClick={() => setPainel('amortizar')}>Abater do principal</Button>
          <Button v="secondary" small onClick={aoQuitar} disabled={ocupado}>Quitar</Button>
          <Button v="secondary" small onClick={aoAdiar} disabled={ocupado}>Adiar 1 mês</Button>
          <Button v="secondary" small onClick={() => setPainel('renegociar')}>Renegociar</Button>
          <a href={linkGoogleAgenda(client.nome, d.vencimento, d.cobranca)} target="_blank" rel="noreferrer" className="col-span-2"><Button v="ghost" small block>Adicionar ao Google Agenda</Button></a>
        </div>
      )}

      {(loan.garantia || loan.observacao) && (
        <Card className="text-sm space-y-1">
          {loan.garantia && <div><b>Garantia:</b> {loan.garantia}</div>}
          {loan.observacao && <div className="whitespace-pre-line"><b>Obs.:</b> {loan.observacao}</div>}
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Histórico</h2>
        {pgs.length === 0 && <p className="opacity-70">Nenhum pagamento ainda.</p>}
        {pgs.map((p) => (
          <div key={p.id} className="flex justify-between items-center gap-2 border-b border-black/10 dark:border-white/10 py-2">
            <div>
              <div>{dataBR(p.data)} · {TIPO_LABEL[p.tipo]}{p.atrasado && <span className="text-red-600"> (atrasado)</span>}</div>
              {p.principal_pago > 0 && <div className="text-sm opacity-60">Principal {reais(p.principal_pago)} · Juros {reais(p.valor - p.principal_pago)}</div>}
            </div>
            <div className="flex items-center gap-2">
              <b>{reais(p.valor)}</b>
              {p.valor > 0 && <button className="text-sm underline min-h-11 px-1" onClick={() => reciboPdf(profile, client, loan, p)}>Recibo</button>}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {ultimo && ultimo.tipo !== 'renegociacao' && <Button v="secondary" small onClick={aoDesfazer} disabled={ocupado}>Desfazer último pagamento</Button>}
        <Button v="secondary" small onClick={() => setPainel('editar')}>Editar</Button>
        <Button v="ghost" small className="!text-red-600" onClick={aoExcluir} disabled={ocupado}>Excluir</Button>
      </div>

      {painel === 'pagar' && <PagarSheet loan={loan} client={client} onFechar={() => setPainel(null)} />}
      <Sheet aberto={painel === 'amortizar'} onFechar={() => setPainel(null)} titulo="Abater do principal">
        <div className="space-y-3">
          <p className="opacity-75">Ele paga uma parte do que pegou emprestado. O vencimento não muda, e os próximos juros ficam menores.</p>
          <Field label="Valor (R$)" hint={`Ele deve ${reais(loan.saldo)}`}><input className={inputCls + ' text-xl font-bold'} inputMode="decimal" value={valorAmort} onChange={(e) => setValorAmort(e.target.value)} autoFocus /></Field>
          <Button block disabled={ocupado || num(valorAmort) <= 0 || num(valorAmort) > loan.saldo} onClick={aoAmortizar}>Confirmar</Button>
        </div>
      </Sheet>
      <Sheet aberto={painel === 'editar'} onFechar={() => setPainel(null)} titulo="Editar empréstimo">
        <LoanForm emprestimo={loan} onSalvo={() => setPainel(null)} />
      </Sheet>
      {painel === 'renegociar' && <Reneg onFechar={() => setPainel(null)} saldo={loan.saldo} loanId={loan.id} garantia={loan.garantia} onFeito={(novo) => { setPainel(null); nav(`/emprestimos/${novo}`) }} />}
    </div>
  )
}

const Linha = ({ a, b }: { a: string; b: string }) => <div className="flex justify-between"><span className="opacity-75">{a}</span><span>{b}</span></div>

function Reneg({ onFechar, saldo, loanId, garantia, onFeito }: { onFechar: () => void; saldo: number; loanId: string; garantia: string; onFeito: (id: string) => void }) {
  const { hoje, reload } = useData()
  const { ocupado, rodar } = useAcao()
  const { confirmar } = useUi()
  const [f, setF] = useState({ valor: paraCampo(saldo), taxa: '10', data: hoje, tipo: 'juros', parcelas: '6' })
  async function ok() {
    if (!(await confirmar({ titulo: 'Renegociar?', texto: 'O empréstimo atual será encerrado e um novo será aberto com as condições abaixo. Isso não pode ser desfeito.', botao: 'Renegociar', perigo: true }))) return
    let novo = ''
    if (await rodar(async () => {
      novo = await renegociar(loanId, { principal: num(f.valor), taxa_mes: num(f.taxa), data_inicio: f.data, tipo: f.tipo, n_parcelas: f.tipo === 'parcelas' ? Math.max(1, Math.floor(num(f.parcelas))) : null, garantia, observacao: 'Renegociação' }, hoje)
      await reload()
    })) onFeito(novo)
  }
  return (
    <Sheet aberto onFechar={onFechar} titulo="Renegociar">
      <div className="space-y-3">
        <Field label="Novo valor (R$)" hint="Já vem com o saldo atual."><input className={inputCls} inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Juros ao mês (%)"><input className={inputCls} inputMode="decimal" value={f.taxa} onChange={(e) => setF({ ...f, taxa: e.target.value })} /></Field>
          <Field label="Nova data"><input className={inputCls} type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        </div>
        <Field label="Como vai pagar?">
          <select className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="juros">Só os juros todo mês</option><option value="parcelas">Parcelado</option></select>
        </Field>
        {f.tipo === 'parcelas' && <Field label="Parcelas"><input className={inputCls} inputMode="numeric" value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })} /></Field>}
        <Button block onClick={ok} disabled={ocupado || num(f.valor) <= 0}>Renegociar</Button>
      </div>
    </Sheet>
  )
}
