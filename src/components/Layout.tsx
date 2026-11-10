import { NavLink, Outlet, Link } from 'react-router-dom'
import { useCobrancas } from '../lib/store'
import { reais } from '../lib/format'
import { cx } from './ui'

const ABAS = [
  { to: '/', rotulo: 'Hoje', icone: '📅', fim: true },
  { to: '/clientes', rotulo: 'Clientes', icone: '👥' },
  { to: '/emprestimos', rotulo: 'Empréstimos', icone: '💰' },
  { to: '/painel', rotulo: 'Painel', icone: '📊' },
  { to: '/mais', rotulo: 'Mais', icone: '⚙️' },
]

export default function Layout() {
  const cob = useCobrancas()
  const atrasados = cob.filter((c) => c.situacao === 'atrasado')
  const hoje = cob.filter((c) => c.situacao === 'hoje')
  const urgentes = atrasados.length + hoje.length
  const valorUrg = [...atrasados, ...hoje].reduce((s, c) => s + c.divida.devido, 0)

  return (
    <div className="min-h-dvh pb-24">
      {urgentes > 0 && (
        <Link to="/" className={cx('block safe-t px-4 py-2 text-center font-semibold text-base no-print',
          atrasados.length ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950')}>
          {hoje.length > 0 && `${hoje.length} vence${hoje.length > 1 ? 'm' : ''} hoje`}
          {hoje.length > 0 && atrasados.length > 0 && ' · '}
          {atrasados.length > 0 && `${atrasados.length} atrasado${atrasados.length > 1 ? 's' : ''}`}
          {` (${reais(valorUrg)})`}
        </Link>
      )}
      <main className="max-w-2xl mx-auto p-4"><Outlet /></main>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0f1a16]/95 backdrop-blur border-t border-black/10 dark:border-white/10 safe-b no-print" aria-label="Menu">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {ABAS.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.fim} className={({ isActive }) =>
              cx('relative flex flex-col items-center py-2 min-h-14 text-xs font-semibold', isActive ? 'text-emerald-700 dark:text-emerald-300' : 'opacity-70')}>
              <span className="text-2xl leading-none" aria-hidden>{a.icone}</span>
              {a.rotulo}
              {a.to === '/' && urgentes > 0 && (
                <span className="absolute top-1 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs grid place-items-center" aria-label={`${urgentes} pendentes`}>{urgentes}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
