-- ============================================================
-- Room Queue Enhancement Migration
-- ============================================================
-- Add queue support to rooms for synchronized playback
-- across all members with full song list visibility
-- ============================================================

-- Add queue column to rooms table
alter table if exists public.rooms 
  add column if not exists queue jsonb default '[]'::jsonb;

-- Add current index to track position in queue
alter table if exists public.rooms 
  add column if not exists current_index integer default 0;

-- Add column to track who initiated current song change
alter table if exists public.rooms 
  add column if not exists last_changed_by text;

-- Add timestamp for last update
alter table if exists public.rooms 
  add column if not exists updated_at timestamptz default now();

-- Create index for faster queue lookups
create index if not exists rooms_queue_idx
  on public.rooms using gin (queue);

-- Update the updated_at column automatically
create or replace function update_rooms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists rooms_updated_at_trigger on public.rooms;

create trigger rooms_updated_at_trigger
  before update on public.rooms
  for each row
  execute function update_rooms_updated_at();

-- Comments for documentation
comment on column public.rooms.queue is 'Array of song objects in the room queue';
comment on column public.rooms.current_index is 'Index of currently playing song in queue';
comment on column public.rooms.last_changed_by is 'User ID of member who last changed the song/queue';
