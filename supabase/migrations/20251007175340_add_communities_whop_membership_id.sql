-- Add whop_membership_id to communities for idempotent Whop syncs
-- Created: 2025-10-07 17:53:40Z

begin;

alter table public.communities
  add column if not exists whop_membership_id text;

-- Ensure a community maps 1:1 to a Whop membership when present
create unique index if not exists communities_whop_membership_id_key
  on public.communities (whop_membership_id)
  where whop_membership_id is not null;

comment on column public.communities.whop_membership_id is 'Whop membership id for idempotent syncs and updates';

commit;