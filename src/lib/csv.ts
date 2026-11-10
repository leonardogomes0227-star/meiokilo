/** Baixa um CSV que abre certo no Excel brasileiro (separador ; e BOM UTF-8). */
export function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const cel = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const txt = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n')
  baixarArquivo(nome, txt, 'text/csv;charset=utf-8')
}

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
