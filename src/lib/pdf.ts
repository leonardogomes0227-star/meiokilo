/** "PDF" sem biblioteca: abre a janela de impressão do celular/computador (escolher "Salvar como PDF"). */
export function imprimirHtml(titulo: string, corpo: string) {
  const w = window.open('', '_blank')
  if (!w) { alert('Libere os pop-ups para gerar o PDF.'); return }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:24px;font-size:14px}
 h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:18px 0 6px}
 .mut{color:#555} table{width:100%;border-collapse:collapse;margin-top:8px}
 th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left} td.n,th.n{text-align:right}
 .box{border:1px solid #ccc;border-radius:8px;padding:12px;margin-top:10px}
 .big{font-size:22px;font-weight:700}
 @media print{button{display:none}}
</style></head><body>${corpo}
<p class="mut" style="margin-top:24px">Gerado em ${new Date().toLocaleString('pt-BR')} · MeioKilo</p>
<button onclick="window.print()" style="margin-top:12px;padding:12px 18px;font-size:16px">Imprimir / Salvar PDF</button>
<script>setTimeout(function(){window.print()},400)</script></body></html>`)
  w.document.close()
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
