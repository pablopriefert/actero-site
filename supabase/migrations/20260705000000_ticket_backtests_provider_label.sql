-- =====================================================================
-- ticket_backtests — label each run with the provider + model it used
--
-- Enables the provider-comparison backtest ("Claude vs GPT-5.4-mini"): the
-- compare mode spawns one run per config and stores which provider/model each
-- row measured, so the two resolution_rate values can be diffed directly.
-- Nullable — legacy single-provider runs simply leave them null.
-- =====================================================================

alter table public.ticket_backtests
  add column if not exists provider text,
  add column if not exists model_id text;
