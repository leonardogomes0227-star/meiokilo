// Gera os PNGs do app a partir de public/icons/icon.svg (usa o Chromium do Playwright).
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icons/icon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
async function gerar(arquivo, lado, margem = 0) {
  await page.setViewportSize({ width: lado, height: lado })
  const m = Math.round(lado * margem)
  await page.setContent(`<body style="margin:0;background:#065f46"><div style="margin:${m}px;width:${lado - 2 * m}px;height:${lado - 2 * m}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await page.screenshot({ path: `public/icons/${arquivo}` })
}
await gerar('icon-192.png', 192)
await gerar('icon-512.png', 512)
await gerar('icon-maskable-512.png', 512, 0.1) // margem de segurança para ícone "maskable"
await gerar('apple-touch-icon.png', 180)
await browser.close()
console.log('Ícones gerados em public/icons')
