-- ============================================================
-- Migration 002 — listen_stats table
-- ============================================================
-- Stores cumulative listening time per user.
-- One row per user, upserted on conflict (user_id is the unique key).
-- Referenced in: src/history.ts → syncListenSecondsToSupabase
-- ============================================================

-- 1. Create table ────────────────────────────────────────────

create table if not exists public.listen_stats (
  -- One row per user — user_id is the natural primary key
  user_id         uuid            not null primary key
                                  references auth.users (id) on delete cascade,

  total_seconds   bigint          not null default 0,
  updated_at      timestamptz     not null default now()
);

-- 2. Row Level Security ──────────────────────────────────────

alter table public.listen_stats enable row level security;

-- Users can read their own stats
create policy "listen_stats: select own"
  on public.listen_stats
  for select
  using ( auth.uid() = user_id );

-- Users can insert a fresh stats row for themselves
create policy "listen_stats: insert own"
  on public.listen_stats
  for insert
  with check ( auth.uid() = user_id );

-- Users can update their own stats (upsert uses UPDATE under the hood)
create policy "listen_stats: update own"
  on public.listen_stats
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );
