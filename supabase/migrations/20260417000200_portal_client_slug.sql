-- Add a url-safe slug per client for portal subdomain routing
alter table clients
  add column if not exists slug text unique;

update clients
set slug = regexp_replace(
  regexp_replace(lower(brand_name), '[^a-z0-9]+', '-', 'g'),
  '(^-+|-+$)', '', 'g'
)
where slug is null and brand_name is not null;

update clients
set slug = 'client-' || substring(id::text, 1, 8)
where slug is null;
