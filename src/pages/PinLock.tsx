import { useState } from 'react'
import { conferePin } from '../lib/pin'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function PinLock({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)

  async function digitar(d: string) {
    const novo = (pin + d).slice(0, 4)
    setPin(novo); setErro(false)
    if (novo.length === 4) {
      if (await conferePin(novo)) onOk()
      else { setErro(true); setTimeout(() => setPin(''), 400) }
    }
  }
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Digite seu PIN</h1>
      <div className="flex gap-3" aria-label={`${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-4 h-4 rounded-full border-2 ${i < pin.length ? 'bg-emerald-700 border-emerald-700' : 'border-current opacity-50'} ${erro ? 'border-red-500 bg-red-500' : ''}`} />
        ))}
      </div>
      {erro && <p className="text-red-600 font-semibold" role="alert">PIN incorreto</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => digitar(d)} className="h-16 rounded-2xl text-2xl font-bold bg-white dark:bg-white/10 shadow active:scale-95">{d}</button>
        ))}
        <button onClick={() => setPin(pin.slice(0, -1))} className="h-16 rounded-2xl text-xl" aria-label="Apagar">⌫</button>
        <button onClick={() => digitar('0')} className="h-16 rounded-2xl text-2xl font-bold bg-white dark:bg-white/10 shadow active:scale-95">0</button>
      </div>
      <Button v="ghost" small onClick={() => supabase.auth.signOut()}>Esqueci o PIN (sair da conta)</Button>
    </div>
  )
}
