import { useState, type FormEvent } from 'react'
import { supabase, configurado } from '../lib/supabase'
import { Button, Field, inputCls } from '../components/ui'
import { apagarDadosDeTeste, entrarNoModoTeste } from '../lib/demo'

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (!configurado) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-5">
        <div className="w-full max-w-sm space-y-4 text-center">
          <img src="/icons/icon.svg" alt="" className="w-20 h-20 mx-auto rounded-2xl" />
          <h1 className="text-3xl font-extrabold">MeioKilo</h1>
          <p className="rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200 p-3 font-semibold">
            Modo teste: os dados ficam só neste aparelho e não vão para a internet.
          </p>
          <Button block onClick={() => entrarNoModoTeste(true)}>Entrar com dados de exemplo</Button>
          <Button v="secondary" block onClick={() => entrarNoModoTeste(false)}>Entrar vazio (começar do zero)</Button>
          <Button v="ghost" small onClick={() => { if (confirm('Apagar todos os dados de teste deste aparelho?')) apagarDadosDeTeste() }}>Apagar dados de teste</Button>
        </div>
      </div>
    )
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setMsg(''); setOcupado(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        if (!data.session) setMsg('Conta criada! Abra o e-mail que enviamos e confirme para entrar.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin })
        if (error) throw error
        setMsg('Enviamos um e-mail com o link para criar uma nova senha.')
      }
    } catch (x) {
      const m = x instanceof Error ? x.message : ''
      setErro(
        /Invalid login/i.test(m) ? 'E-mail ou senha incorretos.'
        : /already registered/i.test(m) ? 'Este e-mail já tem conta. Use "Entrar".'
        : /at least/i.test(m) ? 'A senha precisa ter pelo menos 6 caracteres.'
        : /Failed to fetch/i.test(m) ? 'Sem internet. Tente de novo.' : m || 'Não deu certo. Tente de novo.',
      )
    } finally { setOcupado(false) }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-5">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1 mb-4">
          <img src="/icons/icon.svg" alt="" className="w-20 h-20 mx-auto rounded-2xl" />
          <h1 className="text-3xl font-extrabold">MeioKilo</h1>
          <p className="opacity-70">Seus empréstimos e cobranças, sem esquecer ninguém.</p>
        </div>
        <Field label="E-mail">
          <input className={inputCls} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {modo !== 'esqueci' && (
          <Field label="Senha" hint={modo === 'criar' ? 'Pelo menos 6 caracteres.' : undefined}>
            <input className={inputCls} type="password" required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Field>
        )}
        {erro && <p role="alert" className="text-red-600 dark:text-red-400 font-semibold">{erro}</p>}
        {msg && <p role="status" className="text-emerald-700 dark:text-emerald-300 font-semibold">{msg}</p>}
        <Button block disabled={ocupado} type="submit">
          {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar minha conta' : 'Enviar e-mail'}
        </Button>
        <div className="flex flex-col items-center gap-1">
          {modo !== 'entrar' && <Button v="ghost" small onClick={() => setModo('entrar')}>Já tenho conta</Button>}
          {modo === 'entrar' && <Button v="ghost" small onClick={() => setModo('criar')}>Criar conta</Button>}
          {modo === 'entrar' && <Button v="ghost" small onClick={() => setModo('esqueci')}>Esqueci minha senha</Button>}
        </div>
      </form>
    </div>
  )
}
