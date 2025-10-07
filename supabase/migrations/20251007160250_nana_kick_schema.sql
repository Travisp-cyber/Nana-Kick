-- Nana Kick schema migration
-- Created: 2025-10-07 16:02:50Z

begin;

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Transaction type enum
create type transaction_type as enum ('generation', 'extra_credit');

-- Communities table
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null,
  pool_limit integer not null default 0 check (pool_limit >= 0),
  current_usage integer not null default 0 check (current_usage >= 0),
  member_count integer not null default 0 check (member_count >= 0),
  renewal_date date not null
);

-- Members table
create table public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  community_id uuid not null references public.communities(id) on delete cascade
);

-- Transactions table
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  type transaction_type not null,
  amount integer not null check (amount >= 0),
  date timestamptz not null default now()
);

-- Indexes
create index idx_communities_plan on public.communities (plan);
create index idx_communities_renewal_date on public.communities (renewal_date);

create index idx_members_community_id on public.members (community_id);
create unique index idx_members_community_email_unique on public.members (community_id, lower(email));

create index idx_transactions_community_id on public.transactions (community_id);
create index idx_transactions_date on public.transactions (date);
create index idx_transactions_community_date on public.transactions (community_id, date);

-- Sample data
-- Insert two communities and capture their IDs for related inserts
with inserted as (
  insert into public.communities (name, plan, pool_limit, current_usage, member_count, renewal_date)
  values
    ('Nana Kick Club Alpha', 'pro', 1000, 150, 5, '2025-11-01'),
    ('Nana Kick Studio Beta', 'free', 100, 80, 2, '2025-10-25')
  returning id, name
)
insert into public.members (id, email, community_id)
select gen_random_uuid(), e.email, i.id
from inserted i
join (
  values
    ('Nana Kick Club Alpha', 'alpha-owner@example.com'),
    ('Nana Kick Club Alpha', 'alpha-mod@example.com'),
    ('Nana Kick Club Alpha', 'alpha-user1@example.com'),
    ('Nana Kick Studio Beta', 'beta-owner@example.com'),
    ('Nana Kick Studio Beta', 'beta-user1@example.com')
) as e(name, email)
  on e.name = i.name;

-- Transactions for the two communities
with c as (
  select id, name from public.communities where name in ('Nana Kick Club Alpha', 'Nana Kick Studio Beta')
),
rows as (
  select * from (values
    ('Nana Kick Club Alpha', 'generation'::transaction_type, 10, '2025-10-01T10:00:00Z'::timestamptz),
    ('Nana Kick Club Alpha', 'generation'::transaction_type, 25, '2025-10-02T12:30:00Z'::timestamptz),
    ('Nana Kick Club Alpha', 'extra_credit'::transaction_type, 100, '2025-10-03T18:00:00Z'::timestamptz),
    ('Nana Kick Studio Beta', 'generation'::transaction_type, 5, '2025-10-01T09:45:00Z'::timestamptz),
    ('Nana Kick Studio Beta', 'extra_credit'::transaction_type, 25, '2025-10-02T15:00:00Z'::timestamptz)
  ) as t(name, type, amount, date)
)
insert into public.transactions (id, community_id, type, amount, date)
select gen_random_uuid(), c.id, r.type, r.amount, r.date
from rows r
join c on c.name = r.name;

commit;
