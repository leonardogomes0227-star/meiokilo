import { useState } from 'react'
import { useData } from '../lib/store'
import { ranking, resumo, serieMensal } from '../lib/stats'
import { reais } from '../lib/format'
import { Card, cx } from '../components/ui'

export default function Painel() {
  const { loans, payments, clients, profile, hoje } = useData()
  const [meses, setMeses] = useState<6 | 12>(6)
  const r = resumo(loans, payments, profile, hoje)
  const serie = serieMensal(payments, hoje, meses)
  const rk = ranking(clients, loans, payments)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Painel</h1>
      <div className="grid grid-cols-2 gap-3">
        <Num r="Dinheiro na rua" v={reais(r.naRua)} destaque />
        <Num r="A receber no mês" v={reais(r.aReceberMes)} />
        <Num r="Recebido no mês" v={reais(r.recebidoMes)} />
        <Num r="Lucro no mês" v={reais(r.lucroMes)} verde />
        <Num r="Lucro total" v={reais(r.lucroTotal)} verde />
        <Num r={`Atrasados (${r.qtdAtrasados})`} v={reais(r.valorAtrasado)} vermelho={r.qtdAtrasados > 0} />
      </div>
      <Card>
        <div className="flex justify-between items-center"><span className="font-bold">Inadimplência</span><b className="text-xl">{r.inadimplencia.toLocaleString('pt-BR')}%</b></div>
        <p className="text-sm opacity-70">Parte do dinheiro na rua que está com pagamento atrasado.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">Recebido e lucro</h2>
          <div className="flex gap-1">
            {([6, 12] as const).map((m) => (
              <button key={m} onClick={() => setMeses(m)} className={cx('min-h-11 px-3 rounded-lg font-semibold', meses === m ? 'bg-emerald-700 text-white' : 'bg-black/5 dark:bg-white/10')}>{m} meses</button>
            ))}
          </div>
        </div>
        <Grafico serie={serie} />
      </Card>

      <Rank titulo="Quem mais rende de juros" itens={rk.rendem.map((x) => ({ id: x.c.id, nome: x.c.nome, v: reais(x.juros) }))} />
      <Rank titulo="Quem mais atrasa" itens={rk.atrasam.map((x) => ({ id: x.c.id, nome: x.c.nome, v: `${x.atrasos}x` }))} vazio="Ninguém atrasou até agora 👏" />
    </div>
  )
}

const Num = ({ r, v, destaque, verde, vermelho }: { r: string; v: string; destaque?: boolean; verde?: boolean; vermelho?: boolean }) => (
  <Card className={cx(destaque && 'col-span-2 bg-emerald-700 !text-white')}>
    <div className={cx('text-sm', destaque ? 'opacity-90' : 'opacity-70')}>{r}</div>
    <div className={cx('font-extrabold', destaque ? 'text-3xl' : 'text-xl', verde && 'text-emerald-700 dark:text-emerald-300', vermelho && 'text-red-600 dark:text-red-400')}>{v}</div>
  </Card>
)

function Rank({ titulo, itens, vazio = 'Ainda sem dados.' }: { titulo: string; itens: { id: string; nome: string; v: string }[]; vazio?: string }) {
  return (
    <Card>
      <h2 className="font-bold mb-2">{titulo}</h2>
      {itens.length === 0 && <p className="opacity-70">{vazio}</p>}
      {itens.map((x, i) => <div key={x.id} className="flex justify-between py-1"><span>{i + 1}. {x.nome}</span><b>{x.v}</b></div>)}
    </Card>
  )
}

function Grafico({ serie }: { serie: ReturnType<typeof serieMensal> }) {
  const max = Math.max(1, ...serie.map((s) => s.recebido))
  const W = 320, H = 150, base = H - 20
  const w = W / serie.length
  const nomeMes = (m: string) => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m.slice(5)) - 1]
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de recebido e lucro por mês">
        {serie.map((s, i) => {
          const hr = (s.recebido / max) * (base - 8), hl = (Math.max(0, s.lucro) / max) * (base - 8)
          const bw = Math.min(14, w / 2 - 2), x = i * w + w / 2
          return (
            <g key={s.mes}>
              <rect x={x - bw - 1} y={base - hr} width={bw} height={hr} rx="2" className="fill-emerald-700 dark:fill-emerald-500"><title>{`${nomeMes(s.mes)}: recebido ${reais(s.recebido)}`}</title></rect>
              <rect x={x + 1} y={base - hl} width={bw} height={hl} rx="2" className="fill-amber-500"><title>{`${nomeMes(s.mes)}: lucro ${reais(s.lucro)}`}</title></rect>
              <text x={x} y={H - 5} textAnchor="middle" fontSize="9" className="fill-current opacity-70">{nomeMes(s.mes)}</text>
            </g>
          )
        })}
        <line x1="0" x2={W} y1={base} y2={base} className="stroke-current opacity-20" />
      </svg>
      <div className="flex gap-4 text-sm"><span><i className="inline-block w-3 h-3 rounded-sm bg-emerald-700 mr-1" />Recebido</span><span><i className="inline-block w-3 h-3 rounded-sm bg-amber-500 mr-1" />Lucro (juros)</span></div>
    </>
  )
}
