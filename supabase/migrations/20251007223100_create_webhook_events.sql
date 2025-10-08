-- Webhook idempotency table for recording processed events
-- Created: 2025-10-07 22:31:00Z

begin;

create table if not exists public.webhook_events (
  event_id text primary key,
  event_type text,
  community_id uuid,
  processed_at timestamptz not null default now()
);

commit;