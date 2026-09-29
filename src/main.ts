import Phaser from 'phaser';
import { PLAYER, RENDER_SCALE, setView, VIEW_H, VIEW_W, viewFor, type ViewSize } from './config';
import { BootScene } from './scenes/BootScene';
import { EndScene } from './scenes/EndScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { TitleScene } from './scenes/TitleScene';
import { watchInputMode } from './inputMode';
import { ROOMS } from './data/rooms/index';
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
new TouchOverlay(game);

// ---------------------------------------------------------------- any window shape
// The view follows the window (rotation, split screen, iPad windows, desktop resizing). A new
// size is applied between dialogs, so no open menu is torn down.
let pendingView: ViewSize | null = null;

function applyView(): void {
  if (!pendingView || game.isPaused) return;
  const playing = game.scene.isActive('Game');
  if (playing && session.uiBlocking) return;
  setView(pendingView);
  pendingView = null;
  game.scale.setGameSize(VIEW_W * RENDER_SCALE, VIEW_H * RENDER_SCALE);
  for (const key of ['Title', 'End']) if (game.scene.isActive(key)) game.scene.getScene(key).scene.restart();
  if (playing) {
    (game.scene.getScene('Game') as GameScene).relayout();
    game.scene.getScene('HUD').scene.restart();
  }
}

// Portrait windows get a "turn sideways" screen, and the game waits behind it.
const rotate = document.createElement('div');
rotate.id = 'rotate';
rotate.innerHTML = '<div class="phone"></div><p>画面を横にしてください</p><small>横向きで遊ぶゲームです</small>';
document.body.appendChild(rotate);

function onWindowChange(): void {
  const portrait = window.innerHeight > window.innerWidth;
  rotate.classList.toggle('on', portrait);
  if (portrait && !game.isPaused) game.pause();
  if (!portrait && game.isPaused) game.resume();
  // The canvas fit is recomputed here too: resizes while paused are otherwise missed.
  game.scale.refresh();
  const v = viewFor(window.innerWidth, window.innerHeight);
  pendingView = v.w !== VIEW_W || v.h !== VIEW_H ? v : null;
  applyView();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onWindowChange, 150);
});
setInterval(applyView, 400);
game.events.once(Phaser.Core.Events.READY, onWindowChange);

// Handy for debugging and automated smoke tests.
Object.assign(window, { __game: game, __session: session, __rooms: ROOMS });
