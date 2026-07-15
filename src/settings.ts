/**
 * Global app settings — persisted in localStorage so they survive page reloads.
 *
 * We use a simple event-based approach (no extra dependencies) so any component
 * can subscribe to changes without a full context re-render cascade.
 */

export type AudioQuality = '96' | '160' | '320';

export type AppSettings = {
  /** Stream quality kbps — passed to saavn qualityUrl() */
  audioQuality: AudioQuality;
  /** Autoplay similar songs when queue ends */
  autoPlay: boolean;
  /** Crossfade duration in seconds (0 = off) */
  crossfadeSecs: number;
  /** Lower quality when on mobile/metered data */
  dataSaver: boolean;
  /** Push notifications (browser Notification API) */
  notifications: boolean;
};

const STORAGE_KEY = 'vibify_settings_v1';

const DEFAULTS: AppSettings = {
  audioQuality: '320',
  autoPlay: true,
  crossfadeSecs: 0,
  dataSaver: false,
  notifications: false,
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* quota exceeded — ignore */ }
}

// In-memory singleton
let _settings: AppSettings = load();

const _listeners = new Set<() => void>();

/** Read current settings (always up-to-date) */
export function getSettings(): AppSettings {
  return _settings;
}

/** Update one or more keys and persist */
export function updateSettings(patch: Partial<AppSettings>): void {
  _settings = { ..._settings, ...patch };
  save(_settings);
  _listeners.forEach(fn => fn());
}

/** Subscribe to any settings change. Returns an unsubscribe function. */
export function onSettingsChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** React hook — re-renders the component whenever settings change */
import { useEffect, useState } from 'react';

export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  useEffect(() => {
    // Sync if another tab changed localStorage
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(load());
    };
    window.addEventListener('storage', onStorage);
    const unsub = onSettingsChange(() => setSettings(getSettings()));
    return () => {
      window.removeEventListener('storage', onStorage);
      unsub();
    };
  }, []);

  return [settings, updateSettings];
}
