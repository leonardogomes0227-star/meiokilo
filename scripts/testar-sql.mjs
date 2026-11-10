// Testa a migração 0001 num Postgres em memória (PGlite), simulando o que o Supabase oferece.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
await db.exec(`
  create role authenticated; create role anon;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema public, auth to authenticated;
`)
await db.exec(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'))
await db.exec(`grant all on all tables in schema public to authenticated; grant execute on all functions in schema public to authenticated;`)

const A = (await db.query(`insert into auth.users (email) values ('a@x.com') returning id`)).rows[0].id
const B = (await db.query(`insert into auth.users (email) values ('b@x.com') returning id`)).rows[0].id
const comoUsuario = async (id, fn) => {
  await db.exec(`set app.uid = '${id}'; set role authenticated;`)
  try { return await fn() } finally { await db.exec(`reset role;`) }
}

// perfil criado pelo gatilho
assert.equal((await db.query(`select count(*)::int c from profiles`)).rows[0].c, 2)

const cli = await comoUsuario(A, async () =>
  (await db.query(`insert into clients (nome, whatsapp) values ('Maria', '11999999999') returning id`)).rows[0].id)
const loan = await comoUsuario(A, async () =>
  (await db.query(`insert into loans (client_id, principal, saldo, taxa_mes, data_inicio, tipo) values ($1, 1000, 1000, 10, '2026-01-15', 'juros') returning id`, [cli])).rows[0].id)

// RLS: B não enxerga nada de A
await comoUsuario(B, async () => {
  assert.equal((await db.query(`select count(*)::int c from clients`)).rows[0].c, 0)
  assert.equal((await db.query(`select count(*)::int c from loans`)).rows[0].c, 0)
  await assert.rejects(db.query(`insert into loans (client_id, principal, saldo, taxa_mes, data_inicio, tipo) values ($1, 10, 10, 1, '2026-01-01', 'juros')`, [cli]))
})

const snap = { saldo: 1000, meses_pagos: 0, meses_adiados: 0, valor_parcial_pago: 0, status: 'ativo' }
const op = async (estado, pag) => comoUsuario(A, async () =>
  (await db.query(`select * from aplicar_operacao($1, $2::jsonb, $3::jsonb)`, [loan, JSON.stringify(estado), JSON.stringify(pag)])).rows[0])

const p1 = await op({ ...snap, meses_pagos: 1, saldo: 800 },
  { data: '2026-02-15', valor: 300, tipo: 'juros', principal_pago: 200, vencimento_ref: '2026-02-15', atrasado: false, snapshot: snap })
const snap2 = { ...snap, meses_pagos: 1, saldo: 800 }
const p2 = await op({ ...snap2, meses_pagos: 2 },
  { data: '2026-03-15', valor: 80, tipo: 'juros', principal_pago: 0, vencimento_ref: '2026-03-15', atrasado: false, snapshot: snap2 })

let l = (await db.query(`select saldo::float s, meses_pagos m from loans where id = $1`, [loan])).rows[0]
assert.deepEqual(l, { s: 800, m: 2 })

// só o último pode ser desfeito
await comoUsuario(A, async () => {
  await assert.rejects(db.query(`select desfazer_pagamento($1)`, [p1.id]), /último/)
  await db.query(`select desfazer_pagamento($1)`, [p2.id])
  await db.query(`select desfazer_pagamento($1)`, [p1.id])
})
l = (await db.query(`select saldo::float s, meses_pagos m from loans where id = $1`, [loan])).rows[0]
assert.deepEqual(l, { s: 1000, m: 0 })
assert.equal((await db.query(`select count(*)::int c from payments`)).rows[0].c, 0)

// renegociar
const novo = await comoUsuario(A, async () =>
  (await db.query(`select renegociar($1, $2::jsonb, '2026-04-01') as id`, [loan, JSON.stringify({ principal: 1000, taxa_mes: 8, data_inicio: '2026-04-01', tipo: 'parcelas', n_parcelas: 5 })])).rows[0].id)
assert.equal((await db.query(`select status from loans where id = $1`, [loan])).rows[0].status, 'renegociado')
assert.equal((await db.query(`select tipo from loans where id = $1`, [novo])).rows[0].tipo, 'parcelas')
const reneg = (await db.query(`select id from payments where loan_id = $1`, [loan])).rows[0].id
await comoUsuario(A, async () => { await assert.rejects(db.query(`select desfazer_pagamento($1)`, [reneg]), /renegocia/) })

// não apaga cliente com empréstimo
await comoUsuario(A, async () => { await assert.rejects(db.query(`delete from clients where id = $1`, [cli])) })
console.log('SQL OK: RLS, gatilhos, aplicar_operacao, desfazer_pagamento, renegociar')
