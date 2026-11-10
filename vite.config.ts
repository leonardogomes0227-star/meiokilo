import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@calc': fileURLToPath(new URL('./supabase/functions/_shared/calc.ts', import.meta.url)) },
  },
  test: { include: ['supabase/**/*.test.ts', 'src/**/*.test.ts'] },
})
