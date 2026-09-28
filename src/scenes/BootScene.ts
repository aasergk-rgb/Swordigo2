import Phaser from 'phaser';
import { TILE } from '../config';

/** Placeholder art: every texture is drawn from simple shapes at startup. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeTiles();

    this.box('player', 12, 22, 0x7ec8ff, (g) => {
      g.fillStyle(0xf3d9b1).fillRect(2, 2, 8, 7); // face
      g.fillStyle(0x1b1b2f).fillRect(7, 4, 2, 2); // eye (faces right)
      g.fillStyle(0xd94f3d).fillRect(0, 0, 12, 3); // hair band
    });
    this.box('slash', 26, 18, 0x000000, (g) => {
      g.clear();
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(0, 9, 22, -1.1, 1.1).strokePath();
    });
    this.box('slash_v', 18, 26, 0x000000, (g) => {
      g.clear();
      g.lineStyle(3, 0xffffff, 1).beginPath().arc(9, 26, 22, -Math.PI + 0.45, -0.45).strokePath();
    });

    this.box('slime', 14, 10, 0x2a1838, (g) => this.eyes(g, 3, 3, 8));
    this.box('bat', 16, 8, 0x241a33, (g) => this.eyes(g, 5, 2, 6));
    this.box('wolf', 22, 14, 0x1f1a2b, (g) => this.eyes(g, 16, 3, 4));
    this.box('boss_wolf', 40, 26, 0x16121f, (g) => {
      this.eyes(g, 30, 6, 6);
      g.fillStyle(0x4b2a6b).fillRect(0, 22, 40, 4);
    });
    this.circle('nut', 3, 0xa0703a);
    this.circle('bolt', 4, 0xfff3a0);

    this.box('pot', 10, 12, 0x9a5b34, (g) => g.fillStyle(0x6b3b1f).fillRect(0, 0, 10, 3));
    this.box('grass', 12, 8, 0x3f9b4a, (g) => g.fillStyle(0x6fd06a).fillRect(2, 0, 2, 4).fillRect(7, 0, 2, 3));
    this.box('chest', 14, 11, 0xa06a2a, (g) => g.fillStyle(0xf2c14e).fillRect(6, 4, 2, 3));
    this.box('chest_open', 14, 11, 0x5a3a18, (g) => g.fillStyle(0x2a1a0a).fillRect(1, 0, 12, 4));
    this.circle('coin', 2.5, 0xf6d743);
    this.box('heart', 7, 6, 0xe8425a);
    this.circle('mp_orb', 2.5, 0x5fa8ff);
    this.box('fountain', 16, 20, 0x3a4a6a, (g) => {
      g.fillStyle(0x9fe6ff).fillRect(4, 2, 8, 12);
      g.fillStyle(0xe6fbff).fillRect(6, 4, 4, 6);
    });
    this.box('sign', 12, 12, 0x8a6a42, (g) => g.fillStyle(0x5a4028).fillRect(5, 8, 2, 4));
    this.box('npc_elder', 12, 22, 0x9b8fb5, (g) => {
      g.fillStyle(0xf3d9b1).fillRect(2, 2, 8, 7);
      g.fillStyle(0xeeeeee).fillRect(2, 7, 8, 4); // beard
    });
    this.box('npc_boy', 10, 16, 0x7fb069, (g) => g.fillStyle(0xf3d9b1).fillRect(1, 1, 8, 6));
    this.box('garen', 24, 8, 0x5b6b7b, (g) => g.fillStyle(0xcfcfcf).fillRect(18, 1, 6, 6));
    this.box('particle', 3, 3, 0xffffff);
    this.box('prompt', 7, 7, 0xffffff, (g) => {
      g.clear();
      g.fillStyle(0xffffff).fillTriangle(3.5, 0, 0, 6, 7, 6);
    });

    this.scene.start('Title');
  }

  private box(key: string, w: number, h: number, color: number, extra?: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.add.graphics();
    g.fillStyle(color).fillRect(0, 0, w, h);
    extra?.(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private circle(key: string, r: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color).fillCircle(r, r, r);
    g.generateTexture(key, Math.ceil(r * 2), Math.ceil(r * 2));
    g.destroy();
  }

  private eyes(g: Phaser.GameObjects.Graphics, x: number, y: number, gap: number): void {
    g.fillStyle(0xffffff).fillRect(x, y, 2, 2).fillRect(x + gap - 2, y, 2, 2);
  }

  /** Tileset: 0 grass top, 1 dirt, 2 one-way platform, 3 spikes. */
  private makeTiles(): void {
    const g = this.add.graphics();
    // 0: grass-topped ground
    g.fillStyle(0x5a3d2b).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x4caf50).fillRect(0, 0, TILE, 4);
    g.fillStyle(0x3b8a3e).fillRect(0, 4, TILE, 1);
    // 1: dirt
    g.fillStyle(0x4a3222).fillRect(TILE, 0, TILE, TILE);
    g.fillStyle(0x3d2819).fillRect(TILE + 3, 5, 3, 2).fillRect(TILE + 10, 11, 3, 2);
    // 2: wooden one-way platform
    g.fillStyle(0x9c6b3c).fillRect(TILE * 2, 0, TILE, 5);
    g.fillStyle(0x6e4826).fillRect(TILE * 2, 5, TILE, 1);
    // 3: spikes
    g.fillStyle(0xc9c9d6);
    for (let i = 0; i < 4; i++) g.fillTriangle(TILE * 3 + i * 4, TILE, TILE * 3 + i * 4 + 2, TILE - 9, TILE * 3 + i * 4 + 4, TILE);
    g.generateTexture('tiles', TILE * 4, TILE);
    g.destroy();
  }
}
