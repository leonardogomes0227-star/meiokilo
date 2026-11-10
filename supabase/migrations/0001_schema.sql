-- MeioKilo: tabelas, segurança (RLS), funções e armazenamento de anexos.

-- ============ PERFIL ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text not null default '',
  chave_pix text not null default '',
  assinatura text not null default '',
  multa_pct numeric(6,2) not null default 2 check (multa_pct >= 0),
  mora_pct_dia numeric(6,3) not null default 0.1 check (mora_pct_dia >= 0),
  hora_resumo smallint not null default 8 check (hora_resumo between 0 and 23),
  dias_aviso smallint not null default 1 check (dias_aviso in (0, 1, 3, 7)),
  push_ativo boolean not null default true,
  email_ativo boolean not null default true,
  onboarding_ok boolean not null default false,
  templates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- ============ CLIENTES ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  whatsapp text not null default '',
  cpf text not null default '',
  endereco text not null default '',
  observacao text not null default '',
  anexo_path text,
  created_at timestamptz not null default now()
);
create index clients_user_nome on public.clients (user_id, lower(nome));

-- ============ EMPRÉSTIMOS ============
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  principal numeric(14,2) not null check (principal > 0),
  saldo numeric(14,2) not null check (saldo >= 0),
  taxa_mes numeric(6,2) not null check (taxa_mes >= 0),
  data_inicio date not null,
  tipo text not null check (tipo in ('juros', 'parcelas')),
  n_parcelas integer check (n_parcelas is null or n_parcelas > 0),
  meses_pagos integer not null default 0,
  meses_adiados integer not null default 0,
  valor_parcial_pago numeric(14,2) not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'quitado', 'renegociado')),
  garantia text not null default '',
  garantia_foto_path text,
  observacao text not null default '',
  created_at timestamptz not null default now(),
  constraint parcelas_exigem_n check (tipo <> 'parcelas' or n_parcelas is not null)
);
create index loans_user_status on public.loans (user_id, status);
create index loans_client on public.loans (client_id);

-- ============ PAGAMENTOS ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  data date not null,
  valor numeric(14,2) not null check (valor >= 0),
  tipo text not null check (tipo in ('juros','parcela','parcial','amortizacao','quitacao','adiado','renegociacao')),
  principal_pago numeric(14,2) not null default 0,
  vencimento_ref date,
  atrasado boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payments_loan on public.payments (loan_id, created_at desc);
create index payments_user_data on public.payments (user_id, data desc);

-- ============ PUSH ============
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index push_user on public.push_subscriptions (user_id);

-- registro dos lembretes já enviados (evita enviar duas vezes no mesmo dia)
create table public.lembretes_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  tipo text not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, dia, tipo)
);

-- ============ RLS: cada usuário só vê o que é seu ============
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.lembretes_log enable row level security; -- sem política: só a service key acessa

create policy profiles_dono on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy clients_dono on public.clients for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy loans_dono on public.loans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payments_dono on public.payments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_dono on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- garante que o empréstimo aponte para um cliente do mesmo dono
create or replace function public.checa_dono_cliente() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.user_id = new.user_id) then
    raise exception 'Cliente não encontrado.';
  end if;
  return new;
end $$;
create trigger loans_checa_cliente before insert or update of client_id on public.loans
  for each row execute function public.checa_dono_cliente();

-- ============ OPERAÇÕES ATÔMICAS ============
-- O cálculo é feito no app (src/lib = _shared/calc.ts). O banco só grava tudo junto,
-- na mesma transação, para nunca ficar um pagamento sem o saldo atualizado (ou o contrário).

create or replace function public.aplicar_operacao(p_loan_id uuid, p_estado jsonb, p_pagamento jsonb)
returns public.payments
language plpgsql security invoker as $$
declare
  v_loan public.loans;
  v_pay public.payments;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;

  update public.loans set
    saldo = (p_estado->>'saldo')::numeric,
    meses_pagos = (p_estado->>'meses_pagos')::int,
    meses_adiados = (p_estado->>'meses_adiados')::int,
    valor_parcial_pago = (p_estado->>'valor_parcial_pago')::numeric,
    status = p_estado->>'status'
  where id = p_loan_id;

  insert into public.payments (user_id, loan_id, data, valor, tipo, principal_pago, vencimento_ref, atrasado, snapshot)
  values (
    v_loan.user_id, p_loan_id,
    (p_pagamento->>'data')::date, (p_pagamento->>'valor')::numeric, p_pagamento->>'tipo',
    (p_pagamento->>'principal_pago')::numeric, nullif(p_pagamento->>'vencimento_ref', '')::date,
    coalesce((p_pagamento->>'atrasado')::boolean, false), p_pagamento->'snapshot'
  ) returning * into v_pay;
  return v_pay;
end $$;

-- desfaz SOMENTE o último pagamento do empréstimo, restaurando o estado anterior
create or replace function public.desfazer_pagamento(p_payment_id uuid)
returns void
language plpgsql security invoker as $$
declare
  v_pay public.payments;
  v_ultimo uuid;
begin
  select * into v_pay from public.payments where id = p_payment_id;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  perform 1 from public.loans where id = v_pay.loan_id for update;
  select id into v_ultimo from public.payments where loan_id = v_pay.loan_id
    order by created_at desc, id desc limit 1;
  if v_ultimo <> v_pay.id then
    raise exception 'Só é possível desfazer o último pagamento do empréstimo.';
  end if;
  if v_pay.tipo = 'renegociacao' then
    raise exception 'Uma renegociação não pode ser desfeita.';
  end if;
  update public.loans set
    saldo = (v_pay.snapshot->>'saldo')::numeric,
    meses_pagos = (v_pay.snapshot->>'meses_pagos')::int,
    meses_adiados = (v_pay.snapshot->>'meses_adiados')::int,
    valor_parcial_pago = (v_pay.snapshot->>'valor_parcial_pago')::numeric,
    status = v_pay.snapshot->>'status'
  where id = v_pay.loan_id;
  delete from public.payments where id = v_pay.id;
end $$;

-- encerra um empréstimo e abre outro com as novas condições
create or replace function public.renegociar(p_loan_id uuid, p_novo jsonb, p_data date)
returns uuid
language plpgsql security invoker as $$
declare
  v_old public.loans;
  v_new_id uuid;
begin
  select * into v_old from public.loans where id = p_loan_id for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;
  if v_old.status <> 'ativo' then raise exception 'Este empréstimo não está ativo.'; end if;

  insert into public.loans (user_id, client_id, principal, saldo, taxa_mes, data_inicio, tipo, n_parcelas, garantia, garantia_foto_path, observacao)
  values (
    v_old.user_id, v_old.client_id,
    (p_novo->>'principal')::numeric, (p_novo->>'principal')::numeric,
    (p_novo->>'taxa_mes')::numeric, (p_novo->>'data_inicio')::date, p_novo->>'tipo',
    nullif(p_novo->>'n_parcelas', '')::int,
    coalesce(p_novo->>'garantia', v_old.garantia), v_old.garantia_foto_path,
    coalesce(p_novo->>'observacao', '')
  ) returning id into v_new_id;

  insert into public.payments (user_id, loan_id, data, valor, tipo, principal_pago, vencimento_ref, atrasado, snapshot)
  values (v_old.user_id, v_old.id, p_data, 0, 'renegociacao', 0, null, false,
    jsonb_build_object('saldo', v_old.saldo, 'meses_pagos', v_old.meses_pagos, 'meses_adiados', v_old.meses_adiados,
      'valor_parcial_pago', v_old.valor_parcial_pago, 'status', v_old.status));

  update public.loans set status = 'renegociado',
    observacao = trim(both E'\n' from v_old.observacao || E'\nRenegociado em ' || to_char(p_data, 'DD/MM/YYYY'))
  where id = v_old.id;
  return v_new_id;
end $$;

-- ============ ANEXOS (fotos e documentos) ============
-- Bucket privado: cada usuário só acessa a pasta com o próprio id.
insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false)
  on conflict (id) do nothing;

create policy anexos_ver on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_trocar on storage.objects for update to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);
