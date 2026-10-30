-- ==========================================================================
-- InstaChat — agendamentos (pg_cron + pg_net)
--
-- RODAR SÓ DEPOIS DO DEPLOY na Vercel, porque precisa do endereço público
-- do app e do CRON_SECRET.
--
-- Antes de rodar, troque:
--   __APP_URL__      -> https://SEU-APP.vercel.app   (sem barra no final)
--   __CRON_SECRET__  -> o mesmo valor que você pôs na env CRON_SECRET
--
-- A Vercel Hobby não deixa cron de 1 em 1 minuto; por isso o relógio é o
-- pg_cron do Supabase, que usa pg_net para bater nos nossos endpoints.
-- ==========================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpa agendamentos antigos com o mesmo nome (pra poder rodar de novo).
select cron.unschedule('instachat-drain')  where exists (select 1 from cron.job where jobname = 'instachat-drain');
select cron.unschedule('instachat-refresh') where exists (select 1 from cron.job where jobname = 'instachat-refresh');

-- Drenar a fila a cada minuto.
select cron.schedule(
  'instachat-drain',
  '* * * * *',
  $$
    select net.http_post(
      url     := '__APP_URL__/api/cron/drain',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __CRON_SECRET__'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Conferir os agendamentos: select * from cron.job;
