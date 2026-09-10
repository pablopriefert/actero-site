-- ACT-33 — un mois d'essai pour les marchands venus de la publicité.
--
-- Décision du 10 septembre : la campagne annonce « 1 mois gratuit », mais on
-- ne l'ouvre pas à tout le monde. Le marchand qui trouve Actero autrement
-- garde l'essai standard de 7 jours.
--
-- Même forme que `referral_first_month_free`, et pour la même raison : un
-- drapeau à consommation unique, posé côté serveur, remis à false dès qu'il a
-- servi. C'est ce qui empêche de réclamer un second mois en résiliant puis en
-- se réabonnant.
alter table public.clients
  add column if not exists campaign_first_month_free boolean not null default false;

comment on column public.clients.campaign_first_month_free is
  'ACT-33 — ce marchand vient d''une campagne publicitaire et a droit à 30 jours d''essai. Posé UNIQUEMENT côté serveur après validation du code contre CAMPAIGN_TRIAL_CODES, jamais depuis le navigateur. Consommé (remis à false) à la création de l''abonnement.';
