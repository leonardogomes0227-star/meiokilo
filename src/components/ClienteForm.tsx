import { useState, type FormEvent } from 'react'
import { useData } from '../lib/store'
import { salvarCliente } from '../lib/ops'
import type { Client } from '../lib/types'
import { Button, Field, inputCls, useAcao } from './ui'
import { CampoAnexo } from './Anexo'

export default function ClienteForm({ cliente, onSalvo, rotuloBotao = 'Salvar' }: { cliente?: Client; onSalvo: (c: Client) => void; rotuloBotao?: string }) {
  const { reload } = useData()
  const { ocupado, rodar } = useAcao()
  const [f, setF] = useState({
    nome: cliente?.nome ?? '', whatsapp: cliente?.whatsapp ?? '', cpf: cliente?.cpf ?? '',
    endereco: cliente?.endereco ?? '', observacao: cliente?.observacao ?? '', anexo_path: cliente?.anexo_path ?? null as string | null,
  })
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    let salvo: Client | undefined
    const ok = await rodar(async () => {
      salvo = await salvarCliente({ ...(cliente ? { id: cliente.id } : {}), ...f, nome: f.nome.trim() })
      await reload()
    })
    if (ok && salvo) onSalvo(salvo)
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <Field label="Nome *"><input className={inputCls} required value={f.nome} onChange={(e) => set('nome')(e.target.value)} autoFocus={!cliente} /></Field>
      <Field label="WhatsApp" hint="Com DDD. Ex.: 11 91234-5678">
        <input className={inputCls} type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp')(e.target.value)} />
      </Field>
      <Field label="CPF (opcional)"><input className={inputCls} inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf')(e.target.value)} /></Field>
      <Field label="Endereço (opcional)"><input className={inputCls} value={f.endereco} onChange={(e) => set('endereco')(e.target.value)} /></Field>
      <Field label="Observações"><textarea className={inputCls} rows={2} value={f.observacao} onChange={(e) => set('observacao')(e.target.value)} /></Field>
      <CampoAnexo rotulo="Foto ou documento (opcional)" pasta="clientes" valor={f.anexo_path} onChange={(p) => setF((x) => ({ ...x, anexo_path: p }))} />
      <Button block type="submit" disabled={ocupado || !f.nome.trim()}>{ocupado ? 'Salvando…' : rotuloBotao}</Button>
    </form>
  )
}
