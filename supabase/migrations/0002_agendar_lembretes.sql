-- Lembretes automáticos: pg_cron chama a Edge Function "lembretes" de hora em hora.
-- A função decide, para cada usuário, se é a hora do resumo dele (horário de Brasília).
--
-- Esta migração só prepara as extensões e a função auxiliar.
-- Depois de publicar a Edge Function, rode UMA vez no SQL Editor (veja o README):
--   select public.agendar_lembretes('https://SEU-PROJETO.supabase.co', 'SEU_CRON_SECRET');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.agendar_lembretes(p_url text, p_secret text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  -- guarda o segredo no Vault (não fica escrito no comando do cron)
  delete from vault.secrets where name = 'lembretes_secret';
  perform vault.create_secret(p_secret, 'lembretes_secret');
  delete from vault.secrets where name = 'lembretes_url';
  perform vault.create_secret(rtrim(p_url, '/') || '/functions/v1/lembretes', 'lembretes_url');

  perform cron.unschedule(jobid) from cron.job where jobname = 'meiokilo-lembretes';
  perform cron.schedule(
    'meiokilo-lembretes',
    '0 * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_secret')
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
end $$;

revoke all on function public.agendar_lembretes(text, text) from public, anon, authenticated;
