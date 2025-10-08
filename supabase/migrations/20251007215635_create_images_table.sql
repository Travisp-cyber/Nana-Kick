-- Create images table for generated outputs
-- Created: 2025-10-07 21:56:35Z

begin;

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  url text not null,
  prompt text,
  created_at timestamptz not null default now()
);

-- Index for faster lookups by community
create index if not exists idx_images_community_id on public.images (community_id);

commit;