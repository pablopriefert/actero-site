-- Remove the prospect-audit + cold-email system entirely.
-- Applied 2026-05-17
--
-- Decision: cold outreach is fully delegated to Instantly + FullEnrich;
-- the in-house audit/email/CSV pipeline is redundant. Only ~2 test rows
-- existed and no real opt-outs (no cold email was ever sent — the sending
-- domain getactero.com was still in warmup). Supersedes:
--   20260513000000_prospect_audits.sql
--   20260514150000_prospect_audit_batch_pipeline.sql
-- (and the prospect_audits policy/trigger from the harden migration —
--  removed here via CASCADE).

drop table if exists public.email_suppressions cascade;
drop table if exists public.prospect_audits cascade;
drop function if exists public.set_prospect_audit_updated_at() cascade;
