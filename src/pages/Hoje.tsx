import { Link } from 'react-router-dom'
import { useCobrancas, useData } from '../lib/store'
import { reais } from '../lib/format'
import CobrancaCard from '../components/CobrancaCard'
import { Button, Vazio } from '../components/ui'

export default function Hoje() {
  const { profile, clients, loans } = useData()
  const cob = useCobrancas()
  const atrasados = cob.filter((c) => c.situacao === 'atrasado')
  const hoje = cob.filter((c) => c.situacao === 'hoje')
  const proximos = cob.filter((c) => c.situacao === 'em_dia' && c.dias <= 7)
  const soma = (l: typeof cob) => reais(l.reduce((s, c) => s + c.divida.devido, 0))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">Olá{profile.nome ? `, ${profile.nome.split(' ')[0]}` : ''}! 👋</h1>
        <p className="opacity-70">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}</p>
      </header>

      {clients.length === 0 || loans.length === 0 ? (
        <Vazio titulo={clients.length === 0 ? 'Nenhum cliente ainda' : 'Nenhum empréstimo ainda'} texto="Cadastre para começar a controlar os vencimentos.">
          <Link to={clients.length === 0 ? '/clientes' : '/emprestimos/novo'}><Button>{clients.length === 0 ? 'Cadastrar cliente' : 'Criar empréstimo'}</Button></Link>
        </Vazio>
      ) : cob.length === 0 ? (
        <Vazio titulo="Nada para cobrar 🎉" texto="Não há empréstimos ativos." />
      ) : atrasados.length + hoje.length + proximos.length === 0 ? (
        <Vazio titulo="Tudo em dia ✅" texto="Ninguém vence hoje nem nos próximos 7 dias." />
      ) : null}

      <Secao titulo="Atrasados" cor="text-red-700 dark:text-red-300" lista={atrasados} total={soma(atrasados)}>
        {atrasados.length > 1 && <Link to="/cobrar-atrasados"><Button v="whats" block>Cobrar todos os atrasados</Button></Link>}
      </Secao>
      <Secao titulo="Vence hoje" cor="text-amber-700 dark:text-amber-300" lista={hoje} total={soma(hoje)} />
      <Secao titulo="Próximos 7 dias" cor="text-emerald-700 dark:text-emerald-300" lista={proximos} total={soma(proximos)} />
    </div>
  )
}

function Secao({ titulo, cor, lista, total, children }: { titulo: string; cor: string; lista: ReturnType<typeof useCobrancas>; total: string; children?: React.ReactNode }) {
  if (!lista.length) return null
  return (
    <section className="space-y-3">
      <h2 className={`text-lg font-bold flex justify-between ${cor}`}><span>{titulo} ({lista.length})</span><span>{total}</span></h2>
      {children}
      {lista.map((c) => <CobrancaCard key={c.loan.id} c={c} />)}
    </section>
  )
}
