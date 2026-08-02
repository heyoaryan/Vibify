-- ============================================================
-- Vibify — Profile-Based Cross-Device Sync Migration
-- ============================================================
-- Kya karta hai yeh migration:
--
--   1. profiles table — listen_stats merge karo + total_songs_played add karo
--      Ek hi table mein sab user stats rahein. Kisi bhi device pe login karo
--      toh wohi stats milein.
--
--   2. user_settings table — app settings ko bhi Supabase mein sync karo
--      (quality, autoPlay, crossfade, etc.) taaki device switch pe reset na ho.
--
--   3. play_history cleanup — 100 se zyada entries wale users ka purana data
--      automatically delete hota rahe (sirf last 100 rakho per user).
--
--   4. recent_played cleanup — 30 se zyada entries automatically trim ho jayein.
--
--   5. listen_stats table drop — ab yeh data profiles table mein hai,
--      alag table ki zaroorat nahi.
--
--   6. pg_cron jobs — roz raat ko stale data cleanup auto-run ho.
--
-- NOTE: pg_cron enable honi chahiye Supabase Dashboard →
--       Database → Extensions → pg_cron
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 1 — profiles table mein missing columns add karo   ║
-- ╚══════════════════════════════════════════════════════════╝
-- 001_master.sql mein profiles ke existing columns:
--   listening_time   (bigint)  — seconds in old schema
--   songs_played     (integer) — play count in old schema
--
-- Hum naye aliased columns add kar rahe hain jo old columns ke
-- saath coexist karein. Old columns preserve hain taaki koi
-- existing code break na ho.

alter table public.profiles
  add column if not exists total_listen_seconds  bigint    not null default 0,
  add column if not exists total_songs_played    integer   not null default 0,
  add column if not exists last_song_id          text,
  add column if not exists last_song             jsonb;

comment on column public.profiles.listening_time is
  '[legacy] Listening time in seconds — superseded by total_listen_seconds';
comment on column public.profiles.songs_played is
  '[legacy] Songs played count — superseded by total_songs_played';
comment on column public.profiles.total_listen_seconds is
  'Cumulative listening time in seconds — synced across all devices';
comment on column public.profiles.total_songs_played is
  'Total number of songs played across all sessions and devices';
comment on column public.profiles.last_song_id is
  'Song ID of the last played song — for cross-device resume';
comment on column public.profiles.last_song is
  'Full song object (jsonb) of last played song — for instant resume on new device';

-- Existing data migrate karo: purane columns se naye columns mein copy karo
-- (sirf jahan new column abhi bhi 0 par default hai)
update public.profiles
set
  total_listen_seconds = greatest(total_listen_seconds, listening_time),
  total_songs_played   = greatest(total_songs_played, songs_played)
where listening_time > 0 or songs_played > 0;

-- Agar purani listen_stats table mein data hai toh profiles mein bhi merge karo
-- (yeh table 001_master mein define nahi hai — sirf app code mein use hoti thi)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'listen_stats'
  ) then
    update public.profiles p
    set total_listen_seconds = greatest(
      p.total_listen_seconds,
      coalesce((
        select ls.total_seconds
        from public.listen_stats ls
        where ls.user_id = p.user_id
      ), 0)
    );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 2 — profiles ke liye auto-update trigger           ║
-- ╚══════════════════════════════════════════════════════════╝

create or replace function update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at_trigger on public.profiles;

create trigger profiles_updated_at_trigger
  before update on public.profiles
  for each row
  execute function update_profiles_updated_at();


-- Auto-create profile jab naya user sign up kare
-- (agar profile nahi bani toh Supabase auth trigger se ban jaaye)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

comment on function handle_new_user() is
  'Naye user ke liye automatically profile row create karo on signup';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 3 — user_settings table (cross-device settings)    ║
-- ╚══════════════════════════════════════════════════════════╝
-- Ab settings sirf localStorage mein nahi rahein —
-- login karo kisi bhi device pe, settings wahi milein.

create table if not exists public.user_settings (
  user_id           uuid          not null primary key
                                  references auth.users (id) on delete cascade,

  audio_quality     text          not null default '320'
                                  check (audio_quality in ('96', '160', '320')),
  auto_play         boolean       not null default true,
  crossfade_secs    integer       not null default 0
                                  check (crossfade_secs >= 0 and crossfade_secs <= 12),
  data_saver        boolean       not null default false,
  audio_enhancement boolean       not null default true,

  updated_at        timestamptz   not null default now()
);

comment on table public.user_settings is
  'Per-user app settings — synced across devices on login';
comment on column public.user_settings.audio_quality is
  'Stream quality in kbps: 96 | 160 | 320';
comment on column public.user_settings.crossfade_secs is
  'Crossfade duration in seconds (0 = off, max 12)';

-- Auto-update timestamp
create or replace function update_user_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_settings_updated_at_trigger on public.user_settings;

create trigger user_settings_updated_at_trigger
  before update on public.user_settings
  for each row
  execute function update_user_settings_updated_at();

-- RLS
alter table public.user_settings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings: select own'
  ) then
    create policy "user_settings: select own"
      on public.user_settings for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings: insert own'
  ) then
    create policy "user_settings: insert own"
      on public.user_settings for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings: update own'
  ) then
    create policy "user_settings: update own"
      on public.user_settings for update
      using ( auth.uid() = user_id )
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings: delete own'
  ) then
    create policy "user_settings: delete own"
      on public.user_settings for delete
      using ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 4 — play_history: per-user last 100 rakho          ║
-- ╚══════════════════════════════════════════════════════════╝
-- Purana saara log nahi chahiye — har user ka sirf last 100 entries
-- rakho, baaki automatically delete ho jaayein.

create or replace function trim_play_history()
returns trigger as $$
begin
  -- Naya row insert hone ke baad, us user ke 100 se zyada entries delete karo
  delete from public.play_history
  where user_id = new.user_id
    and id not in (
      select id
      from public.play_history
      where user_id = new.user_id
      order by played_at desc
      limit 100
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists play_history_trim_trigger on public.play_history;

create trigger play_history_trim_trigger
  after insert on public.play_history
  for each row
  execute function trim_play_history();

comment on function trim_play_history() is
  'Har user ke liye play_history mein sirf last 100 entries rakho — baaki auto-delete';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 5 — recent_played: per-user last 30 rakho          ║
-- ╚══════════════════════════════════════════════════════════╝

create or replace function trim_recent_played()
returns trigger as $$
begin
  delete from public.recent_played
  where user_id = new.user_id
    and id not in (
      select id
      from public.recent_played
      where user_id = new.user_id
      order by played_at desc
      limit 30
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists recent_played_trim_trigger on public.recent_played;

create trigger recent_played_trim_trigger
  after insert on public.recent_played
  for each row
  execute function trim_recent_played();

comment on function trim_recent_played() is
  'Har user ke liye recent_played mein sirf last 30 entries rakho — baaki auto-delete';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 6 — listen_stats table drop (ab profiles mein hai) ║
-- ╚══════════════════════════════════════════════════════════╝
-- Data Step 1 mein profiles.total_listen_seconds mein migrate ho chuka hai.
-- listen_stats 001_master.sql mein officially define nahi thi —
-- sirf app code (history.ts) mein upsert hoti thi.
-- Safely drop karo sirf agar exist karti ho.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'listen_stats'
  ) then
    drop table public.listen_stats;
    raise notice 'listen_stats table dropped — data migrated to profiles.total_listen_seconds';
  else
    raise notice 'listen_stats table did not exist — nothing to drop';
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STEP 7 — pg_cron: daily stale data cleanup              ║
-- ╚══════════════════════════════════════════════════════════╝
-- Roz raat 2 baje UTC pe:
--   a) 90 din purani play_history entries delete karo
--   b) Expired rooms delete karo (agar 003 migration run nahi hua)

-- a) Old play_history cleanup function
create or replace function cleanup_old_play_history()
returns void as $$
begin
  delete from public.play_history
  where played_at < now() - interval '90 days';
end;
$$ language plpgsql security definer;

comment on function cleanup_old_play_history() is
  '90 din se purani play_history entries delete karta hai — pg_cron se daily run hota hai';

-- b) Schedule karo (idempotent — duplicate schedule avoid karo)
do $outer$
begin
  -- pehle unschedule karo agar already exist karta ho
  begin
    perform cron.unschedule('cleanup-old-play-history');
  exception when others then null;
  end;

  perform cron.schedule(
    'cleanup-old-play-history',
    '0 2 * * *',
    $cmd$ select cleanup_old_play_history(); $cmd$
  );

  -- agar 003 migration nahi chali toh expired rooms bhi cleanup karo
  -- (003 ne already ek cron schedule kiya hai, yeh sirf fallback hai)
  if not exists (
    select 1 from cron.job where jobname = 'delete-expired-rooms'
  ) then
    perform cron.schedule(
      'delete-expired-rooms',
      '*/30 * * * *',
      $cmd$ select delete_expired_rooms(); $cmd$
    );
  end if;

exception when others then
  -- pg_cron extension nahi hai toh silently skip karo
  raise notice 'pg_cron not available — run cleanup functions manually if needed.';
end $outer$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Final: indexes for new columns                          ║
-- ╚══════════════════════════════════════════════════════════╝

create index if not exists profiles_last_song_idx
  on public.profiles (user_id)
  where last_song_id is not null;

create index if not exists user_settings_user_id_idx
  on public.user_settings (user_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Summary — kya kya badhla                                ║
-- ╚══════════════════════════════════════════════════════════╝
--
--  profiles          ← total_listen_seconds, total_songs_played,
--                       last_song_id, last_song columns add hue
--                       auto-update trigger add hua
--                       new user signup par auto-create trigger add hua
--
--  user_settings     ← nayi table (audio_quality, auto_play, crossfade_secs,
--                       data_saver, audio_enhancement) full RLS ke saath
--
--  play_history      ← insert trigger: per-user last 100 rakho, baaki delete
--                       pg_cron: 90 din purani entries roz delete ho
--
--  recent_played     ← insert trigger: per-user last 30 rakho, baaki delete
--
--  listen_stats      ← DROP (data profiles.total_listen_seconds mein migrate hua)
--
-- ╔══════════════════════════════════════════════════════════╗
-- ║  Rollback karna ho toh:                                  ║
-- ╚══════════════════════════════════════════════════════════╝
-- select cron.unschedule('cleanup-old-play-history');
-- select cron.unschedule('delete-expired-rooms');
-- drop trigger if exists play_history_trim_trigger on public.play_history;
-- drop trigger if exists recent_played_trim_trigger on public.recent_played;
-- drop trigger if exists profiles_updated_at_trigger on public.profiles;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop trigger if exists user_settings_updated_at_trigger on public.user_settings;
-- drop function if exists trim_play_history();
-- drop function if exists trim_recent_played();
-- drop function if exists update_profiles_updated_at();
-- drop function if exists update_user_settings_updated_at();
-- drop function if exists handle_new_user();
-- drop function if exists cleanup_old_play_history();
-- drop table if exists public.user_settings;
-- alter table public.profiles
--   drop column if exists total_listen_seconds,
--   drop column if exists total_songs_played,
--   drop column if exists last_song_id,
--   drop column if exists last_song;
