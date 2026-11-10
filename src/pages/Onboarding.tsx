import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/store'
import { salvarPerfil } from '../lib/ops'
import ClienteForm from '../components/ClienteForm'
import LoanForm from '../components/LoanForm'
import { Button, Field, inputCls, useAcao } from '../components/ui'

export default function Onboarding() {
  const { profile, setProfile, clients, loans } = useData()
  const nav = useNavigate()
  const { ocupado, rodar } = useAcao()
  const [passo, setPasso] = useState(1)
  const [nome, setNome] = useState(profile.nome)
  const [pix, setPix] = useState(profile.chave_pix)
  const [clienteId, setClienteId] = useState(clients[0]?.id ?? '')

  async function terminar() {
    await rodar(async () => setProfile(await salvarPerfil(profile.id, { onboarding_ok: true })))
    nav('/', { replace: true })
  }

  return (
    <div className="min-h-dvh max-w-md mx-auto p-5 space-y-5">
      <div className="text-center">
        <img src="/icons/icon.svg" alt="" className="w-16 h-16 mx-auto rounded-2xl" />
        <h1 className="text-2xl font-extrabold mt-2">Bem-vindo ao MeioKilo!</h1>
        <p className="opacity-70">Passo {passo} de 3</p>
        <div className="flex gap-2 mt-2">{[1, 2, 3].map((i) => <div key={i} className={`h-2 flex-1 rounded-full ${i <= passo ? 'bg-emerald-700' : 'bg-black/10 dark:bg-white/15'}`} />)}</div>
      </div>

      {passo === 1 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Quem é você?</h2>
          <Field label="Seu nome"><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Field>
          <Field label="Sua chave Pix" hint="Para mandar junto na cobrança. Pode deixar em branco."><input className={inputCls} value={pix} onChange={(e) => setPix(e.target.value)} /></Field>
          <Button block disabled={ocupado || !nome.trim()} onClick={async () => { if (await rodar(async () => setProfile(await salvarPerfil(profile.id, { nome: nome.trim(), chave_pix: pix.trim(), templates: { ...profile.templates, incluir_pix: !!pix.trim() } })))) setPasso(2) }}>Continuar</Button>
        </div>
      )}
      {passo === 2 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Cadastre o primeiro cliente</h2>
          {clients.length > 0
            ? <><p>Você já tem {clients.length} cliente(s). 👍</p><Button block onClick={() => setPasso(3)}>Continuar</Button></>
            : <ClienteForm rotuloBotao="Salvar e continuar" onSalvo={(c) => { setClienteId(c.id); setPasso(3) }} />}
        </div>
      )}
      {passo === 3 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Crie o primeiro empréstimo</h2>
          {loans.length > 0
            ? <><p>Você já tem empréstimos cadastrados. 👍</p><Button block onClick={terminar}>Começar a usar</Button></>
            : <LoanForm clienteId={clienteId || undefined} onSalvo={terminar} />}
        </div>
      )}
      <div className="text-center"><Button v="ghost" small onClick={terminar}>Pular por enquanto</Button></div>
    </div>
  )
}
