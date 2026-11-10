import { useEffect, useRef, useState } from 'react'
import { aplicar, desfazerPagamento } from '../lib/ops'
import { useData } from '../lib/store'
import { aplicarPagamento, calcularDivida, proximoVencimento, round2 } from '@calc'
import type { Client, Loan, Payment } from '../lib/types'
import { dataBR, num, paraCampo, reais } from '../lib/format'
import { linkWhats, msgRecibo } from '../lib/whatsapp'
import { reciboPdf } from '../lib/recibo'
import { Button, Field, Sheet, inputCls, useAcao, useUi } from './ui'

interface Props { loan: Loan; client: Client; onFechar: () => void }

export default function PagarSheet({ loan, client, onFechar }: Props) {
  const { profile, hoje, reload } = useData()
  const { aviso } = useUi()
  const { ocupado, rodar } = useAcao()
  const div = calcularDivida(loan, profile, hoje)
  const sugestao = div.devido > 0 ? div.devido : div.cobranca
  const [valor, setValor] = useState(paraCampo(sugestao))
  const [data, setData] = useState(hoje)
  const [feito, setFeito] = useState<{ pg: Payment; depois: Loan } | null>(null)
  // Só recarrega os dados quando esta janela fecha: se recarregasse antes, o cartão do cliente
  // sairia da lista (já está pago) e levaria a janela de "Pronto!" junto.
  const sujo = useRef(false)
  useEffect(() => () => { if (sujo.current) void reload() }, [reload])

  const v = num(valor)
  const d = calcularDivida(loan, profile, data)
  const alvo = d.devido > 0 ? d.devido : d.cobranca
  const falta = round2(alvo - v)
  const sobra = round2(v - alvo)

  async function confirmar() {
    let resultado: { pg: Payment; depois: Loan } | null = null
    const ok = await rodar(async () => {
      const r = aplicarPagamento(loan, v, data, profile)
      const pg = await aplicar(loan.id, r)
      resultado = { pg, depois: { ...loan, ...r.novo } }
      sujo.current = true
    })
    if (ok && resultado) setFeito(resultado)
  }

  async function desfazer() {
    if (!feito) return
    const ok = await rodar(async () => { await desfazerPagamento(feito.pg.id) })
    if (ok) { aviso('Pagamento desfeito.'); onFechar() }
  }

  if (feito) {
    const { pg, depois } = feito
    const parcial = pg.tipo === 'parcial'
    const msg = msgRecibo(profile, client, {
      valor: pg.valor, data: pg.data, saldo: depois.saldo, quitado: depois.status === 'quitado', parcial,
      proximo: depois.status === 'ativo' ? proximoVencimento(depois) : null,
      falta: parcial ? Math.max(0, calcularDivida(depois, profile, pg.data).devido) : 0,
    })
    return (
      <Sheet aberto onFechar={onFechar} titulo="Pronto! ✅">
        <div className="space-y-3">
          <p className="text-lg"><b>{reais(pg.valor)}</b> de {client.nome} registrado.</p>
          {depois.status === 'quitado'
            ? <p className="font-semibold text-emerald-700 dark:text-emerald-300">Empréstimo quitado 🎉</p>
            : parcial
              ? <p>Pagamento parcial. O vencimento continua em {dataBR(proximoVencimento(depois))}.</p>
              : <p>Próximo vencimento: <b>{dataBR(proximoVencimento(depois))}</b></p>}
          {client.whatsapp && (
            <a href={linkWhats(client.whatsapp, msg)} target="_blank" rel="noreferrer">
              <Button v="whats" block>Enviar recibo no WhatsApp</Button>
            </a>
          )}
          <Button v="secondary" block onClick={() => reciboPdf(profile, client, depois, pg)}>Recibo em PDF</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button v="ghost" onClick={desfazer} disabled={ocupado}>Desfazer</Button>
            <Button v="primary" onClick={onFechar}>Fechar</Button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet aberto onFechar={onFechar} titulo={`Recebi de ${client.nome.split(' ')[0]}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 space-y-1">
          <Linha a={loan.tipo === 'parcelas' ? 'Parcela + juros do mês' : 'Juros do mês'} b={reais(d.cobranca)} />
          {d.multa > 0 && <Linha a="Multa por atraso" b={reais(d.multa)} />}
          {d.mora > 0 && <Linha a={`Juros de mora (${d.diasAtraso} dias)`} b={reais(d.mora)} />}
          {d.parcialPago > 0 && <Linha a="Já pago neste mês" b={`− ${reais(d.parcialPago)}`} />}
          <div className="flex justify-between text-lg font-bold pt-1 border-t border-black/10 dark:border-white/10">
            <span>Total agora</span><span>{reais(alvo)}</span>
          </div>
        </div>
        <Field label="Valor recebido (R$)">
          <input className={inputCls + ' text-2xl font-bold'} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Field>
        <Field label="Data do recebimento">
          <input className={inputCls} type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value || hoje)} />
        </Field>
        {v > 0 && falta > 0.004 && <p className="text-amber-700 dark:text-amber-300 font-semibold">Pagamento parcial: ainda falta {reais(falta)}. O vencimento não muda.</p>}
        {v > 0 && sobra > 0.004 && <p className="text-emerald-700 dark:text-emerald-300 font-semibold">Passou {reais(sobra)} do valor: isso abate do que ele deve (principal).</p>}
        <Button block onClick={confirmar} disabled={ocupado || v <= 0}>{ocupado ? 'Registrando…' : 'Confirmar recebimento'}</Button>
      </div>
    </Sheet>
  )
}

const Linha = ({ a, b }: { a: string; b: string }) => <div className="flex justify-between"><span className="opacity-75">{a}</span><span>{b}</span></div>
