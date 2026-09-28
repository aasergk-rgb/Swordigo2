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
};

/** Merges keyboard and touch buttons, and tracks "pressed this frame". */
export class Controls {
  private keys: Record<ButtonName, Phaser.Input.Keyboard.Key[]>;
  private held: Record<ButtonName, boolean>;
  private prev: Record<ButtonName, boolean>;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const entries = Object.entries(KEYMAP).map(([name, codes]) => [
      name,
      codes.map((c) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[c as keyof typeof Phaser.Input.Keyboard.KeyCodes] as number)),
    ]);
    this.keys = Object.fromEntries(entries);
    const none = () => ({ left: false, right: false, up: false, down: false, jump: false, attack: false, magic: false });
    this.held = none();
    this.prev = none();
  }

  update(): void {
    for (const name of Object.keys(this.keys) as ButtonName[]) {
      this.prev[name] = this.held[name];
      this.held[name] = this.keys[name].some((k) => k.isDown) || !!session.touch[name];
    }
  }

  isDown(b: ButtonName): boolean {
    return this.held[b];
  }

  justDown(b: ButtonName): boolean {
    return this.held[b] && !this.prev[b];
  }
}

/** The single controls instance; recreated when the game scene restarts. */
export const controlsRef: { current: Controls | null } = { current: null };
