-- Dados de exemplo (OPCIONAL) para testar. Rode no SQL Editor depois de criar sua conta no app.
-- Usa o primeiro usuário cadastrado. Para apagar depois: delete from public.clients; (cascata nos empréstimos exige apagar loans antes)
do $$
declare
  u uuid := (select id from auth.users order by created_at limit 1);
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if u is null then raise exception 'Crie sua conta no app primeiro.'; end if;

  insert into public.clients (id, user_id, nome, whatsapp) values
    (c1, u, 'Maria (exemplo)', '11987654321'),
    (c2, u, 'João (exemplo)', '21999998888'),
    (c3, u, 'Ana (exemplo)', '31988887777');

  -- vence daqui a 5 dias (início = vencimento − 1 mês)
  insert into public.loans (user_id, client_id, principal, saldo, taxa_mes, data_inicio, tipo, garantia)
    values (u, c1, 2000, 2000, 10, (hoje + 5 - interval '1 month')::date, 'juros', 'Moto');
  -- venceu há 4 dias (atrasado)
  insert into public.loans (user_id, client_id, principal, saldo, taxa_mes, data_inicio, tipo)
    values (u, c2, 1500, 1500, 8, (hoje - 4 - interval '1 month')::date, 'juros');
  -- vence hoje, parcelado em 6x
  insert into public.loans (user_id, client_id, principal, saldo, taxa_mes, data_inicio, tipo, n_parcelas)
    values (u, c3, 1200, 1200, 5, (hoje - interval '1 month')::date, 'parcelas', 6);
end $$;
