// MODO TESTE: quando não há chaves do Supabase, o app usa este "banco de mentira" guardado
// no próprio navegador (localStorage). Tem a mesma interface que o app usa do Supabase.
// Nada sai do aparelho. Serve só para testar; para uso de verdade, configure o Supabase.
import { hojeISO, somarDias, somarMeses } from '@calc'

const DB = 'mk_demo_db'
const ON = 'mk_demo_on'
export const DEMO_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_EMAIL = 'teste@modo-teste.local'

type Row = Record<string, any>
type Banco = Record<'profiles' | 'clients' | 'loans' | 'payments' | 'push_subscriptions', Row[]>

const vazio = (): Banco => ({
  profiles: [{
    id: DEMO_ID, email: DEMO_EMAIL, nome: '', chave_pix: '', assinatura: '', multa_pct: 2, mora_pct_dia: 0.1,
    hora_resumo: 8, dias_aviso: 1, push_ativo: true, email_ativo: true, onboarding_ok: false, templates: {},
  }],
  clients: [], loans: [], payments: [], push_subscriptions: [],
})

function ler(): Banco {
  try { const t = localStorage.getItem(DB); if (t) return JSON.parse(t) } catch { /* ignora */ }
  return vazio()
}
function gravar(b: Banco) {
  try { localStorage.setItem(DB, JSON.stringify(b)) }
  catch { throw new Error('Sem espaço no navegador para guardar os dados de teste.') }
}

let seq = 0
const agora = () => new Date(Date.now() + (seq++ % 1000) / 1000).toISOString()
const uuid = () => crypto.randomUUID()

const PADRAO: Record<string, Row> = {
  clients: { whatsapp: '', cpf: '', endereco: '', observacao: '', anexo_path: null },
  loans: { meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo', garantia: '', garantia_foto_path: null, observacao: '', n_parcelas: null },
  payments: { principal_pago: 0, atrasado: false, snapshot: {}, vencimento_ref: null },
  push_subscriptions: { user_agent: '' },
}

const ERRO_FK = 'violates foreign key constraint'

export function semear(comExemplos: boolean) {
  const b = vazio()
  if (comExemplos) {
    const hoje = hojeISO()
    const inicioPara = (dias: number) => somarMeses(somarDias(hoje, dias), -1)
    const cli = (nome: string, w: string) => ({ id: uuid(), user_id: DEMO_ID, nome, whatsapp: w, cpf: '', endereco: '', observacao: '', anexo_path: null, created_at: agora() })
    const [maria, joao, ana, pedro] = [cli('Maria Aparecida (exemplo)', '11987654321'), cli('João Pereira (exemplo)', '21999998888'), cli('Ana Lima (exemplo)', '31988887777'), cli('Pedro Alves (exemplo)', '')]
    b.clients.push(maria, joao, ana, pedro)
    const loan = (c: Row, valor: number, taxa: number, dias: number, tipo = 'juros', n: number | null = null) => ({
      id: uuid(), user_id: DEMO_ID, client_id: c.id, principal: valor, saldo: valor, taxa_mes: taxa, data_inicio: inicioPara(dias),
      tipo, n_parcelas: n, meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo', garantia: '', garantia_foto_path: null, observacao: '', created_at: agora(),
    })
    const l1 = loan(maria, 2000, 10, -5), l2 = loan(joao, 1500, 8, 0), l3 = loan(ana, 1200, 5, 3, 'parcelas', 6), l4 = loan(pedro, 5000, 6, 20)
    l1.garantia = 'Moto Honda'
    b.loans.push(l1, l2, l3, l4)
    b.payments.push({
      id: uuid(), user_id: DEMO_ID, loan_id: l1.id, data: somarDias(hoje, -20), valor: 200, tipo: 'juros', principal_pago: 0,
      vencimento_ref: somarDias(hoje, -20), atrasado: true,
      snapshot: { saldo: 2000, meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo' }, created_at: agora(),
    })
    b.profiles[0].nome = 'Teste'
    b.profiles[0].onboarding_ok = true
  }
  gravar(b)
}

class Consulta implements PromiseLike<{ data: any; error: { message: string } | null }> {
  private acao: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private dados: any
  private filtros: [string, unknown][] = []
  private ordem?: string
  private faixa?: [number, number]
  private retorna = false
  private modo: 'varios' | 'um' | 'talvez' = 'varios'
  private conflito = 'id'
  constructor(private tabela: keyof Banco) {}

  select() { this.retorna = true; return this }
  insert(d: any) { this.acao = 'insert'; this.dados = d; return this }
  update(d: any) { this.acao = 'update'; this.dados = d; return this }
  upsert(d: any, o?: { onConflict?: string }) { this.acao = 'upsert'; this.dados = d; if (o?.onConflict) this.conflito = o.onConflict; return this }
  delete() { this.acao = 'delete'; return this }
  eq(c: string, v: unknown) { this.filtros.push([c, v]); return this }
  order(c: string) { this.ordem = c; return this }
  range(a: number, b: number) { this.faixa = [a, b]; return this }
  single() { this.modo = 'um'; return this }
  maybeSingle() { this.modo = 'talvez'; return this }

  then<A, B>(ok?: ((v: { data: any; error: { message: string } | null }) => A | PromiseLike<A>) | null, no?: ((e: any) => B | PromiseLike<B>) | null) {
    let r: { data: any; error: { message: string } | null }
    try { r = { data: this.rodar(), error: null } } catch (e) { r = { data: null, error: { message: e instanceof Error ? e.message : 'Erro' } } }
    return Promise.resolve(r).then(ok, no)
  }

  private casa(l: Row) { return this.filtros.every(([c, v]) => l[c] === v) }

  private rodar() {
    const b = ler()
    const t = b[this.tabela]
    let saida: Row[] = []
    if (this.acao === 'insert' || this.acao === 'upsert') {
      const novos: Row[] = (Array.isArray(this.dados) ? this.dados : [this.dados]).map((d: Row): Row => ({
        ...PADRAO[this.tabela], id: uuid(), user_id: DEMO_ID, created_at: agora(), ...d,
      }))
      for (const n of novos) {
        if (this.tabela === 'loans' && !b.clients.some((c) => c.id === n.client_id)) throw new Error('Cliente não encontrado.')
        const i = this.acao === 'upsert' ? t.findIndex((x) => x[this.conflito] === n[this.conflito]) : -1
        if (i >= 0) t[i] = { ...t[i], ...n }; else t.push(n)
        saida.push(n)
      }
    } else if (this.acao === 'update') {
      for (let i = 0; i < t.length; i++) if (this.casa(t[i])) { t[i] = { ...t[i], ...this.dados }; saida.push(t[i]) }
    } else if (this.acao === 'delete') {
      const fora = t.filter((l) => this.casa(l))
      if (this.tabela === 'clients' && fora.some((c) => b.loans.some((l) => l.client_id === c.id))) throw new Error(`${ERRO_FK}: cliente tem empréstimos`)
      b[this.tabela] = t.filter((l) => !this.casa(l))
      if (this.tabela === 'loans') { const ids = new Set(fora.map((l) => l.id)); b.payments = b.payments.filter((p) => !ids.has(p.loan_id)) }
    } else {
      saida = t.filter((l) => this.casa(l))
      const o = this.ordem
      if (o) saida = [...saida].sort((x, y) => (x[o] > y[o] ? 1 : x[o] < y[o] ? -1 : 0))
      if (this.faixa) saida = saida.slice(this.faixa[0], this.faixa[1] + 1)
    }
    if (this.acao !== 'select') gravar(b)
    if (this.acao !== 'select' && !this.retorna) return null
    if (this.modo === 'varios') return saida
    if (this.modo === 'talvez') return saida[0] ?? null
    if (!saida[0]) throw new Error('Registro não encontrado.')
    return saida[0]
  }
}

function rpc(nome: string, a: Row) {
  const b = ler()
  const loan = (id: string) => b.loans.find((l) => l.id === id)
  if (nome === 'aplicar_operacao') {
    const l = loan(a.p_loan_id)
    if (!l) throw new Error('Empréstimo não encontrado.')
    Object.assign(l, a.p_estado)
    const pg = { id: uuid(), user_id: DEMO_ID, created_at: agora(), ...a.p_pagamento }
    b.payments.push(pg)
    gravar(b)
    return pg
  }
  if (nome === 'desfazer_pagamento') {
    const pg = b.payments.find((p) => p.id === a.p_payment_id)
    if (!pg) throw new Error('Pagamento não encontrado.')
    const ultimo = b.payments.filter((p) => p.loan_id === pg.loan_id).sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0]
    if (ultimo.id !== pg.id) throw new Error('Só é possível desfazer o último pagamento do empréstimo.')
    if (pg.tipo === 'renegociacao') throw new Error('Uma renegociação não pode ser desfeita.')
    Object.assign(loan(pg.loan_id)!, pg.snapshot)
    b.payments = b.payments.filter((p) => p.id !== pg.id)
    gravar(b)
    return null
  }
  if (nome === 'renegociar') {
    const old = loan(a.p_loan_id)
    if (!old) throw new Error('Empréstimo não encontrado.')
    if (old.status !== 'ativo') throw new Error('Este empréstimo não está ativo.')
    const n = a.p_novo
    const novo = {
      ...PADRAO.loans, id: uuid(), user_id: DEMO_ID, client_id: old.client_id, principal: n.principal, saldo: n.principal,
      taxa_mes: n.taxa_mes, data_inicio: n.data_inicio, tipo: n.tipo, n_parcelas: n.n_parcelas ?? null,
      garantia: n.garantia ?? old.garantia, garantia_foto_path: old.garantia_foto_path, observacao: n.observacao ?? '', created_at: agora(),
    }
    b.loans.push(novo)
    b.payments.push({
      id: uuid(), user_id: DEMO_ID, loan_id: old.id, data: a.p_data, valor: 0, tipo: 'renegociacao', principal_pago: 0, vencimento_ref: null, atrasado: false, created_at: agora(),
      snapshot: { saldo: old.saldo, meses_pagos: old.meses_pagos, meses_adiados: old.meses_adiados, valor_parcial_pago: old.valor_parcial_pago, status: old.status },
    })
    old.status = 'renegociado'
    gravar(b)
    return novo.id
  }
  throw new Error('Função não existe no modo teste.')
}

const sessao = () => ({ access_token: 'demo', user: { id: DEMO_ID, email: DEMO_EMAIL } })
const ouvintes = new Set<(e: string, s: any) => void>()
const ligado = () => { try { return localStorage.getItem(ON) === '1' } catch { return false } }
const avisar = () => ouvintes.forEach((f) => f(ligado() ? 'SIGNED_IN' : 'SIGNED_OUT', ligado() ? sessao() : null))

export function entrarNoModoTeste(comExemplos: boolean) {
  semear(comExemplos)
  localStorage.setItem(ON, '1')
  avisar()
}
export function apagarDadosDeTeste() {
  localStorage.removeItem(DB)
  Object.keys(localStorage).filter((k) => k.startsWith('mk_demo_file:')).forEach((k) => localStorage.removeItem(k))
}

export function criarClienteDeTeste() {
  return {
    auth: {
      getSession: async () => ({ data: { session: ligado() ? sessao() : null }, error: null }),
      onAuthStateChange: (f: (e: string, s: any) => void) => {
        ouvintes.add(f)
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(f) } } }
      },
      signOut: async () => { localStorage.removeItem(ON); avisar(); return { error: null } },
      signInWithPassword: async () => ({ error: { message: 'Modo teste: use o botão "Entrar no modo teste".' } }),
      signUp: async () => ({ data: {}, error: { message: 'Modo teste: use o botão "Entrar no modo teste".' } }),
      resetPasswordForEmail: async () => ({ error: { message: 'Modo teste: não há senha.' } }),
    },
    from: (t: keyof Banco) => new Consulta(t),
    rpc: async (nome: string, args: Row) => {
      try { return { data: rpc(nome, args), error: null } } catch (e) { return { data: null, error: { message: e instanceof Error ? e.message : 'Erro' } } }
    },
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => {
          try {
            const url = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new Error('x')); r.readAsDataURL(blob) })
            localStorage.setItem('mk_demo_file:' + path, url)
            return { error: null }
          } catch { return { error: { message: 'Sem espaço no navegador para guardar a foto de teste.' } } }
        },
        createSignedUrl: async (path: string) => ({ data: { signedUrl: localStorage.getItem('mk_demo_file:' + path) }, error: null }),
        remove: async (paths: string[]) => { paths.forEach((p) => localStorage.removeItem('mk_demo_file:' + p)); return { error: null } },
      }),
    },
    functions: { invoke: async () => ({ data: { enviados: 0 }, error: null }) },
  }
}
