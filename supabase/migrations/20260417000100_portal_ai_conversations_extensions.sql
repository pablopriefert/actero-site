-- Extensions to ai_conversations for the customer self-service portal
-- - intent: refund/return/general (used by portal actions routing)
-- - customer_follow_up + customer_follow_up_at: customer-initiated replies from portal

alter table ai_conversations
  add column if not exists intent text,
  add column if not exists customer_follow_up text,
  add column if not exists customer_follow_up_at timestamptz;

create or replace function set_customer_follow_up_at() returns trigger as $$
begin
  if new.customer_follow_up is distinct from old.customer_follow_up then
    new.customer_follow_up_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ai_conversations_followup_timestamp on ai_conversations;
create trigger ai_conversations_followup_timestamp
  before update on ai_conversations
  for each row execute function set_customer_follow_up_at();
