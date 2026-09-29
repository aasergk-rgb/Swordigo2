import Phaser from 'phaser';
import { PLAYER, RENDER_SCALE, VIEW_H, VIEW_W } from './config';
import { BootScene } from './scenes/BootScene';
import { EndScene } from './scenes/EndScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { TitleScene } from './scenes/TitleScene';
import { watchInputMode } from './inputMode';
import { session } from './session';
import { TouchOverlay } from './touchOverlay';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W * RENDER_SCALE,
  height: VIEW_H * RENDER_SCALE,
  backgroundColor: '#000000',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: PLAYER.gravity }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },
  scene: [BootScene, TitleScene, GameScene, HUDScene, EndScene],
});

watchInputMode();
const touchOverlay = new TouchOverlay(game);

// Handy for debugging and automated smoke tests.
Object.assign(window, { __game: game, __session: session, __touch: touchOverlay });
