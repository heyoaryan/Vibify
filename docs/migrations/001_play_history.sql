-- ============================================================
-- Migration 001 — play_history table
-- ============================================================
-- Stores every song a signed-in user plays.
-- One row per play event (same song can appear multiple times).
-- Referenced in: src/history.ts → syncPlayToSupabase / loadHistoryFromSupabase
-- ============================================================

-- 1. Create table ────────────────────────────────────────────

create table if not exists public.play_history (
  id          bigint          generated always as identity primary key,

  -- FK to Supabase Auth users
  user_id     uuid            not null references auth.users (id) on delete cascade,

  -- JioSaavn / static song identifier
  song_id     text            not null,

  -- Denormalised display fields so the history view never needs a join
  title       text            not null,
  artist      text            not null,
  image_url   text,                      -- nullable — static songs have no art
  hue         integer         not null default 200,

  played_at   timestamptz     not null default now()
);

-- 2. Indexes ─────────────────────────────────────────────────

-- Most queries: "give me this user's recent plays, newest first"
create index if not exists play_history_user_played_at_idx
  on public.play_history (user_id, played_at desc);

-- 3. Row Level Security ──────────────────────────────────────

alter table public.play_history enable row level security;

-- Users can only read their own history
create policy "play_history: select own"
  on public.play_history
  for select
  using ( auth.uid() = user_id );

-- Users can only insert rows for themselves
create policy "play_history: insert own"
  on public.play_history
  for insert
  with check ( auth.uid() = user_id );

-- Users can delete their own history (nice-to-have for a "clear history" feature)
create policy "play_history: delete own"
  on public.play_history
  for delete
  using ( auth.uid() = user_id );
