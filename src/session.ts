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
};

/** The iPad app keeps the save natively: it hands it in at start-up and takes each new one. */
interface NativeSave {
  __nativeSave?: string | null;
  webkit?: { messageHandlers?: { save?: { postMessage(s: string): void } } };
}
const native = (typeof window === 'undefined' ? {} : window) as NativeSave;

export function saveGame(): boolean {
  const text = serialize(session.data);
  let ok = false;
  const bridge = native.webkit?.messageHandlers?.save;
  if (bridge) {
    bridge.postMessage(text);
    native.__nativeSave = text;
    ok = true;
  }
  try {
    localStorage.setItem(SAVE_KEY, text);
    ok = true;
  } catch {
    // Storage can be unavailable (private mode); the native copy may still have it.
  }
  return ok;
}

export function loadGame(): SaveData | null {
  try {
    if (native.__nativeSave) return deserialize(native.__nativeSave);
    return deserialize(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
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
