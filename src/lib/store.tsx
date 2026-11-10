import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Client, Loan, Payment, Profile } from './types'
import { calcularDivida, hojeISO, situacao, diasParaVencer, type Divida, type Situacao } from '@calc'

interface Ctx {
  session: Session
  profile: Profile
  clients: Client[]
  loans: Loan[]
  payments: Payment[]
  reload: () => Promise<void>
  setProfile: (p: Profile) => void
  hoje: string
}

const DataCtx = createContext<Ctx | null>(null)
export const useData = () => {
  const c = useContext(DataCtx)
  if (!c) throw new Error('DataProvider ausente')
  return c
}

// o Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
async function buscarTudo<T>(tabela: string, ordem: string): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabela).select('*').order(ordem).range(de, de + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export function DataProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [erro, setErro] = useState('')
  const [hoje, setHoje] = useState(hojeISO())

  const reload = useCallback(async () => {
    try {
      let { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (!p) {
        const r = await supabase.from('profiles').insert({ id: session.user.id, email: session.user.email }).select().single()
        if (r.error) throw r.error
        p = r.data
      }
      const [c, l, pg] = await Promise.all([
        buscarTudo<Client>('clients', 'nome'),
        buscarTudo<Loan>('loans', 'created_at'),
        buscarTudo<Payment>('payments', 'created_at'),
      ])
      setProfile(p as Profile)
      setClients(c)
      setLoans(l)
      setPayments(pg)
      setHoje(hojeISO())
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.')
    }
  }, [session.user.id, session.user.email])

  useEffect(() => { void reload() }, [reload])
  // ao voltar para o app (celular desbloqueado), atualiza a data e os dados
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [reload])

  if (erro && !profile) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <p className="text-lg font-semibold">Não consegui carregar seus dados.</p>
        <p className="text-sm opacity-70">{erro}</p>
        <button className="rounded-xl bg-emerald-700 text-white px-5 py-3 font-semibold" onClick={() => void reload()}>Tentar de novo</button>
      </div>
    )
  }
  if (!profile) return <div className="p-10 text-center opacity-60">Carregando…</div>
  return <DataCtx.Provider value={{ session, profile, clients, loans, payments, reload, setProfile, hoje }}>{children}</DataCtx.Provider>
}

export interface Cobranca {
  loan: Loan
  client: Client
  divida: Divida
  situacao: Situacao
  dias: number // dias para vencer (negativo = atrasado)
}

/** Empréstimos ativos com a situação de hoje, do mais urgente para o menos. */
export function useCobrancas(): Cobranca[] {
  const { loans, clients, profile, hoje } = useData()
  return useMemo(() => {
    const porId = new Map(clients.map((c) => [c.id, c]))
    return loans
      .filter((l) => l.status === 'ativo' && porId.has(l.client_id))
      .map((loan) => ({
        loan,
        client: porId.get(loan.client_id)!,
        divida: calcularDivida(loan, profile, hoje),
        situacao: situacao(loan, hoje),
        dias: diasParaVencer(loan, hoje),
      }))
      .sort((a, b) => a.dias - b.dias)
  }, [loans, clients, profile, hoje])
}
