import { useState, type FormEvent } from 'react'
import { useData } from '../lib/store'
import { criarEmprestimo, editarEmprestimo } from '../lib/ops'
import { simular, type TipoEmprestimo } from '@calc'
import type { Loan } from '../lib/types'
import { dataBR, num, paraCampo, reais } from '../lib/format'
import { Button, Card, Field, inputCls, useAcao } from './ui'
import { CampoAnexo } from './Anexo'

interface Props {
  clienteId?: string
  emprestimo?: Loan // se vier, é edição
  onSalvo: (id: string) => void
}

export default function LoanForm({ clienteId, emprestimo, onSalvo }: Props) {
  const { clients, hoje, reload } = useData()
  const { ocupado, rodar } = useAcao()
  const edit = !!emprestimo
  const [f, setF] = useState({
    client_id: emprestimo?.client_id ?? clienteId ?? '',
    valor: emprestimo ? paraCampo(emprestimo.principal) : '',
    taxa: emprestimo ? String(emprestimo.taxa_mes).replace('.', ',') : '10',
    data: emprestimo?.data_inicio ?? hoje,
    tipo: (emprestimo?.tipo ?? 'juros') as TipoEmprestimo,
    parcelas: String(emprestimo?.n_parcelas ?? 6),
    garantia: emprestimo?.garantia ?? '',
    foto: emprestimo?.garantia_foto_path ?? null as string | null,
    obs: emprestimo?.observacao ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const valor = num(f.valor), taxa = num(f.taxa), np = Math.max(1, Math.floor(num(f.parcelas)))
  const sim = valor > 0 ? simular({ valor, taxa_mes: taxa, data_inicio: f.data, tipo: f.tipo, n_parcelas: np }) : null

  async function enviar(e: FormEvent) {
    e.preventDefault()
    let id = emprestimo?.id ?? ''
    const ok = await rodar(async () => {
      if (edit) {
        await editarEmprestimo(emprestimo!.id, { taxa_mes: taxa, data_inicio: f.data, garantia: f.garantia, garantia_foto_path: f.foto, observacao: f.obs })
      } else {
        const l = await criarEmprestimo({
          client_id: f.client_id, principal: valor, saldo: valor, taxa_mes: taxa, data_inicio: f.data, tipo: f.tipo,
          n_parcelas: f.tipo === 'parcelas' ? np : null, garantia: f.garantia, garantia_foto_path: f.foto, observacao: f.obs,
        })
        id = l.id
      }
      await reload()
    })
    if (ok) onSalvo(id)
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {!edit && !clienteId && (
        <Field label="Cliente *">
          <select className={inputCls} required value={f.client_id} onChange={(e) => set('client_id', e.target.value)}>
            <option value="">Escolha…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
      )}
      {!edit && (
        <Field label="Quanto está emprestando (R$) *">
          <input className={inputCls + ' text-xl font-bold'} required inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => set('valor', e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Juros ao mês (%) *"><input className={inputCls} required inputMode="decimal" value={f.taxa} onChange={(e) => set('taxa', e.target.value)} /></Field>
        <Field label="Data do empréstimo *" hint={`Vence todo dia ${Number(f.data.slice(8, 10))}`}>
          <input className={inputCls} type="date" required value={f.data} onChange={(e) => set('data', e.target.value)} />
        </Field>
      </div>
      {!edit && (
        <>
          <Field label="Como vai pagar?">
            <div className="grid grid-cols-2 gap-2">
              {([['juros', 'Só os juros todo mês'], ['parcelas', 'Parcelado']] as const).map(([k, r]) => (
                <button type="button" key={k} onClick={() => set('tipo', k)}
                  className={`min-h-14 rounded-xl border-2 px-2 font-semibold ${f.tipo === k ? 'border-emerald-700 bg-emerald-700/10' : 'border-black/15 dark:border-white/20'}`}>{r}</button>
              ))}
            </div>
          </Field>
          {f.tipo === 'parcelas' && (
            <Field label="Número de parcelas"><input className={inputCls} inputMode="numeric" value={f.parcelas} onChange={(e) => set('parcelas', e.target.value)} /></Field>
          )}
        </>
      )}
      <Field label="Garantia (opcional)"><input className={inputCls} placeholder="Ex.: moto, relógio, cheque…" value={f.garantia} onChange={(e) => set('garantia', e.target.value)} /></Field>
      <CampoAnexo rotulo="Foto da garantia (opcional)" pasta="garantias" valor={f.foto} onChange={(p) => set('foto', p)} />
      <Field label="Observação"><textarea className={inputCls} rows={2} value={f.obs} onChange={(e) => set('obs', e.target.value)} /></Field>

      {!edit && sim && (
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 space-y-1" >
          <div className="font-bold">Confira antes de confirmar</div>
          <div className="flex justify-between"><span>1ª cobrança ({dataBR(sim.primeiroVencimento)})</span><b>{reais(sim.primeiraCobranca)}</b></div>
          {f.tipo === 'parcelas' ? (
            <>
              <div className="flex justify-between"><span>Total a receber</span><b>{reais(sim.totalReceber)}</b></div>
              <div className="flex justify-between"><span>Total de juros</span><b>{reais(sim.totalJuros)}</b></div>
            </>
          ) : (
            <p className="text-sm opacity-75">Todo mês ele paga {reais(sim.jurosPrimeiroMes)} de juros. O valor emprestado fica até ele quitar ou abater.</p>
          )}
        </Card>
      )}
      <Button block type="submit" disabled={ocupado || (!edit && (!f.client_id || valor <= 0))}>
        {ocupado ? 'Salvando…' : edit ? 'Salvar' : 'Confirmar empréstimo'}
      </Button>
    </form>
  )
}
