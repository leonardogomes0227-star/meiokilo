import { supabase } from './supabase'
import type { Client, Loan, Payment, Profile } from './types'
import type { Resultado } from '@calc'

function falha(e: { message: string } | null): never {
  const m = e?.message || 'Algo deu errado.'
  throw new Error(m.includes('Failed to fetch') ? 'Sem internet. Tente de novo.' : m)
}

export async function aplicar(loanId: string, r: Resultado): Promise<Payment> {
  const { data, error } = await supabase.rpc('aplicar_operacao', {
    p_loan_id: loanId, p_estado: r.novo, p_pagamento: r.pagamento,
  })
  if (error) falha(error)
  return data as Payment
}

export async function desfazerPagamento(paymentId: string) {
  const { error } = await supabase.rpc('desfazer_pagamento', { p_payment_id: paymentId })
  if (error) falha(error)
}

export async function renegociar(loanId: string, novo: Record<string, unknown>, data: string): Promise<string> {
  const { data: id, error } = await supabase.rpc('renegociar', { p_loan_id: loanId, p_novo: novo, p_data: data })
  if (error) falha(error)
  return id as string
}

export async function salvarCliente(c: Partial<Client> & { nome: string }): Promise<Client> {
  const q = c.id ? supabase.from('clients').update(c).eq('id', c.id) : supabase.from('clients').insert(c)
  const { data, error } = await q.select().single()
  if (error) falha(error)
  return data as Client
}

export async function excluirCliente(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) falha(error.message.includes('foreign key') ? { message: 'Este cliente tem empréstimos. Exclua os empréstimos primeiro.' } : error)
}

export async function criarEmprestimo(l: Partial<Loan>): Promise<Loan> {
  const { data, error } = await supabase.from('loans').insert(l).select().single()
  if (error) falha(error)
  return data as Loan
}

export async function editarEmprestimo(id: string, l: Partial<Loan>) {
  const { error } = await supabase.from('loans').update(l).eq('id', id)
  if (error) falha(error)
}

/** Exclui o empréstimo e devolve o que for preciso para restaurar (desfazer). */
export async function excluirEmprestimo(loan: Loan, pagamentos: Payment[]) {
  const { error } = await supabase.from('loans').delete().eq('id', loan.id)
  if (error) falha(error)
  return async () => {
    const a = await supabase.from('loans').insert(loan)
    if (a.error) falha(a.error)
    if (pagamentos.length) {
      const b = await supabase.from('payments').insert(pagamentos)
      if (b.error) falha(b.error)
    }
  }
}

export async function salvarPerfil(id: string, p: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(p).eq('id', id).select().single()
  if (error) falha(error)
  return data as Profile
}

// ---------- anexos (fotos e documentos) ----------

async function reduzirImagem(file: File, maxLado = 1400): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('x'))), 'image/jpeg', 0.8))
  } catch { return file }
}

export async function enviarAnexo(userId: string, pasta: string, file: File): Promise<string> {
  const blob = await reduzirImagem(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/${pasta}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('anexos').upload(path, blob, { contentType: blob.type || undefined })
  if (error) falha(error)
  return path
}

export async function urlAnexo(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('anexos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function apagarAnexo(path: string) {
  await supabase.storage.from('anexos').remove([path])
}
