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
};

export function saveGame(): boolean {
  try {
    localStorage.setItem(SAVE_KEY, serialize(session.data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): SaveData | null {
  try {
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
} as const;

export type DialogHandler = (lines: Line[], onDone?: () => void) => void;
