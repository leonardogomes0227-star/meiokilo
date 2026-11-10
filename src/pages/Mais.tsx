import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useData } from '../lib/store'
import { Button, Card } from '../components/ui'

const itens = [
  ['/historico', '🧾', 'Histórico de pagamentos'],
  ['/relatorios', '📄', 'Relatórios e extratos'],
  ['/cobrar-atrasados', '💬', 'Cobrar todos os atrasados'],
  ['/config', '⚙️', 'Configurações e lembretes'],
]

export default function Mais() {
  const { profile } = useData()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">Mais</h1>
      {itens.map(([to, ic, r]) => (
        <Link key={to} to={to}><Card className="mb-3 flex items-center gap-3 min-h-14"><span className="text-2xl">{ic}</span><span className="font-semibold text-lg">{r}</span></Card></Link>
      ))}
      <p className="text-sm opacity-60 text-center pt-2">{profile.email}</p>
      <Button v="secondary" block onClick={() => supabase.auth.signOut()}>Sair da conta</Button>
    </div>
  )
}
