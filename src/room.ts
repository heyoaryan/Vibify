import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { usePlayer } from './player';
import { usePlayback } from './player';
import { useCurrentUser } from './auth';
import type { Song } from './types';
import type { UserProfile } from './auth';
import { ALL_SONGS } from './data';

export type RoomStatus = 'waiting' | 'playing';

export type RoomUser = {
  id: string;
  name: string;
  avatar?: string;
};

export type RoomState = {
  id: string;
  code: string;
  hostId: string;
  members: RoomUser[];
  currentSong: Song | null;
  isPlaying: boolean;
  status: RoomStatus;
  position: number;
  maxMembers: number;
};

export const MAX_MEMBERS = 6;
export const MIN_MEMBERS = 2;
export const AUTO_START_DELAY = 5000;
export const POSITION_SYNC_INTERVAL = 2000;
export const POSITION_DRIFT_THRESHOLD = 2;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function userToRoomUser(user: UserProfile): RoomUser {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
  };
}

function jsonToSong(json: any): Song {
  return {
    id: json.id,
    title: json.title,
    artist: json.artist,
    album: json.album || '',
    year: json.year || 0,
    duration: json.duration || 0,
    hue: json.hue || 200,
    hue2: json.hue2 || 200,
    src: json.src || '',
    genre: json.genre || '',
    imageUrl: json.imageUrl,
  };
}

function songToJson(song: Song | null) {
  if (!song) return null;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    duration: song.duration,
    hue: song.hue,
    hue2: song.hue2,
    src: song.src,
    genre: song.genre,
    imageUrl: song.imageUrl,
  };
}

export function useRoom() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const positionSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHostRef = useRef(false);
  const { togglePlay, seek, playSongs, current } = usePlayer();
  const { position } = usePlayback();
  const user = useCurrentUser();

  const positionRef = useRef(position);
  const isPlayingRef = useRef(false);
  const currentRef = useRef(current);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    if (roomState) {
      isHostRef.current = roomState.hostId === user.id;
    } else {
      isHostRef.current = false;
    }
  }, [roomState?.hostId, user.id]);

  const clearTimers = useCallback(() => {
    if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    positionSyncRef.current = null;
    autoStartTimerRef.current = null;
  }, []);

  const stopPositionSync = useCallback(() => {
    if (positionSyncRef.current) {
      clearInterval(positionSyncRef.current);
      positionSyncRef.current = null;
    }
  }, []);

  const startPositionSync = useCallback(() => {
    stopPositionSync();
    if (!isHostRef.current || !roomState || roomState.status !== 'playing') return;

    positionSyncRef.current = setInterval(async () => {
      if (!roomState) return;
      const currentPos = positionRef.current;
      const currentlyPlaying = isPlayingRef.current;

      setRoomState(prev => {
        if (!prev) return prev;
        const posDiff = Math.abs(prev.position - currentPos);
        const playDiff = prev.isPlaying !== currentlyPlaying;
        if (posDiff < 0.5 && !playDiff) return prev;

        supabase
          .from('rooms')
          .update({
            position: currentPos,
            is_playing: currentlyPlaying,
          })
          .eq('id', prev.id)
          .then(() => {});

        return {
          ...prev,
          position: currentPos,
          isPlaying: currentlyPlaying,
        };
      });
    }, POSITION_SYNC_INTERVAL);
  }, [roomState, stopPositionSync]);

  useEffect(() => {
    if (!roomState || roomState.status !== 'waiting') return;
    if (roomState.members.length < MIN_MEMBERS) return;

    clearTimers();
    autoStartTimerRef.current = setTimeout(async () => {
      if (!roomState || roomState.status !== 'waiting') return;
      if (roomState.members.length < MIN_MEMBERS) return;

      const song = currentRef.current || ALL_SONGS[0] || null;

      await supabase
        .from('rooms')
        .update({
          status: 'playing',
          current_song_id: song?.id || null,
          current_song: songToJson(song),
          is_playing: true,
          position: 0,
        })
        .eq('id', roomState.id);
    }, AUTO_START_DELAY);

    return clearTimers;
  }, [roomState?.status, roomState?.members.length, roomState?.id, clearTimers]);

  useEffect(() => {
    if (!roomState || roomState.status !== 'playing') {
      stopPositionSync();
      return;
    }
    if (!isHostRef.current) return;

    startPositionSync();
    return stopPositionSync;
  }, [roomState?.status, roomState?.id, isHostRef.current, startPositionSync, stopPositionSync]);

  useEffect(() => {
    if (!roomState) return;

    const channel = supabase
      .channel(`room:${roomState.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomState.id}`,
        },
        (payload) => {
          const newRoom = payload.new as any;
          setRoomState(prev => {
            if (!prev) return prev;

            const updated: RoomState = {
              ...prev,
              members: newRoom.members || prev.members,
              currentSong: newRoom.current_song ? jsonToSong(newRoom.current_song) : prev.currentSong,
              isPlaying: newRoom.is_playing ?? prev.isPlaying,
              status: newRoom.status || prev.status,
              position: newRoom.position ?? prev.position,
              maxMembers: newRoom.max_members || prev.maxMembers,
            };

            if (!isHostRef.current) {
              if (updated.status === 'playing' && prev.status === 'waiting') {
                if (updated.currentSong) {
                  playSongs([updated.currentSong], updated.currentSong.id);
                  setTimeout(() => seek(updated.position), 150);
                }
              } else if (updated.currentSong && updated.currentSong.id !== prev.currentSong?.id) {
                playSongs([updated.currentSong], updated.currentSong.id);
                setTimeout(() => seek(updated.position), 150);
              } else if (updated.isPlaying !== prev.isPlaying) {
                if (updated.isPlaying && !isPlayingRef.current) {
                  togglePlay();
                } else if (!updated.isPlaying && isPlayingRef.current) {
                  togglePlay();
                }
              } else if (Math.abs(updated.position - prev.position) > POSITION_DRIFT_THRESHOLD) {
                seek(updated.position);
              }
            }

            return updated;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomState?.id, isHostRef.current, togglePlay, seek, playSongs]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clearTimers]);

  const createRoom = useCallback(async (maxMembers: number = MAX_MEMBERS): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);
    setError(null);

    const code = generateCode();
    const roomUser = userToRoomUser(user);

    const { data, error: insertError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        members: [roomUser],
        status: 'waiting',
        is_playing: false,
        position: 0,
        max_members: maxMembers,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message || 'Failed to create room');
      setIsLoading(false);
      return false;
    }

    isHostRef.current = true;
    setRoomState({
      id: data.id,
      code: data.code,
      hostId: data.host_id,
      members: data.members,
      currentSong: data.current_song ? jsonToSong(data.current_song) : null,
      isPlaying: data.is_playing,
      status: data.status,
      position: data.position || 0,
      maxMembers: data.max_members || maxMembers,
    });
    setIsLoading(false);
    return true;
  }, [user]);

  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);
    setError(null);

    const { data: room, error: findError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (findError || !room) {
      setError('Room not found');
      setIsLoading(false);
      return false;
    }

    const roomMaxMembers = room.max_members || MAX_MEMBERS;
    if (room.members.length >= roomMaxMembers) {
      setError('Room is full');
      setIsLoading(false);
      return false;
    }

    if (room.members.some((m: any) => m.id === user.id)) {
      setError('You are already in this room');
      setIsLoading(false);
      return false;
    }

    const roomUser = userToRoomUser(user);
    const updatedMembers = [...room.members, roomUser];

    const { data: updated, error: updateError } = await supabase
      .from('rooms')
      .update({ members: updatedMembers })
      .eq('id', room.id)
      .select()
      .single();

    if (updateError || !updated) {
      setError(updateError?.message || 'Failed to join room');
      setIsLoading(false);
      return false;
    }

    isHostRef.current = updated.host_id === user.id;
    setRoomState({
      id: updated.id,
      code: updated.code,
      hostId: updated.host_id,
      members: updated.members,
      currentSong: updated.current_song ? jsonToSong(updated.current_song) : null,
      isPlaying: updated.is_playing,
      status: updated.status,
      position: updated.position || 0,
      maxMembers: updated.max_members || MAX_MEMBERS,
    });
    setIsLoading(false);
    return true;
  }, [user]);

  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!roomState || !user) return;

    clearTimers();
    stopPositionSync();

    const updatedMembers = roomState.members.filter(m => m.id !== user.id);

    if (updatedMembers.length === 0) {
      await supabase.from('rooms').delete().eq('id', roomState.id);
    } else if (roomState.hostId === user.id) {
      const newHost = updatedMembers[0];
      await supabase
        .from('rooms')
        .update({
          members: updatedMembers,
          host_id: newHost.id,
        })
        .eq('id', roomState.id);
    } else {
      await supabase
        .from('rooms')
        .update({ members: updatedMembers })
        .eq('id', roomState.id);
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('vibify-room-id');
    }
    setRoomState(null);
    isHostRef.current = false;
  }, [roomState, user, clearTimers, stopPositionSync]);

  const restoreRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (!user || roomState) return false;
    setIsLoading(true);
    setError(null);

    const { data: room, error: findError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (findError || !room) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('vibify-room-id');
      }
      setIsLoading(false);
      return false;
    }

    if (!room.members.some((m: any) => m.id === user.id)) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('vibify-room-id');
      }
      setIsLoading(false);
      return false;
    }

    isHostRef.current = room.host_id === user.id;
    setRoomState({
      id: room.id,
      code: room.code,
      hostId: room.host_id,
      members: room.members,
      currentSong: room.current_song ? jsonToSong(room.current_song) : null,
      isPlaying: room.is_playing,
      status: room.status,
      position: room.position || 0,
      maxMembers: room.max_members || MAX_MEMBERS,
    });
    setIsLoading(false);
    return true;
  }, [user, roomState]);

  useEffect(() => {
    if (roomState?.id) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('vibify-room-id', roomState.id);
      }
    }
  }, [roomState?.id]);

  const playRoom = useCallback(async (): Promise<void> => {
    if (!roomState || !isHostRef.current) return;
    await supabase
      .from('rooms')
      .update({ is_playing: true })
      .eq('id', roomState.id);
  }, [roomState]);

  const pauseRoom = useCallback(async (): Promise<void> => {
    if (!roomState || !isHostRef.current) return;
    await supabase
      .from('rooms')
      .update({ is_playing: false })
      .eq('id', roomState.id);
  }, [roomState]);

  const setRoomSong = useCallback(async (song: Song): Promise<void> => {
    if (!roomState || !isHostRef.current) return;
    await supabase
      .from('rooms')
      .update({
        current_song_id: song.id,
        current_song: songToJson(song),
      })
      .eq('id', roomState.id);
  }, [roomState]);

  return {
    roomState,
    isLoading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    restoreRoom,
    playRoom,
    pauseRoom,
    setRoomSong,
  };
}
