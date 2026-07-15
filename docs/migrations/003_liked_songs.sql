-- ============================================================
-- Migration 003 — liked_songs table  (future Supabase sync)
-- ============================================================
-- Currently src/likes.ts is localStorage-only.
-- Run this migration when you are ready to sync likes to the cloud
-- so users keep their liked songs across devices.
-- ============================================================

-- 1. Create table ────────────────────────────────────────────

create table if not exists public.liked_songs (
  id          bigint          generated always as identity primary key,

  user_id     uuid            not null references auth.users (id) on delete cascade,

  -- Full song data (denormalised so the Library view works without extra joins)
  song_id     text            not null,
  title       text            not null,
  artist      text            not null,
  album       text            not null default '',
  year        integer         not null default 0,
  duration    integer         not null default 0,   -- seconds
  hue         integer         not null default 200,
  hue2        integer         not null default 220,
  src         text            not null default '',  -- stream URL (may expire)
  genre       text            not null default '',
  image_url   text,

  liked_at    timestamptz     not null default now(),

  -- A user can only like the same song once
  unique (user_id, song_id)
);

-- 2. Indexes ─────────────────────────────────────────────────

create index if not exists liked_songs_user_liked_at_idx
  on public.liked_songs (user_id, liked_at desc);

-- 3. Row Level Security ──────────────────────────────────────

alter table public.liked_songs enable row level security;

create policy "liked_songs: select own"
  on public.liked_songs
  for select
  using ( auth.uid() = user_id );

create policy "liked_songs: insert own"
  on public.liked_songs
  for insert
  with check ( auth.uid() = user_id );

create policy "liked_songs: delete own"
  on public.liked_songs
  for delete
  using ( auth.uid() = user_id );
