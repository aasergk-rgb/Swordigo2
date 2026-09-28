import Phaser from 'phaser';
import { generateArt } from '../art';

/** All art is drawn in code at startup (see src/art). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateArt(this);
    this.scene.start('Title');
  }
}
