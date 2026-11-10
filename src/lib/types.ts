import type { LoanCalc, TipoPagamento } from '@calc'

export interface Templates {
  antes?: string
  hoje?: string
  atrasado?: string
  recibo?: string
  incluir_pix?: boolean
  incluir_assinatura?: boolean
}

export interface Profile {
  id: string
  email: string | null
  nome: string
  chave_pix: string
  assinatura: string
  multa_pct: number
  mora_pct_dia: number
  hora_resumo: number
  dias_aviso: number
  push_ativo: boolean
  email_ativo: boolean
  onboarding_ok: boolean
  templates: Templates
}

export interface Client {
  id: string
  user_id: string
  nome: string
  whatsapp: string
  cpf: string
  endereco: string
  observacao: string
  anexo_path: string | null
  created_at: string
}

export interface Loan extends LoanCalc {
  id: string
  user_id: string
  client_id: string
  garantia: string
  garantia_foto_path: string | null
  observacao: string
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  loan_id: string
  data: string
  valor: number
  tipo: TipoPagamento
  principal_pago: number
  vencimento_ref: string | null
  atrasado: boolean
  snapshot: Record<string, unknown>
  created_at: string
}

export const TIPO_LABEL: Record<TipoPagamento, string> = {
  juros: 'Juros', parcela: 'Parcela', parcial: 'Parcial', amortizacao: 'Amortização',
  quitacao: 'Quitação', adiado: 'Adiado', renegociacao: 'Renegociação',
}
