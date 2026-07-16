-- ============================================================
-- Vibify — Data Preservation Migration
-- ============================================================
-- Ye migration:
-- 1. Purane data ko preserve karta hai
-- 2. User accounts ko delete nahi karta
-- 3. Playing time aur recent played data ko rakhta hai
-- 4. Saare tables create karta hai agar exist nahi karte
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  001 — profiles (user stats + streaks)                    ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.profiles (
  user_id            uuid            not null primary key
                                    references auth.users (id) on delete cascade,

  listening_time     bigint          not null default 0,
  songs_played       integer         not null default 0,
  hours_this_week    numeric         not null default 0,
  active_streak      integer         not null default 0,
  last_active_date   date,

  updated_at         timestamptz     not null default now()
);

create index if not exists profiles_user_id_idx
  on public.profiles (user_id);

alter table public.profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'profiles: select own'
  ) then
    create policy "profiles: select own"
      on public.profiles for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'profiles: insert own'
  ) then
    create policy "profiles: insert own"
      on public.profiles for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'profiles'
      and policyname = 'profiles: update own'
  ) then
    create policy "profiles: update own"
      on public.profiles for update
      using ( auth.uid() = user_id )
      with check ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  002 — recent_played (recently played songs)              ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.recent_played (
  id          bigint          generated always as identity primary key,
  user_id     uuid            not null references auth.users (id) on delete cascade,
  song_id     text            not null,
  title       text            not null,
  artist      text            not null,
  image_url   text,
  hue         integer         not null default 200,
  hue2        integer         not null default 220,
  played_at   timestamptz     not null default now()
);

create index if not exists recent_played_user_played_at_idx
  on public.recent_played (user_id, played_at desc);

alter table public.recent_played enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'recent_played'
      and policyname = 'recent_played: select own'
  ) then
    create policy "recent_played: select own"
      on public.recent_played for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'recent_played'
      and policyname = 'recent_played: insert own'
  ) then
    create policy "recent_played: insert own"
      on public.recent_played for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'recent_played'
      and policyname = 'recent_played: delete own'
  ) then
    create policy "recent_played: delete own"
      on public.recent_played for delete
      using ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  003 — liked_songs                                       ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.liked_songs (
  id          bigint          generated always as identity primary key,
  user_id     uuid            not null references auth.users (id) on delete cascade,
  song_id     text            not null,
  title       text            not null,
  artist      text            not null,
  album       text            not null default '',
  year        integer         not null default 0,
  duration    integer         not null default 0,
  hue         integer         not null default 200,
  hue2        integer         not null default 220,
  src         text            not null default '',
  genre       text            not null default '',
  image_url   text,
  liked_at    timestamptz     not null default now(),

  unique (user_id, song_id)
);

create index if not exists liked_songs_user_liked_at_idx
  on public.liked_songs (user_id, liked_at desc);

alter table public.liked_songs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'liked_songs'
      and policyname = 'liked_songs: select own'
  ) then
    create policy "liked_songs: select own"
      on public.liked_songs for select
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'liked_songs'
      and policyname = 'liked_songs: insert own'
  ) then
    create policy "liked_songs: insert own"
      on public.liked_songs for insert
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'liked_songs'
      and policyname = 'liked_songs: delete own'
  ) then
    create policy "liked_songs: delete own"
      on public.liked_songs for delete
      using ( auth.uid() = user_id );
  end if;
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  004 — play_history (full play log)                       ║
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
-- ║  005 — rooms (listening rooms)                            ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.rooms (
  id               uuid            default gen_random_uuid() primary key,
  code             text            unique not null,
  host_id          text            not null,
  members          jsonb           default '[]'::jsonb,
  current_song_id  text,
  current_song     jsonb,
  is_playing       boolean         default false,
  position         numeric         default 0,
  status           text            default 'waiting' check (status in ('waiting', 'playing')),
  created_at       timestamptz     not null default timezone('utc'::text, now())
);

create index if not exists rooms_code_idx
  on public.rooms (code);

alter table if exists public.rooms add column if not exists max_members integer default 6;

alter table public.rooms enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rooms'
      and policyname = 'rooms: select all'
  ) then
    create policy "rooms: select all"
      on public.rooms for select
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rooms'
      and policyname = 'rooms: insert all'
  ) then
    create policy "rooms: insert all"
      on public.rooms for insert
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rooms'
      and policyname = 'rooms: update all'
  ) then
    create policy "rooms: update all"
      on public.rooms for update
      using (true);
  end if;
end $$;

alter publication supabase_realtime add table public.rooms;
