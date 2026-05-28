-- =====================================================================
-- Widget customization columns on client_settings
--
-- Lets merchants pick their own brand color, accent, greeting, position
-- and (on Pro+) hide the "Powered by Actero" footer. Read at runtime by
-- public/widget.js via the new GET /api/engine/widget-config endpoint.
--
-- Strictly additive: every column ships with a default that matches the
-- current hard-coded values in widget.js, so existing widgets keep their
-- exact behaviour until the merchant opens the new Settings → Widget
-- view and changes something.
-- =====================================================================

alter table public.client_settings
  add column if not exists widget_brand_color text not null default '#0F5F35',
  add column if not exists widget_accent_color text not null default '#14A85C',
  add column if not exists widget_position text not null default 'bottom-right',
  add column if not exists widget_greeting text not null default 'Bonjour ! Comment puis-je vous aider ?',
  add column if not exists widget_logo_url text,
  add column if not exists widget_show_powered_by boolean not null default true;

alter table public.client_settings drop constraint if exists client_settings_widget_position_check;
alter table public.client_settings
  add constraint client_settings_widget_position_check
  check (widget_position in ('bottom-right', 'bottom-left'));

comment on column public.client_settings.widget_brand_color is
  'Primary color used by the chat widget — bubble background, send button, user message background. Hex string. Default matches the legacy hard-coded Actero green.';

comment on column public.client_settings.widget_accent_color is
  'Accent color used by the chat widget for hover states and product card highlights. Hex string.';

comment on column public.client_settings.widget_position is
  'Which corner the floating chat bubble sits in. Only bottom-right and bottom-left are supported.';

comment on column public.client_settings.widget_greeting is
  'Message the agent uses to open the conversation. Plain text, ~200 chars.';

comment on column public.client_settings.widget_logo_url is
  'Optional URL of the merchant''s logo, displayed inside the widget header. NULL falls back to the first letter of brand_name.';

comment on column public.client_settings.widget_show_powered_by is
  'Whether the "Powered by Actero" footer is rendered. Toggle exposed on Pro+ plans only — the dashboard UI forces this to true for Free / Starter.';
