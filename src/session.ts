// State shared between the game scene and the HUD scene.
import { SAVE_KEY } from './config';
import { deserialize, newGame, serialize, type SaveData } from './progress';
import type { Line } from './data/dialogs';

export type ButtonName = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'magic';

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

// Events sent from the game scene to the HUD.
export const EV = {
  dialog: 'ui:dialog', // (lines: Line[], onDone?: () => void)
  levelUp: 'ui:levelup', // (count: number, onDone?: () => void)
  toast: 'ui:toast', // (text: string)
} as const;

export type DialogHandler = (lines: Line[], onDone?: () => void) => void;
