import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { criarClienteDeTeste } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && key)

// Sem chaves => MODO TESTE (dados só no navegador). Com chaves => Supabase de verdade.
export const supabase: SupabaseClient = configurado
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage } })
  : (criarClienteDeTeste() as unknown as SupabaseClient)
