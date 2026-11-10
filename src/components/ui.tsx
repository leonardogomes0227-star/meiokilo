import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

// ---------- botões ----------
type Variante = 'primary' | 'secondary' | 'danger' | 'whats' | 'ghost'
const V: Record<Variante, string> = {
  primary: 'bg-emerald-700 text-white active:bg-emerald-800 disabled:bg-emerald-700/50',
  secondary: 'bg-white text-emerald-900 border border-emerald-700/30 active:bg-emerald-50 dark:bg-white/10 dark:text-emerald-100 dark:border-white/20',
  danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-red-600/50',
  whats: 'bg-[#1fa855] text-white active:bg-[#168a45] disabled:opacity-50',
  ghost: 'text-emerald-800 dark:text-emerald-300 active:bg-emerald-700/10',
}
export function Button({ v = 'primary', block, small, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: Variante; block?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'rounded-xl font-semibold inline-flex items-center justify-center gap-2 select-none transition-colors disabled:cursor-not-allowed',
        small ? 'min-h-11 px-3 text-base' : 'min-h-14 px-5 text-lg',
        block && 'w-full', V[v], className,
      )}
    />
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-white dark:bg-white/[0.06] shadow-sm border border-black/5 dark:border-white/10 p-4', className)}>{children}</div>
}

// ---------- formulário ----------
export const inputCls =
  'w-full min-h-12 rounded-xl border border-black/15 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-sm opacity-60 mt-1">{hint}</span>}
    </label>
  )
}

export function Badge({ cor, children }: { cor: 'red' | 'yellow' | 'green' | 'gray'; children: ReactNode }) {
  const c = {
    red: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
    yellow: 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200',
    green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300',
    gray: 'bg-black/10 dark:bg-white/10',
  }[cor]
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', c)}>{children}</span>
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 space-y-3">
      <p className="text-lg font-semibold">{titulo}</p>
      {texto && <p className="opacity-70">{texto}</p>}
      {children}
    </div>
  )
}

// ---------- folha de baixo (modal) ----------
export function Sheet({ aberto, onFechar, titulo, children }: { aberto: boolean; onFechar: () => void; titulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', f)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', f); document.body.style.overflow = '' }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f4f6f5] dark:bg-[#121c18] p-4 safe-b shadow-2xl">
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#f4f6f5] dark:bg-[#121c18] py-1 z-10">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <button aria-label="Fechar" onClick={onFechar} className="min-h-11 min-w-11 text-2xl rounded-full active:bg-black/10">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- avisos e confirmações ----------
interface ToastItem { id: number; msg: string; desfazer?: () => Promise<void> | void; erro?: boolean }
interface UiCtx {
  aviso: (msg: string, opt?: { desfazer?: () => Promise<void> | void; erro?: boolean }) => void
  confirmar: (o: { titulo: string; texto: string; botao: string; perigo?: boolean }) => Promise<boolean>
}
const Ui = createContext<UiCtx | null>(null)
export const useUi = () => {
  const c = useContext(Ui)
  if (!c) throw new Error('UiProvider ausente')
  return c
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [conf, setConf] = useState<null | { titulo: string; texto: string; botao: string; perigo?: boolean; ok: (v: boolean) => void }>(null)
  const seq = useRef(0)

  const aviso = useCallback<UiCtx['aviso']>((msg, opt) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, msg, ...opt }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opt?.desfazer ? 10000 : opt?.erro ? 6000 : 3500)
  }, [])
  const confirmar = useCallback<UiCtx['confirmar']>((o) => new Promise((ok) => setConf({ ...o, ok })), [])

  return (
    <Ui.Provider value={{ aviso, confirmar }}>
      {children}
      <div className="fixed left-0 right-0 bottom-24 z-[60] px-3 space-y-2 pointer-events-none no-print">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto mx-auto max-w-lg rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-base',
            t.erro ? 'bg-red-700 text-white' : 'bg-neutral-900 text-white')}>
            <span className="flex-1">{t.msg}</span>
            {t.desfazer && (
              <button className="font-bold underline min-h-11 px-2" onClick={async () => {
                setToasts((x) => x.filter((y) => y.id !== t.id))
                try { await t.desfazer!() } catch (e) { aviso(e instanceof Error ? e.message : 'Não deu para desfazer.', { erro: true }) }
              }}>Desfazer</button>
            )}
          </div>
        ))}
      </div>
      {conf && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 no-print" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => { conf.ok(false); setConf(null) }} />
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-[#16231e] p-5 space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold">{conf.titulo}</h2>
            <p className="text-base opacity-80">{conf.texto}</p>
            <div className="grid gap-2">
              <Button v={conf.perigo ? 'danger' : 'primary'} block onClick={() => { conf.ok(true); setConf(null) }}>{conf.botao}</Button>
              <Button v="secondary" block onClick={() => { conf.ok(false); setConf(null) }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </Ui.Provider>
  )
}

/** Executa uma ação mostrando erro amigável; devolve true se deu certo. */
export function useAcao() {
  const { aviso } = useUi()
  const [ocupado, setOcupado] = useState(false)
  const rodar = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setOcupado(true)
    try { await fn(); return true }
    catch (e) { aviso(e instanceof Error ? e.message : 'Algo deu errado.', { erro: true }); return false }
    finally { setOcupado(false) }
  }, [aviso])
  return { ocupado, rodar }
}
