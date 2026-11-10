import { supabase } from './supabase'
import type { Client, Loan, Payment, Profile } from './types'

export interface Backup {
  app: 'meiokilo'; versao: 1; exportado_em: string
  perfil: Partial<Profile>; clientes: Client[]; emprestimos: Loan[]; pagamentos: Payment[]
}

export function montarBackup(perfil: Profile, clientes: Client[], emprestimos: Loan[], pagamentos: Payment[]): Backup {
  const { id: _id, email: _e, ...p } = perfil
  void _id; void _e
  return { app: 'meiokilo', versao: 1, exportado_em: new Date().toISOString(), perfil: p, clientes, emprestimos, pagamentos }
}

export function validarBackup(x: unknown): Backup {
  const b = x as Backup
  if (!b || b.app !== 'meiokilo' || !Array.isArray(b.clientes) || !Array.isArray(b.emprestimos) || !Array.isArray(b.pagamentos))
    throw new Error('Este arquivo não é um backup do MeioKilo.')
  return b
}

async function enviarEmLotes(tabela: string, linhas: object[]) {
  for (let i = 0; i < linhas.length; i += 400) {
    const { error } = await supabase.from(tabela).upsert(linhas.slice(i, i + 400), { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
}

/** Restaura um backup para a conta atual (mesmos ids: importar de novo não duplica). */
export async function restaurarBackup(b: Backup, userId: string) {
  const dono = <T extends object>(l: T[]) => l.map((x) => ({ ...x, user_id: userId }))
  await enviarEmLotes('clients', dono(b.clientes))
  await enviarEmLotes('loans', dono(b.emprestimos))
  await enviarEmLotes('payments', dono(b.pagamentos))
  const { nome, chave_pix, assinatura, multa_pct, mora_pct_dia, templates } = b.perfil
  await supabase.from('profiles').update({ nome, chave_pix, assinatura, multa_pct, mora_pct_dia, templates }).eq('id', userId)
}
