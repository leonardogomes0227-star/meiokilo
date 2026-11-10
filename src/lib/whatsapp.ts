import { dataBR, reais, soDigitos } from './format'
import type { Client, Profile, Templates } from './types'

export const MODELOS_PADRAO = {
  antes: 'Olá {nome}! Passando para lembrar que o seu pagamento de {valor} vence em {data} (em {dias} dias). Qualquer dúvida, é só chamar.',
  hoje: 'Olá {nome}! Hoje vence o seu pagamento de {valor}. Pode me avisar quando fizer?',
  atrasado: 'Olá {nome}, tudo bem? O seu pagamento de {valor} venceu em {data} (há {dias} dias). Consegue acertar hoje?',
  recibo: 'Olá {nome}! Recebi {valor} em {data}. Obrigado! {saldo} {proximo}',
}

export type Momento = 'antes' | 'hoje' | 'atrasado'

export function fone55(s: string): string {
  const d = soDigitos(s)
  if (d.length === 10 || d.length === 11) return '55' + d
  return d
}

export function linkWhats(fone: string, msg: string): string {
  return `https://wa.me/${fone55(fone)}?text=${encodeURIComponent(msg)}`
}

function preencher(modelo: string, vars: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`).replace(/ +/g, ' ').trim()
}

function rodape(p: Profile): string {
  const t = p.templates
  let r = ''
  if (t.incluir_pix && p.chave_pix) r += `\n\nChave Pix: ${p.chave_pix}`
  if (t.incluir_assinatura && p.assinatura) r += `\n\n${p.assinatura}`
  return r
}

export function msgCobranca(p: Profile, c: Client, momento: Momento, valor: number, vencimento: string, dias: number): string {
  const t: Templates = p.templates
  const modelo = t[momento] || MODELOS_PADRAO[momento]
  const primeiro = c.nome.trim().split(/\s+/)[0]
  return preencher(modelo, { nome: primeiro, valor: reais(valor), data: dataBR(vencimento), dias: String(Math.abs(dias)) }) + rodape(p)
}

export function msgRecibo(
  p: Profile, c: Client,
  r: { valor: number; data: string; saldo: number; proximo: string | null; quitado: boolean; parcial: boolean; falta?: number },
): string {
  const modelo = p.templates.recibo || MODELOS_PADRAO.recibo
  const primeiro = c.nome.trim().split(/\s+/)[0]
  const saldo = r.quitado ? 'Empréstimo quitado!' : `Saldo do empréstimo: ${reais(r.saldo)}.`
  const proximo = r.quitado
    ? ''
    : r.parcial
      ? `Ainda faltam ${reais(r.falta ?? 0)} deste mês.`
      : r.proximo ? `Próximo vencimento: ${dataBR(r.proximo)}.` : ''
  return preencher(modelo, { nome: primeiro, valor: reais(r.valor), data: dataBR(r.data), saldo, proximo }) + rodape(p)
}
