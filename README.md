# MeioKilo — controle de empréstimos e cobranças

App para celular (PWA) que controla quem deve, quanto e quando vence, **avisa todo dia de manhã**
(notificação + e-mail) e abre o WhatsApp com a mensagem de cobrança pronta.

React + Vite + TypeScript + Tailwind · Supabase (login, banco, Edge Function, pg_cron) · Vercel.
Tudo no plano grátis.

---

## 1. Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha depois do passo 2
npm run dev
```

Testes dos cálculos (juros, parcelado, atraso/multa/mora, parcial, meses curtos, desfazer):

```bash
npm test
node scripts/testar-sql.mjs   # testa as migrações num Postgres em memória (RLS, desfazer, renegociar)
```

## 2. Criar o projeto no Supabase

1. Entre em <https://supabase.com>, crie uma conta e um **New project** (guarde a senha do banco).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para o `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
   > A chave `service_role` **nunca** vai no app. Ela só é usada dentro do Supabase (Edge Function).
3. **Rodar as migrações.** Duas opções:
   - *Pelo site (mais simples):* em **SQL Editor**, cole e rode, nesta ordem, o conteúdo de
     `supabase/migrations/0001_schema.sql` e depois `0002_agendar_lembretes.sql`.
   - *Pelo terminal:* `npx supabase login`, `npx supabase link --project-ref SEU_REF`, `npx supabase db push`.
4. Em **Authentication → Providers → Email**, deixe e-mail/senha ligado. Para o tio entrar sem confirmar e-mail,
   desligue **Confirm email** (opcional). Em **Authentication → URL Configuration**, coloque o endereço do app (Vercel) em *Site URL*.
5. (Opcional) Dados de exemplo: crie sua conta no app e rode `supabase/seed.sql` no SQL Editor.

## 3. Publicar na Vercel

1. Suba o projeto para o GitHub e, na Vercel, **Add New → Project** e escolha o repositório (Framework: Vite).
2. Em **Environment Variables**, adicione `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_VAPID_PUBLIC_KEY` (passo 4).
3. **Deploy.** O `vercel.json` já cuida das rotas do app.
4. Abra o endereço no celular. Ao entrar, o app guia os 3 primeiros passos (Pix, cliente, empréstimo).

## 4. Ligar os lembretes (push + e-mail)

Os avisos funcionam com o app fechado. O banco chama a função `lembretes` **de hora em hora**;
a função envia só para quem estiver na hora escolhida (padrão 08:00 de Brasília) e, às 18:00, um aviso extra se ainda houver cobrança do dia.

### 4.1 Gerar as chaves VAPID (push)
```bash
npm run vapid
```
Anote a **Public Key** e a **Private Key**. A pública vai na Vercel (`VITE_VAPID_PUBLIC_KEY`) e no `.env.local`; a privada só no Supabase.

### 4.2 E-mail diário (Resend, grátis)
1. Crie conta em <https://resend.com> e gere uma **API Key**.
2. Sem domínio próprio, o Resend só envia a partir de `onboarding@resend.dev` e **somente para o e-mail da sua conta Resend**.
   Para enviar para outro e-mail, verifique um domínio no Resend e use `EMAIL_FROM="MeioKilo <aviso@seudominio.com>"`.

### 4.3 Guardar os segredos e publicar a função
```bash
npx supabase login
npx supabase link --project-ref SEU_REF

npx supabase secrets set \
  VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:seu@email.com" \
  RESEND_API_KEY="re_..." EMAIL_FROM="MeioKilo <onboarding@resend.dev>" \
  CRON_SECRET="invente-uma-senha-longa" APP_URL="https://seu-app.vercel.app"

npx supabase functions deploy lembretes --no-verify-jwt
```

### 4.4 Agendar (uma vez só)
No **SQL Editor** do Supabase (use a mesma senha do `CRON_SECRET`):
```sql
select public.agendar_lembretes('https://SEU_REF.supabase.co', 'invente-uma-senha-longa');
```
Conferir: `select * from cron.job;` e, depois da primeira hora cheia, `select * from cron.job_run_details order by start_time desc limit 5;`.

### 4.5 Ativar no celular
Em **Mais → Configurações → Lembretes**, toque em **Ativar notificações neste aparelho** e depois em **Enviar notificação de teste**.
- **iPhone (iOS 16.4+):** abra no Safari → Compartilhar → **Adicionar à Tela de Início** → abra pelo ícone novo → ative. Sem instalar, o iPhone não recebe push. (A mesma explicação aparece dentro do app.)
- **Android:** funciona direto no Chrome; instalar é opcional.

## 5. Como funcionam as contas

| Regra | Como |
|---|---|
| Vencimento | `data do empréstimo + (meses pagos + meses adiados + 1) meses`; dia 31 vira o último dia de meses curtos |
| Juros do mês | `saldo × taxa ÷ 100` |
| Cobrança | só juros: o juros do mês · parcelado: `principal ÷ parcelas` + juros sobre o saldo |
| Atraso | multa = cobrança × multa% (uma vez) · mora = cobrança × mora% × dias |
| Devido agora | cobrança + multa + mora − parcial já pago |
| Pagamento ≥ devido | fecha o mês; o que sobra abate o principal (parcelado: abate também `principal ÷ n`; na última parcela quita) |
| Pagamento < devido | vira parcial; o vencimento não muda |
| Lucro | `valor − principal pago` |
| Quitar | saldo + juros do mês + multa + mora − parcial |
| Adiar | empurra o vencimento 1 mês, sem contar parcela paga |

O código dessas regras está em **um só arquivo** (`supabase/functions/_shared/calc.ts`), usado pelo app e pela função de lembretes.
Cada pagamento guarda um `snapshot` do estado anterior; **desfazer** (só o último de cada empréstimo) restaura esse estado.

## 6. Estrutura

```
src/                      app (páginas em src/pages, regras de tela em src/lib)
supabase/migrations/      tabelas, RLS, funções (aplicar/desfazer/renegociar), cron
supabase/functions/       lembretes (push + e-mail) e _shared/calc.ts
supabase/seed.sql         dados de exemplo
public/                   manifest, service worker (sw.js), ícones
scripts/                  gerar-icones.mjs, testar-sql.mjs
```

## 7. Segurança
- RLS ligado em todas as tabelas: cada usuário só enxerga `user_id = auth.uid()`. Anexos num bucket privado, por pasta do usuário.
- A chave `service_role` e a chave privada VAPID ficam só nos *secrets* do Supabase.
- Todas as tabelas têm `user_id`, então dá para ter mais de um dono no futuro.
- Faça **Mais → Configurações → Backup → Exportar tudo** de vez em quando e guarde o arquivo.

## 8. O que ainda não existe / limitações
- **Importar o backup do protótipo HTML antigo:** depende do formato do JSON que ele exporta (o arquivo não estava no repositório). Quando tiver o arquivo, é só adaptar `src/lib/backup.ts`.
- Notificações e e-mail e o agendamento (pg_cron) **só foram escritos e checados por tipo**, sem teste contra um Supabase real. Siga o passo 4.5 e faça o teste.
- Recibos e relatórios em PDF usam a impressão do navegador (“Salvar como PDF”), sem biblioteca.
- Excluir cliente só é permitido sem empréstimos, e não tem desfazer. Excluir empréstimo tem desfazer.
