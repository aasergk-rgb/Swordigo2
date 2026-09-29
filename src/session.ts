// State shared between the game scene and the HUD scene.
import { SAVE_KEY } from './config';
import type { Line } from './data/types';
import { deserialize, newGame, serialize, type SaveData } from './progress';

export type ButtonName = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'magic' | 'heal' | 'ether' | 'switch' | 'menu';

export interface BossBar {
  name: string;
  hp: number;
  max: number;
}

export const session = {
  data: newGame() as SaveData,
  /** Buttons held on the touch overlay (written by the HUD). */
  touch: {} as Partial<Record<ButtonName, boolean>>,
  boss: null as BossBar | null,
  /** True while a dialog or menu has the focus; the world is frozen. */
  uiBlocking: false,
  /** Name of the current area, shown on the map. */
  roomName: '',
  roomArea: '',
  /** Verb for what the player can use right now ("話す", "開ける"...), or null. */
  interactHint: null as string | null,
  /**
   * Where the HUD blocks go, in canvas pixels (written by the touch overlay): offset of the
   * status block, right edge and vertical offset of the purse. `right` null = canvas edge.
   */
  hud: { sx: 0, sy: 0, right: null as number | null, py: 0 },
  /** Save file in use (0-based). */
  slot: 0,
};

// ---------------------------------------------------------------- save files
// Three save files. File 1 uses the original key, so saves from before files existed stay.
export const SLOTS = 3;
const slotKey = (i: number) => (i === 0 ? SAVE_KEY : `${SAVE_KEY}.${i + 1}`);

/**
 * The iPad app keeps the saves natively: it hands them in at start-up and takes each new
 * version. The native value is `{"slots":[...]}` (older apps held a single save = file 1).
 */
interface NativeSave {
  __nativeSave?: string | null;
  webkit?: { messageHandlers?: { save?: { postMessage(s: string): void } } };
}
const native = (typeof window === 'undefined' ? {} : window) as NativeSave;

function nativeSlots(): (string | null)[] | null {
  if (!native.webkit?.messageHandlers?.save && !native.__nativeSave) return null;
  const raw = native.__nativeSave;
  const out: (string | null)[] = Array(SLOTS).fill(null);
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as { slots?: unknown };
    if (Array.isArray(v.slots)) v.slots.slice(0, SLOTS).forEach((t, i) => (out[i] = typeof t === 'string' ? t : null));
    else out[0] = raw;
  } catch {
    // Unreadable: treat as empty.
  }
  return out;
}

function writeSlot(i: number, text: string | null): boolean {
  let ok = false;
  const slots = nativeSlots();
  const bridge = native.webkit?.messageHandlers?.save;
  if (slots && bridge) {
    slots[i] = text;
    const all = JSON.stringify({ slots });
    bridge.postMessage(all);
    native.__nativeSave = all;
    ok = true;
  }
  try {
    if (text === null) localStorage.removeItem(slotKey(i));
    else localStorage.setItem(slotKey(i), text);
    ok = true;
  } catch {
    // Storage can be unavailable (private mode); the native copy may still have it.
  }
  return ok;
}

/** The save in file `i` (0-based), or null when empty. */
export function loadSlot(i: number): SaveData | null {
  try {
    const slots = nativeSlots();
    if (slots) return deserialize(slots[i]);
    return deserialize(localStorage.getItem(slotKey(i)));
  } catch {
    return null;
  }
}

/** Saves the adventure into the file it was started from or loaded from. */
export function saveGame(): boolean {
  return writeSlot(session.slot, serialize(session.data));
}

export function deleteSlot(i: number): void {
  writeSlot(i, null);
}

/** The save in the current file (kept for callers that just want "the" save). */
export function loadGame(): SaveData | null {
  return loadSlot(session.slot);
}

// Requests sent from the game scene to the HUD. Each carries a callback for its result.
export const EV = {
  dialog: 'ui:dialog', // (lines: Line[], done)
  choice: 'ui:choice', // (question, options, done(index))
  levelUp: 'ui:levelup', // (count, done)
  toast: 'ui:toast', // (text)
  banner: 'ui:banner', // (title, sub, done)  big "got item" / chapter banner
  shop: 'ui:shop', // (shopId, done)
  warp: 'ui:warp', // (done(roomId | null))
  menu: 'ui:menu', // (done)
  area: 'ui:area', // (name) area title card
  edit: 'ui:edit', // (done) touch-control and HUD layout editor
} as const;

export type DialogHandler = (lines: Line[], onDone?: () => void) => void;
