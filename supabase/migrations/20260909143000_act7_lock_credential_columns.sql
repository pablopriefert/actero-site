-- ACT-7 — fermer les colonnes de secrets à tout ce qui n'est pas le serveur.
--
-- Contexte. `client_integrations` porte trois colonnes de secrets :
-- `api_key` (mot de passe SMTP, clés Resend/AfterShip/Gorgias…),
-- `access_token` et `refresh_token` (OAuth). Les policies RLS isolent
-- correctement les tenants — un marchand ne voit que ses propres lignes — mais
-- rien n'empêchait le navigateur de LIRE ces trois colonnes sur ses lignes à
-- lui. Une session volée, une extension malveillante ou une XSS suffisait donc
-- à récupérer le mot de passe email du marchand.
--
-- Vérification faite avant d'écrire cette migration : aucune requête du front
-- ne sélectionne ces colonnes (relevé exhaustif des `.select()` sur
-- `client_integrations` dans src/). Les seuls consommateurs légitimes sont les
-- routes serveur, qui utilisent la service_role et ne sont pas concernées par
-- les GRANT ci-dessous.
--
-- Postgres n'applique pas un `revoke select (colonne)` par-dessus un droit
-- accordé au niveau de la table : il faut retirer le droit global puis le
-- ré-accorder colonne par colonne. D'où la forme en deux temps.

revoke select, insert, update on public.client_integrations from authenticated;
revoke select, insert, update on public.client_integrations from anon;

grant select (
  id, client_id, provider, provider_label, auth_type,
  extra_config, scopes, status, status_message,
  connected_at, expires_at, last_checked_at, last_used_at,
  created_at, updated_at
) on public.client_integrations to authenticated;

-- Le front n'écrit plus que `status` (bouton « déconnecter »). Les identifiants
-- passent désormais tous par /api/integrations/connect, qui chiffre en
-- AES-256-GCM avant insertion.
grant update (status, status_message, updated_at)
  on public.client_integrations to authenticated;

grant delete on public.client_integrations to authenticated;
