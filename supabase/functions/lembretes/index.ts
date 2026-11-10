// Edge Function "lembretes": envia o resumo diário por push e e-mail.
// Chamada de hora em hora pelo pg_cron (migração 0002). Em cada chamada, cada usuário
// só recebe se for a hora do resumo dele (horário de Brasília) ou 18:00 (aviso extra).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { calcularDivida, diasParaVencer, hojeISO, horaBrasilia, round2, situacao } from '../_shared/calc.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const temVapid = !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY'))
if (temVapid) webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:contato@exemplo.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })

interface Item { nome: string; valor: number; venc: string; dias: number }

async function itensDoUsuario(userId: string, perfil: any, hoje: string, diasAvisoMax: number) {
  const { data: loans } = await admin.from('loans').select('*').eq('user_id', userId).eq('status', 'ativo')
  const { data: clients } = await admin.from('clients').select('id,nome').eq('user_id', userId)
  const nomes = new Map<string, string>((clients ?? []).map((c: any) => [c.id, c.nome]))
  const hojeL: Item[] = [], atrasados: Item[] = [], proximos: Item[] = []
  for (const l of loans ?? []) {
    const d = calcularDivida(l, perfil, hoje)
    const dias = diasParaVencer(l, hoje)
    const it = { nome: nomes.get(l.client_id) ?? 'Cliente', valor: d.devido, venc: d.vencimento, dias }
    const s = situacao(l, hoje)
    if (s === 'atrasado') atrasados.push(it)
    else if (s === 'hoje') hojeL.push(it)
    else if (dias <= diasAvisoMax) proximos.push(it)
  }
  proximos.sort((a, b) => a.dias - b.dias)
  atrasados.sort((a, b) => a.dias - b.dias)
  return { hoje: hojeL, atrasados, proximos }
}

const soma = (l: Item[]) => round2(l.reduce((s, i) => s + i.valor, 0))

function textoPush(r: { hoje: Item[]; atrasados: Item[]; proximos: Item[] }, diasAviso: number) {
  const p: string[] = []
  if (r.hoje.length) p.push(`Hoje: ${r.hoje.length} ${r.hoje.length > 1 ? 'vencem' : 'vence'} (${brl(soma(r.hoje))})`)
  if (r.atrasados.length) p.push(`${r.atrasados.length} ${r.atrasados.length > 1 ? 'atrasados' : 'atrasado'} (${brl(soma(r.atrasados))})`)
  if (diasAviso > 0 && r.proximos.length) p.push(`${r.proximos.length} ${r.proximos.length > 1 ? 'vencem' : 'vence'} em até ${diasAviso} ${diasAviso > 1 ? 'dias' : 'dia'} (${brl(soma(r.proximos))})`)
  return p.join(' · ')
}

function htmlEmail(nome: string, r: { hoje: Item[]; atrasados: Item[]; proximos: Item[] }, appUrl: string) {
  const bloco = (titulo: string, cor: string, l: Item[], dias = false) => l.length === 0 ? '' : `
    <h3 style="margin:20px 0 6px;color:${cor}">${titulo} (${l.length}) · ${brl(soma(l))}</h3>
    <table style="width:100%;border-collapse:collapse">${l.map((i) => `
      <tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.nome)}${dias ? ` <span style="color:#777">· ${dataBR(i.venc)}</span>` : i.dias < 0 ? ` <span style="color:#777">· ${-i.dias} dias</span>` : ''}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right"><b>${brl(i.valor)}</b></td></tr>`).join('')}</table>`
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:16px">
    <h2 style="margin:0">Bom dia${nome ? ', ' + esc(nome.split(' ')[0]) : ''}! 👋</h2>
    <p style="color:#555">Resumo das suas cobranças de hoje.</p>
    ${bloco('Vencem hoje', '#b45309', r.hoje)}${bloco('Atrasados', '#b91c1c', r.atrasados)}${bloco('Próximos dias', '#047857', r.proximos, true)}
    <p style="margin-top:24px"><a href="${appUrl}" style="background:#047857;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o MeioKilo</a></p></div>`
}

async function enviarPush(userId: string, payload: object): Promise<number> {
  if (!temVapid) return 0
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId)
  let ok = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 12 })
      ok++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push falhou', e?.statusCode, e?.body)
    }
  }
  return ok
}

async function enviarEmail(para: string, assunto: string, html: string): Promise<boolean> {
  if (!env('RESEND_API_KEY')) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('EMAIL_FROM') || 'MeioKilo <onboarding@resend.dev>', to: [para], subject: assunto, html }),
  })
  if (!r.ok) console.error('email falhou', r.status, await r.text())
  return r.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({})
  const appUrl = env('APP_URL') || 'https://exemplo.vercel.app'
  const corpo = await req.json().catch(() => ({}))

  // ----- teste de notificação, pedido pelo app (usuário logado) -----
  if (corpo?.teste) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
    const { data } = await admin.auth.getUser(token)
    if (!data?.user) return json({ erro: 'não autorizado' }, 401)
    const enviados = await enviarPush(data.user.id, { title: 'MeioKilo', body: 'Notificações funcionando! ✅', url: '/', tag: 'teste' })
    return json({ enviados })
  }

  // ----- execução agendada (pg_cron) -----
  const segredo = env('CRON_SECRET')
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) return json({ erro: 'não autorizado' }, 401)

  const agora = new Date()
  const hora = horaBrasilia(agora)
  const hoje = hojeISO(agora)
  const { data: perfis } = await admin.from('profiles').select('*').or('push_ativo.eq.true,email_ativo.eq.true')
  const resumo: Record<string, unknown>[] = []

  for (const p of perfis ?? []) {
    const momento = hora === p.hora_resumo ? 'manha' : hora === 18 ? 'tarde' : null
    if (!momento) continue
    const r = await itensDoUsuario(p.id, p, hoje, Math.max(p.dias_aviso, momento === 'manha' && p.email_ativo ? 3 : 0))
    const paraPush = { ...r, proximos: r.proximos.filter((i) => i.dias <= p.dias_aviso) }

    // 18h: só se ainda houver cobrança de hoje sem receber
    if (momento === 'tarde' && r.hoje.length === 0) continue
    if (momento === 'manha' && r.hoje.length + r.atrasados.length + (p.dias_aviso > 0 ? paraPush.proximos.length : 0) + r.proximos.length === 0) continue

    // reserva o envio (evita repetir se o cron disparar duas vezes)
    const { error: dup } = await admin.from('lembretes_log').insert({ user_id: p.id, dia: hoje, tipo: momento })
    if (dup) continue

    let push = 0, email = false
    if (p.push_ativo) {
      const corpoPush = textoPush(paraPush, p.dias_aviso)
      if (corpoPush) push = await enviarPush(p.id, { title: momento === 'manha' ? 'Cobranças de hoje' : 'Ainda falta cobrar hoje', body: corpoPush, url: '/', tag: `resumo-${momento}` })
    }
    if (p.email_ativo && momento === 'manha' && p.email) {
      email = await enviarEmail(p.email, `MeioKilo: ${r.hoje.length} vencem hoje, ${r.atrasados.length} atrasados`, htmlEmail(p.nome, r, appUrl))
    }
    resumo.push({ usuario: p.id, momento, push, email })
  }
  return json({ ok: true, hora, hoje, enviados: resumo })
})
