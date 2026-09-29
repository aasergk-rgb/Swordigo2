// Player settings for the on-screen controls and HUD layout. Kept apart from the save data:
// they belong to the device, not to the adventure.

export type PadType = 'bar' | 'dpad';

/** Everything that can be moved in the layout editor. */
export type CtlId = 'move' | 'dpad' | 'up' | 'down' | 'jump' | 'attack' | 'magic' | 'switch' | 'menu' | 'heal' | 'ether' | 'context';
export type HudId = 'status' | 'purse';

/** A moved control: centre as a fraction of the screen, and its own size factor. */
export interface Placed {
  x: number;
  y: number;
  s?: number;
}

export interface Settings {
  pad: PadType;
  /** Size factor for all buttons. */
  size: number;
  /** Button opacity. */
  opacity: number;
  layout: Partial<Record<CtlId, Placed>>;
  /** HUD blocks: top-left (status) / top-right (purse) corner as a fraction of the screen. */
  hud: Partial<Record<HudId, Placed>>;
}

export const SIZES = [
  { v: 0.85, label: '小' },
  { v: 1, label: '中' },
  { v: 1.15, label: '大' },
  { v: 1.3, label: '特大' },
];
export const OPACITIES = [
  { v: 0.45, label: 'うすい' },
  { v: 0.8, label: 'ふつう' },
  { v: 1, label: 'こい' },
];

const KEY = 'luminablade.settings.v1';

export function defaultSettings(): Settings {
  return { pad: 'bar', size: 1, opacity: 0.8, layout: {}, hud: {} };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Reads settings from JSON, dropping anything malformed. */
export function parseSettings(text: string | null | undefined): Settings {
  const s = defaultSettings();
  if (!text) return s;
  let raw: Partial<Settings>;
  try {
    raw = JSON.parse(text);
  } catch {
    return s;
  }
  if (raw.pad === 'bar' || raw.pad === 'dpad') s.pad = raw.pad;
  if (typeof raw.size === 'number') s.size = clamp(raw.size, 0.6, 1.6);
  if (typeof raw.opacity === 'number') s.opacity = clamp(raw.opacity, 0.2, 1);
  const places = (o: unknown, into: Record<string, Placed>) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o as Record<string, Placed>)) {
      if (!v || typeof v.x !== 'number' || typeof v.y !== 'number') continue;
      into[k] = { x: clamp(v.x, 0, 1), y: clamp(v.y, 0, 1), ...(typeof v.s === 'number' ? { s: clamp(v.s, 0.5, 2) } : {}) };
    }
  };
  places(raw.layout, s.layout);
  places(raw.hud, s.hud);
  return s;
}

interface NativeSettings {
  __nativeSettings?: string | null;
  webkit?: { messageHandlers?: { settings?: { postMessage(s: string): void } } };
}
const native = (typeof window === 'undefined' ? {} : window) as NativeSettings;

function load(): Settings {
  if (native.__nativeSettings) return parseSettings(native.__nativeSettings);
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return defaultSettings();
  }
}

export const settings: Settings = load();
const listeners = new Set<() => void>();

/** Call after changing `settings`: stores them and tells the UI. */
export function saveSettings(): void {
  const text = JSON.stringify(settings);
  native.webkit?.messageHandlers?.settings?.postMessage(text);
  try {
    localStorage.setItem(KEY, text);
  } catch {
    // Not stored this time; the settings still apply until the game closes.
  }
  for (const fn of listeners) fn();
}

export function onSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetLayout(): void {
  settings.layout = {};
  settings.hud = {};
  saveSettings();
}

/** Next value in a list of options (wrapping), for menu rows that cycle. */
export function cycle<T extends { v: number }>(list: T[], current: number): T {
  let i = list.findIndex((o) => Math.abs(o.v - current) < 0.01);
  i = (i + 1) % list.length;
  return list[i];
}

export function labelOf<T extends { v: number; label: string }>(list: T[], current: number): string {
  return list.find((o) => Math.abs(o.v - current) < 0.01)?.label ?? `${Math.round(current * 100)}%`;
}
