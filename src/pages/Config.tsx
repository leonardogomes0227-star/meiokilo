import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/store'
import { salvarPerfil } from '../lib/ops'
import { MODELOS_PADRAO } from '../lib/whatsapp'
import { ativarPush, desativarPush, enviarTeste, estadoPush, ehIphone, instalado, type EstadoPush } from '../lib/push'
import { definirPin, removerPin, temPin } from '../lib/pin'
import { gerarIcs } from '../lib/ics'
import { baixarArquivo } from '../lib/csv'
import { montarBackup, restaurarBackup, validarBackup } from '../lib/backup'
import { num } from '../lib/format'
import { Button, Card, Field, inputCls, useAcao, useUi } from '../components/ui'
import type { Templates } from '../lib/types'

const PUSH_MSG: Record<EstadoPush, string> = {
  'sem-suporte': 'Este navegador não aceita notificações. Use o Chrome (Android) ou instale o app (iPhone).',
  'sem-chave': 'Falta configurar a chave VAPID (veja o README).',
  bloqueado: 'As notificações estão bloqueadas. Libere nas configurações do navegador/celular e volte aqui.',
  desligado: 'Notificações desligadas neste aparelho.',
  ligado: 'Notificações ligadas neste aparelho ✅',
  'precisa-instalar': 'No iPhone é preciso instalar o app primeiro (veja o passo a passo abaixo).',
}

export default function Config() {
  const { profile, setProfile, clients, loans, payments, hoje, session, reload } = useData()
  const { aviso, confirmar } = useUi()
  const { ocupado, rodar } = useAcao()
  const [p, setP] = useState({ ...profile, multa: String(profile.multa_pct).replace('.', ','), mora: String(profile.mora_pct_dia).replace('.', ',') })
  const [t, setT] = useState<Templates>(profile.templates)
  const [push, setPush] = useState<EstadoPush>('desligado')
  const [pin, setPin] = useState('')
  const [comPin, setComPin] = useState(temPin())
  const arq = useRef<HTMLInputElement>(null)

  useEffect(() => { void estadoPush().then(setPush) }, [])

  async function salvar() {
    const ok = await rodar(async () => {
      const novo = await salvarPerfil(profile.id, {
        nome: p.nome.trim(), chave_pix: p.chave_pix.trim(), assinatura: p.assinatura.trim(),
        multa_pct: num(p.multa), mora_pct_dia: num(p.mora), hora_resumo: p.hora_resumo, dias_aviso: p.dias_aviso,
        push_ativo: p.push_ativo, email_ativo: p.email_ativo, templates: t,
      })
      setProfile(novo)
    })
    if (ok) aviso('Configurações salvas.')
  }

  async function trocarPush() {
    await rodar(async () => {
      if (push === 'ligado') await desativarPush(); else await ativarPush()
      setPush(await estadoPush())
    })
  }

  async function fazerBackup() {
    baixarArquivo(`meiokilo-backup-${hoje}.json`, JSON.stringify(montarBackup(profile, clients, loans, payments), null, 2), 'application/json')
  }
  async function importar(f?: File) {
    if (!f) return
    try {
      const b = validarBackup(JSON.parse(await f.text()))
      if (!(await confirmar({ titulo: 'Importar backup?', texto: `${b.clientes.length} clientes, ${b.emprestimos.length} empréstimos e ${b.pagamentos.length} pagamentos serão adicionados. Itens que já existem são atualizados.`, botao: 'Importar' }))) return
      if (await rodar(async () => { await restaurarBackup(b, session.user.id); await reload() })) aviso('Backup importado.')
    } catch (e) { aviso(e instanceof Error ? e.message : 'Arquivo inválido.', { erro: true }) }
    if (arq.current) arq.current.value = ''
  }

  const area = (k: 'antes' | 'hoje' | 'atrasado' | 'recibo', r: string) => (
    <Field label={r}><textarea className={inputCls} rows={3} value={t[k] ?? MODELOS_PADRAO[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></Field>
  )

  return (
    <div className="space-y-4">
      <Link to="/mais" className="underline">← Mais</Link>
      <h1 className="text-2xl font-extrabold">Configurações</h1>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">Meus dados</h2>
        <Field label="Seu nome"><input className={inputCls} value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></Field>
        <Field label="Chave Pix" hint="Vai nas mensagens de cobrança, se você marcar abaixo."><input className={inputCls} value={p.chave_pix} onChange={(e) => setP({ ...p, chave_pix: e.target.value })} /></Field>
        <Field label="Assinatura das mensagens"><input className={inputCls} placeholder="Ex.: Abraço, João" value={p.assinatura} onChange={(e) => setP({ ...p, assinatura: e.target.value })} /></Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">Atraso</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Multa (% única)"><input className={inputCls} inputMode="decimal" value={p.multa} onChange={(e) => setP({ ...p, multa: e.target.value })} /></Field>
          <Field label="Mora (% ao dia)"><input className={inputCls} inputMode="decimal" value={p.mora} onChange={(e) => setP({ ...p, mora: e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">Mensagens do WhatsApp</h2>
        <p className="text-sm opacity-70">Use {'{nome} {valor} {data} {dias}'}. No recibo também: {'{saldo} {proximo}'}.</p>
        {area('antes', 'Antes do vencimento')}
        {area('hoje', 'No dia do vencimento')}
        {area('atrasado', 'Atrasado')}
        {area('recibo', 'Recibo')}
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" className="w-6 h-6" checked={!!t.incluir_pix} onChange={(e) => setT({ ...t, incluir_pix: e.target.checked })} />Incluir minha chave Pix</label>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" className="w-6 h-6" checked={!!t.incluir_assinatura} onChange={(e) => setT({ ...t, incluir_assinatura: e.target.checked })} />Incluir minha assinatura</label>
        <Button v="ghost" small onClick={() => setT({ incluir_pix: t.incluir_pix, incluir_assinatura: t.incluir_assinatura })}>Voltar às mensagens originais</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-lg">Lembretes de vencimento</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Resumo todo dia às">
            <select className={inputCls} value={p.hora_resumo} onChange={(e) => setP({ ...p, hora_resumo: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </Field>
          <Field label="Avisar antes">
            <select className={inputCls} value={p.dias_aviso} onChange={(e) => setP({ ...p, dias_aviso: Number(e.target.value) })}>
              <option value={0}>Só no dia</option><option value={1}>1 dia antes</option><option value={3}>3 dias antes</option><option value={7}>7 dias antes</option>
            </select>
          </Field>
        </div>
        <p className="text-sm opacity-70">Horário de Brasília. Às 18:00 você recebe um aviso extra se ainda houver cobrança do dia.</p>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" className="w-6 h-6" checked={p.push_ativo} onChange={(e) => setP({ ...p, push_ativo: e.target.checked })} />Avisar por notificação no celular</label>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" className="w-6 h-6" checked={p.email_ativo} onChange={(e) => setP({ ...p, email_ativo: e.target.checked })} />Avisar por e-mail ({profile.email})</label>

        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 space-y-2">
          <p className="font-semibold">{PUSH_MSG[push]}</p>
          {(push === 'desligado' || push === 'ligado') && <Button v={push === 'ligado' ? 'secondary' : 'primary'} small disabled={ocupado} onClick={trocarPush}>{push === 'ligado' ? 'Desligar neste aparelho' : 'Ativar notificações neste aparelho'}</Button>}
          {push === 'ligado' && <Button v="secondary" small disabled={ocupado} onClick={async () => { if (await rodar(enviarTeste)) aviso('Teste enviado. Olhe o celular!') }}>Enviar notificação de teste</Button>}
        </div>

        <details className="rounded-xl border border-black/10 dark:border-white/15 p-3" open={ehIphone() && !instalado()}>
          <summary className="font-semibold min-h-11 flex items-center">Como ativar no celular</summary>
          <div className="space-y-2 pt-2 text-base">
            <p><b>iPhone (iOS 16.4 ou mais novo):</b></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Abra este site no <b>Safari</b>.</li>
              <li>Toque no botão de compartilhar (quadrado com seta para cima).</li>
              <li>Toque em <b>“Adicionar à Tela de Início”</b> e confirme.</li>
              <li>Abra o <b>MeioKilo pelo ícone novo</b> na tela inicial e volte aqui.</li>
              <li>Toque em <b>“Ativar notificações neste aparelho”</b> e permita.</li>
            </ol>
            <p><b>Android (Chrome):</b> toque em “Ativar notificações neste aparelho” e permita. Se quiser, também use o menu ⋮ → “Instalar app”.</p>
          </div>
        </details>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold text-lg">Calendário</h2>
        <p className="text-sm opacity-70">Baixe um arquivo com os próximos 3 vencimentos de cada cliente e abra no Google Agenda ou no calendário do celular. Para um só, use o botão dentro do empréstimo.</p>
        <Button v="secondary" small onClick={() => baixarArquivo('vencimentos.ics', gerarIcs(loans, clients, profile, hoje), 'text/calendar')}>Baixar vencimentos (.ics)</Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold text-lg">PIN para abrir o app</h2>
        {comPin ? (
          <Button v="secondary" small onClick={() => { removerPin(); setComPin(false); aviso('PIN removido.') }}>Remover PIN</Button>
        ) : (
          <div className="flex gap-2">
            <input className={inputCls} inputMode="numeric" maxLength={4} placeholder="4 números" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <Button small disabled={pin.length !== 4} onClick={async () => { await definirPin(pin); setPin(''); setComPin(true); aviso('PIN ativado.') }}>Ativar</Button>
          </div>
        )}
        <p className="text-sm opacity-70">O PIN vale só neste aparelho.</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold text-lg">Backup</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button v="secondary" small onClick={fazerBackup}>Exportar tudo</Button>
          <Button v="secondary" small onClick={() => arq.current?.click()}>Importar</Button>
        </div>
        <input ref={arq} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
      </Card>

      <div className="sticky bottom-20 z-30"><Button block onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar configurações'}</Button></div>
    </div>
  )
}
