import { useEffect, useState } from 'react'
import { apagarAnexo, enviarAnexo, urlAnexo } from '../lib/ops'
import { useData } from '../lib/store'
import { Button, useUi } from './ui'

/** Escolher foto/documento. Devolve o caminho no Storage. */
export function CampoAnexo({ valor, onChange, pasta, rotulo }: { valor: string | null; onChange: (p: string | null) => void; pasta: string; rotulo: string }) {
  const { session } = useData()
  const { aviso } = useUi()
  const [url, setUrl] = useState<string | null>(null)
  const [subindo, setSubindo] = useState(false)

  useEffect(() => { let vivo = true; if (valor) urlAnexo(valor).then((u) => vivo && setUrl(u)); else setUrl(null); return () => { vivo = false } }, [valor])

  async function escolher(f?: File) {
    if (!f) return
    setSubindo(true)
    try { onChange(await enviarAnexo(session.user.id, pasta, f)) }
    catch (e) { aviso(e instanceof Error ? e.message : 'Não consegui enviar o arquivo.', { erro: true }) }
    finally { setSubindo(false) }
  }
  const imagem = valor && /\.(jpg|jpeg|png|webp|gif)$/i.test(valor)

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold">{rotulo}</span>
      {valor && url && (imagem
        ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={rotulo} className="max-h-40 rounded-xl border" /></a>
        : <a href={url} target="_blank" rel="noreferrer" className="underline">Abrir arquivo anexado</a>)}
      <div className="flex gap-2 flex-wrap">
        <label className="min-h-11 px-4 inline-flex items-center rounded-xl border border-emerald-700/40 font-semibold cursor-pointer active:bg-emerald-50 dark:active:bg-white/10">
          {subindo ? 'Enviando…' : valor ? 'Trocar' : 'Tirar foto / escolher'}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={subindo} onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
        {valor && <Button v="ghost" small onClick={() => { void apagarAnexo(valor); onChange(null) }}>Remover</Button>}
      </div>
    </div>
  )
}
