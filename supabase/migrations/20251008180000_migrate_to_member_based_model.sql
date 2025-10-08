-- Migrate from community-based to member-based model
-- Created: 2025-10-08 18:00:00Z

begin;

-- Step 1: Add new columns to members table
alter table public.members
  add column if not exists plan text not null default 'starter',
  add column if not exists pool_limit integer not null default 0 check (pool_limit >= 0),
  add column if not exists current_usage integer not null default 0 check (current_usage >= 0),
  add column if not exists renewal_date date,
  add column if not exists created_at timestamptz not null default now();

-- Step 2: Migrate data from communities to members
-- For each member, copy their community's plan, pool_limit, current_usage, and renewal_date
update public.members m
set 
  plan = c.plan,
  pool_limit = c.pool_limit,
  current_usage = c.current_usage,
  renewal_date = c.renewal_date
from public.communities c
where m.community_id = c.id;

-- Step 3: Add member_id column to transactions table
alter table public.transactions
  add column if not exists member_id uuid;

-- Populate member_id in transactions from community_id
update public.transactions t
set member_id = m.id
from public.members m
where t.community_id = m.community_id
  and t.member_id is null;

-- Step 4: Add member_id column to images table
alter table public.images
  add column if not exists member_id uuid;

-- Populate member_id in images from community_id
update public.images i
set member_id = m.id
from public.members m
where i.community_id = m.community_id
  and i.member_id is null;

-- Step 5: Update webhook_events to use member_id
alter table public.webhook_events
  add column if not exists member_id uuid;

-- Attempt to map existing webhook events to members (if any)
update public.webhook_events we
set member_id = m.id
from public.members m
where we.community_id = m.community_id
  and we.member_id is null;

-- Step 6: Drop old foreign key constraints and columns
alter table public.transactions
  drop constraint if exists transactions_community_id_fkey;

alter table public.images
  drop constraint if exists images_community_id_fkey;

-- Step 7: Make member_id NOT NULL and add foreign key constraints
alter table public.transactions
  alter column member_id set not null,
  add constraint transactions_member_id_fkey foreign key (member_id) references public.members(id) on delete cascade;

alter table public.images
  alter column member_id set not null,
  add constraint images_member_id_fkey foreign key (member_id) references public.members(id) on delete cascade;

-- Step 8: Drop old community_id columns
alter table public.members
  drop column if exists community_id;

alter table public.transactions
  drop column if exists community_id;

alter table public.images
  drop column if exists community_id;

alter table public.webhook_events
  drop column if exists community_id;

-- Step 9: Create indexes on new member_id columns
create index if not exists idx_transactions_member_id on public.transactions (member_id);
create index if not exists idx_transactions_member_date on public.transactions (member_id, date);
create index if not exists idx_images_member_id on public.images (member_id);

-- Step 10: Drop old indexes related to communities
drop index if exists idx_members_community_id;
drop index if exists idx_members_community_email_unique;
drop index if exists idx_transactions_community_id;
drop index if exists idx_transactions_community_date;
drop index if exists idx_images_community_id;

-- Step 11: Add unique constraint on member email
create unique index if not exists idx_members_email_unique on public.members (lower(email));

-- Step 12: Add index on member renewal_date for batch operations
create index if not exists idx_members_renewal_date on public.members (renewal_date);

-- Step 13: Drop the communities table entirely
drop table if exists public.communities cascade;

commit;
