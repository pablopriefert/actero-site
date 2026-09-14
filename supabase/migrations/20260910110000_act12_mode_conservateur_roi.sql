-- ACT-12 — mode conservateur pour le temps valorisé par ticket.
--
-- Il n'existe pas de barème par type de demande dans ce dépôt : le seul
-- chiffre qui alimente le ROI affiché est `client_settings.avg_ticket_time_min`
-- (un réglage unique par client, jamais recalibré en pratique — voir commit
-- 38ad5fb). Un marchand qui conteste ce chiffre n'a aujourd'hui aucun moyen de
-- basculer sur une hypothèse plus prudente sans modifier lui-même sa valeur
-- de référence.
--
-- Ce booléen fait plafonner (pas remplacer) `avg_ticket_time_min` au plancher
-- documenté dans le centre d'aide ("entre 3 et 10 minutes généralement") —
-- voir `resolveAvgTicketTimeSec` dans api/engine/lib/config-loader.js.

alter table public.client_settings
  add column if not exists roi_conservative_mode boolean not null default false;

comment on column public.client_settings.roi_conservative_mode is
  'ACT-12 : plafonne le temps valorisé par ticket à la borne basse défendable (3 min) au lieu du réglage/défaut potentiellement optimiste.';
