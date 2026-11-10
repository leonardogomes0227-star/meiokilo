import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../lib/store'
import LoanForm from '../components/LoanForm'
import { Button, Vazio } from '../components/ui'

export default function EmprestimoNovo() {
  const nav = useNavigate()
  const { clients } = useData()
  const [sp] = useSearchParams()
  if (clients.length === 0) return <Vazio titulo="Cadastre um cliente primeiro"><Link to="/clientes"><Button>Ir para clientes</Button></Link></Vazio>
  return (
    <div className="space-y-3">
      <Link to="/emprestimos" className="underline">← Voltar</Link>
      <h1 className="text-2xl font-extrabold">Novo empréstimo</h1>
      <LoanForm clienteId={sp.get('cliente') ?? undefined} onSalvo={(id) => nav(`/emprestimos/${id}`, { replace: true })} />
    </div>
  )
}
