-- ============================================================
-- Vibify — Supabase Master Migration
-- ============================================================
-- Paste this entire file into the Supabase SQL Editor and run it.
-- It is idempotent ("if not exists" / "if not exists" guards) —
-- safe to run multiple times.
--
-- Order:
--   001  play_history    (core — active today)
--   002  listen_stats    (core — active today)
--   003  liked_songs     (future — run when ready to sync likes)
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  001 — play_history                                       ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.play_history (
  id          bigint          generated always as identity primary key,
  user_id     uuid            not null references auth.users (id) on delete cascade,
  song_id     text            not null,
  title       text            not null,
  artist      text            not null,
  image_url   text,
  hue         integer         not null default 200,
  played_at   timestamptz     not null default now()
);

create index if not exists play_history_user_played_at_idx
  on public.play_history (user_id, played_at desc);

alter table public.play_history enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'play_history'
      and policyname = 'play_history: select own'
  ) then
    create policy "play_history: select own"
      on public.play_history for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'play_history'
      and policyname = 'play_history: insert own'
  ) then
    create policy "play_history: insert own"
      on public.play_history for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'play_history'
      and policyname = 'play_history: delete own'
  ) then
    create policy "play_history: delete own"
      on public.play_history for delete
      using ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  002 — listen_stats                                       ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.listen_stats (
  user_id         uuid            not null primary key
                                  references auth.users (id) on delete cascade,
  total_seconds   bigint          not null default 0,
  updated_at      timestamptz     not null default now()
);

alter table public.listen_stats enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'listen_stats'
      and policyname = 'listen_stats: select own'
  ) then
    create policy "listen_stats: select own"
      on public.listen_stats for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'listen_stats'
      and policyname = 'listen_stats: insert own'
  ) then
    create policy "listen_stats: insert own"
      on public.listen_stats for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'listen_stats'
      and policyname = 'listen_stats: update own'
  ) then
    create policy "listen_stats: update own"
      on public.listen_stats for update
      using  ( auth.uid() = user_id )
      with check ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  003 — liked_songs  (future — uncomment when ready)      ║
-- ╚══════════════════════════════════════════════════════════╝

-- create table if not exists public.liked_songs (
--   id          bigint          generated always as identity primary key,
--   user_id     uuid            not null references auth.users (id) on delete cascade,
--   song_id     text            not null,
--   title       text            not null,
--   artist      text            not null,
--   album       text            not null default '',
--   year        integer         not null default 0,
--   duration    integer         not null default 0,
--   hue         integer         not null default 200,
--   hue2        integer         not null default 220,
--   src         text            not null default '',
--   genre       text            not null default '',
--   image_url   text,
--   liked_at    timestamptz     not null default now(),
--   unique (user_id, song_id)
-- );
--
-- create index if not exists liked_songs_user_liked_at_idx
--   on public.liked_songs (user_id, liked_at desc);
--
-- alter table public.liked_songs enable row level security;
--
-- create policy "liked_songs: select own" on public.liked_songs
--   for select using ( auth.uid() = user_id );
-- create policy "liked_songs: insert own" on public.liked_songs
--   for insert with check ( auth.uid() = user_id );
-- create policy "liked_songs: delete own" on public.liked_songs
--   for delete using ( auth.uid() = user_id );
