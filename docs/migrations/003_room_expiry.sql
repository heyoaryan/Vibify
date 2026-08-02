-- ============================================================
-- Room Expiry Migration (v2)
-- ============================================================
-- Logic:
--   • Room mein members hain (active hai) → kabhi expire nahi hoga
--   • Room mein koi member nahi → 2 ghante baad automatically delete
--
-- Implementation:
--   1. expires_at  — NULL jab room active ho, future timestamp jab empty ho
--   2. last_emptied_at — jab last member leave kare toh yeh set ho
--   3. UPDATE trigger — members array change hone par expires_at auto-manage kare
--   4. delete_expired_rooms() — sirf expired + empty rooms delete kare
--   5. pg_cron — har 30 min mein cleanup
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 1 — Columns add karo                               ║
-- ╚══════════════════════════════════════════════════════════╝

-- expires_at:
--   NULL  → room active hai (members hain), delete mat karo
--   value → is timestamp ke baad delete karo (room empty hai)
alter table public.rooms
  add column if not exists expires_at      timestamptz default null,
  add column if not exists last_emptied_at timestamptz default null;

comment on column public.rooms.expires_at is
  'NULL = room active (has members). Set to a future timestamp when room becomes empty — delete after that time.';
comment on column public.rooms.last_emptied_at is
  'Timestamp when the last member left the room. Used for audit / debugging.';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 2 — Existing rooms: backfill expires_at            ║
-- ╚══════════════════════════════════════════════════════════╝

-- Rooms jo already empty hain unhe 2 ghante ka expiry do
update public.rooms
  set
    expires_at      = now() + interval '2 hours',
    last_emptied_at = now()
  where
    (members is null or jsonb_array_length(members) = 0)
    and expires_at is null;

-- Rooms jisme members hain → expires_at NULL rakho (active hai)
update public.rooms
  set expires_at = null
  where
    members is not null
    and jsonb_array_length(members) > 0;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 3 — Trigger: members change hone par expires_at    ║
-- ║           automatically manage karo                      ║
-- ╚══════════════════════════════════════════════════════════╝
--
-- Yeh trigger BEFORE UPDATE pe fire hoga.
-- Har baar members column update ho:
--   • Members hain  → expires_at = NULL  (room active, protect karo)
--   • Members 0 hain → expires_at = now() + 2 hours  (countdown shuru)

create or replace function manage_room_expiry()
returns trigger as $$
begin
  -- Members column change hua hai ya nahi check karo
  if new.members is distinct from old.members then

    if new.members is not null and jsonb_array_length(new.members) > 0 then
      -- Room mein koi hai — expire mat karo
      new.expires_at      := null;
      new.last_emptied_at := old.last_emptied_at; -- preserve purana value

    else
      -- Room empty ho gaya — 2 ghante ka timer shuru karo
      new.expires_at      := now() + interval '2 hours';
      new.last_emptied_at := now();
    end if;

  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists room_expiry_on_members_change on public.rooms;

create trigger room_expiry_on_members_change
  before update on public.rooms
  for each row
  execute function manage_room_expiry();

comment on function manage_room_expiry() is
  'Members array change hone par expires_at auto-set karta hai. Members hain → NULL (never expire). Members 0 → now() + 2 hours.';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 4 — INSERT trigger: naye room ka expiry set karo   ║
-- ╚══════════════════════════════════════════════════════════╝
-- Naya room bante waqt host khud member hota hai —
-- toh expires_at NULL hona chahiye (active room).
-- Agar kisi wajah se members empty insert ho toh 2 ghante do.

create or replace function set_room_expiry_on_insert()
returns trigger as $$
begin
  if new.members is not null and jsonb_array_length(new.members) > 0 then
    new.expires_at := null; -- active room
  else
    new.expires_at := now() + interval '2 hours'; -- empty room
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists room_expiry_on_insert on public.rooms;

create trigger room_expiry_on_insert
  before insert on public.rooms
  for each row
  execute function set_room_expiry_on_insert();

comment on function set_room_expiry_on_insert() is
  'Naye room ke liye expires_at set karta hai based on initial members count.';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 5 — Cleanup function                               ║
-- ╚══════════════════════════════════════════════════════════╝
-- Sirf woh rooms delete karo jo:
--   a) expires_at set hai (matlab empty ho chuke hain)
--   b) expires_at past mein hai (2 ghante guzar gaye)
--
-- Active rooms (expires_at IS NULL) kabhi delete NAHI honge.

create or replace function delete_expired_rooms()
returns void as $$
declare
  deleted_count integer;
begin
  delete from public.rooms
  where
    expires_at is not null    -- sirf empty rooms
    and expires_at < now();   -- jinki timer khatam ho gayi

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    raise log '[vibify] delete_expired_rooms: % room(s) deleted', deleted_count;
  end if;
end;
$$ language plpgsql security definer;

comment on function delete_expired_rooms() is
  'Empty + expired rooms delete karta hai. Active rooms (expires_at IS NULL) safe hain. pg_cron se run hota hai.';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Step 6 — pg_cron: har 30 minute mein cleanup            ║
-- ╚══════════════════════════════════════════════════════════╝
-- NOTE: pg_cron extension enable honi chahiye.
-- Supabase Dashboard → Database → Extensions → pg_cron

do $$
begin
  -- Pehle purana job hata do agar exist karta ho (idempotent)
  begin
    perform cron.unschedule('delete-expired-rooms');
  exception when others then
    null; -- job exist nahi karta — theek hai
  end;

  -- Naya job schedule karo
  perform cron.schedule(
    'delete-expired-rooms',
    '*/30 * * * *',
    $cmd$ select delete_expired_rooms(); $cmd$
  );

exception when others then
  raise notice 'pg_cron not available — run "select delete_expired_rooms();" manually to cleanup expired rooms.';
end $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  Summary                                                  ║
-- ╚══════════════════════════════════════════════════════════╝
--
--  Column: expires_at
--    NULL        → room mein members hain, active hai, kabhi delete nahi hoga
--    timestamp   → yeh time guzarne ke baad room delete ho jaayega
--
--  Column: last_emptied_at
--    NULL        → abhi tak empty nahi hua
--    timestamp   → last member kab gaya
--
--  Trigger: room_expiry_on_members_change (BEFORE UPDATE)
--    members > 0  → expires_at = NULL
--    members = 0  → expires_at = now() + 2 hours
--
--  Trigger: room_expiry_on_insert (BEFORE INSERT)
--    members > 0  → expires_at = NULL
--    members = 0  → expires_at = now() + 2 hours
--
--  Function: delete_expired_rooms()
--    expires_at IS NOT NULL AND expires_at < now() → DELETE
--    expires_at IS NULL → SAFE (never deleted)
--
--  pg_cron: delete-expired-rooms — har 30 min
--
-- ╔══════════════════════════════════════════════════════════╗
-- ║  Rollback karna ho toh:                                  ║
-- ╚══════════════════════════════════════════════════════════╝
-- do $$ begin perform cron.unschedule('delete-expired-rooms'); exception when others then null; end $$;
-- drop trigger if exists room_expiry_on_members_change on public.rooms;
-- drop trigger if exists room_expiry_on_insert on public.rooms;
-- drop function if exists manage_room_expiry();
-- drop function if exists set_room_expiry_on_insert();
-- drop function if exists delete_expired_rooms();
-- alter table public.rooms drop column if exists expires_at;
-- alter table public.rooms drop column if exists last_emptied_at;
