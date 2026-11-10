import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, configurado } from './lib/supabase'
import { DataProvider } from './lib/store'
import { temPin } from './lib/pin'
import Login from './pages/Login'
import PinLock from './pages/PinLock'
import Layout from './components/Layout'
import Onboarding from './pages/Onboarding'
import { useData } from './lib/store'
import Hoje from './pages/Hoje'
import Clientes from './pages/Clientes'
import ClienteFicha from './pages/ClienteFicha'
import Emprestimos from './pages/Emprestimos'
import EmprestimoNovo from './pages/EmprestimoNovo'
import EmprestimoDetalhe from './pages/EmprestimoDetalhe'
import Painel from './pages/Painel'
import Mais from './pages/Mais'
import Historico from './pages/Historico'
import Relatorios from './pages/Relatorios'
import Config from './pages/Config'
import CobrarAtrasados from './pages/CobrarAtrasados'

function Privado() {
  const { profile } = useData()
  if (!profile.onboarding_ok) return <Onboarding />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hoje />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteFicha />} />
        <Route path="emprestimos" element={<Emprestimos />} />
        <Route path="emprestimos/novo" element={<EmprestimoNovo />} />
        <Route path="emprestimos/:id" element={<EmprestimoDetalhe />} />
        <Route path="painel" element={<Painel />} />
        <Route path="mais" element={<Mais />} />
        <Route path="historico" element={<Historico />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="config" element={<Config />} />
        <Route path="cobrar-atrasados" element={<CobrarAtrasados />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [travado, setTravado] = useState(temPin())

  useEffect(() => {
    if (!configurado) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // trava de novo se o app ficou mais de 1 minuto em segundo plano
  useEffect(() => {
    let saiu = 0
    const f = () => {
      if (document.visibilityState === 'hidden') saiu = Date.now()
      else if (saiu && Date.now() - saiu > 60_000 && temPin()) setTravado(true)
    }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  if (session === undefined) return <div className="p-10 text-center opacity-60">Carregando…</div>
  if (!session) return <Login />
  if (travado) return <PinLock onOk={() => setTravado(false)} />
  return (
    <DataProvider session={session}>
      <Privado />
    </DataProvider>
  )
}
