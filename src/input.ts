import Phaser from 'phaser';
import { session, type ButtonName } from './session';

const KEYMAP: Record<ButtonName, string[]> = {
  left: ['LEFT'],
  right: ['RIGHT'],
  up: ['UP'],
  down: ['DOWN'],
  jump: ['Z', 'SPACE'],
  attack: ['X'],
  magic: ['C'],
  heal: ['Q'],
  ether: ['E'],
  switch: ['A', 'S'],
  menu: ['ESC', 'TAB', 'ENTER'],
};

const NAMES = Object.keys(KEYMAP) as ButtonName[];

/** Merges keyboard and touch buttons, and tracks "pressed this frame". */
export class Controls {
  private keys: Record<ButtonName, Phaser.Input.Keyboard.Key[]>;
  private held = {} as Record<ButtonName, boolean>;
  private prev = {} as Record<ButtonName, boolean>;
  /** Direction of the last spell-switch key: A = -1, S = +1. */
  switchDir = 1;
  private sKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const entries = Object.entries(KEYMAP).map(([name, codes]) => [
      name,
      codes.map((c) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[c as keyof typeof Phaser.Input.Keyboard.KeyCodes] as number, true, false)),
    ]);
    this.keys = Object.fromEntries(entries);
    this.sKey = this.keys.switch[1];
    for (const n of NAMES) this.held[n] = this.prev[n] = false;
  }

  update(): void {
    for (const name of NAMES) {
      this.prev[name] = this.held[name];
      this.held[name] = this.keys[name].some((k) => k.isDown) || !!session.touch[name] || !!session.touchPressed[name];
    }
    session.touchPressed = {};
    if (this.justDown('switch')) this.switchDir = this.sKey.isDown || session.touch.switch ? 1 : -1;
  }

  isDown(b: ButtonName): boolean {
    return this.held[b];
  }

  justDown(b: ButtonName): boolean {
    return this.held[b] && !this.prev[b];
  }

  /** Consumes a press so other listeners in the same frame don't see it. */
  eat(b: ButtonName): void {
    this.prev[b] = this.held[b];
  }
}

/** The single controls instance; recreated when the game scene restarts. */
export const controlsRef: { current: Controls | null } = { current: null };
