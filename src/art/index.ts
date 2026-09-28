// Generates every texture and animation at boot.
import Phaser from 'phaser';
import { BG_THEMES, farPx, midPx, skyPx } from './backgrounds';
import { batStrip, bossWolfStrip, slimeStrip, wolfStrip } from './creatures';
import { registerChapterArt } from './enemies';
import { HUMAN_H, HUMAN_W, LOOKS, npcStrip, PLAYER_FRAMES, playerStrip } from './humanoid';
import {
  beaconStrip,
  chestStrip,
  coinStrip,
  doorStrip,
  fountainStrip,
  grassStrip,
  heartPx,
  keyPx,
  lightCanvas,
  mpOrbPx,
  potPx,
  projectilePx,
  promptPx,
  signPx,
  slashCanvas,
} from './objects';
import { addImage, addStrip, anim, Px } from './pixels';
import { flameStrip, PROPS } from './props';
import { TILE_STYLES, tileStrip } from './tiles';
import { iconsPx, ICON } from './icons';

export function generateArt(scene: Phaser.Scene): void {
  // Player and Nox share the rig and frame layout.
  for (const who of ['rio', 'nox'] as const) {
    addStrip(scene, who, playerStrip(LOOKS[who]), HUMAN_W, HUMAN_H);
    for (const [name, frames] of Object.entries(PLAYER_FRAMES)) {
      const rate = name === 'run' ? 12 : name === 'idle' ? 2.5 : 10;
      anim(scene, `${who}_${name}`, who, [...frames], rate, name === 'run' || name === 'idle' ? -1 : 0);
    }
  }

  for (const [name, look] of Object.entries(LOOKS)) {
    if (name === 'rio' || name === 'nox') continue;
    addStrip(scene, `npc_${name}`, npcStrip(look), HUMAN_W, HUMAN_H);
    anim(scene, `npc_${name}_idle`, `npc_${name}`, [0, 1], 2);
  }
  addStrip(scene, 'npc_garenLying', npcStrip(LOOKS.garen, true), HUMAN_W, HUMAN_H);
  anim(scene, 'npc_garenLying_idle', 'npc_garenLying', [0], 1);

  addStrip(scene, 'slime', slimeStrip(), 20, 16);
  anim(scene, 'slime_idle', 'slime', [0, 1], 3);
  anim(scene, 'slime_jump', 'slime', [2], 1, 0);
  anim(scene, 'slime_land', 'slime', [3, 0], 8, 0);
  addStrip(scene, 'bat', batStrip(), 22, 16);
  anim(scene, 'bat_fly', 'bat', [0, 1, 2, 1], 12);
  anim(scene, 'bat_hang', 'bat', [3], 1);
  addStrip(scene, 'wolf', wolfStrip(), 34, 22);
  addStrip(scene, 'boss_wolf', bossWolfStrip(), 64, 40);
  for (const k of ['wolf', 'boss_wolf']) {
    anim(scene, `${k}_run`, k, [0, 1, 2, 3], 12);
    anim(scene, `${k}_idle`, k, [4], 1);
    anim(scene, `${k}_pounce`, k, [5], 1);
    anim(scene, `${k}_crouch`, k, [6], 1);
    anim(scene, `${k}_howl`, k, [7], 1);
  }
  registerChapterArt(scene);

  addImage(scene, 'pot', potPx());
  addStrip(scene, 'grass', grassStrip(), 16, 12);
  anim(scene, 'grass_sway', 'grass', [0, 1], 1.5);
  addStrip(scene, 'chest', chestStrip(), 18, 16);
  addStrip(scene, 'coin', coinStrip(), 8, 8);
  anim(scene, 'coin_spin', 'coin', [0, 1, 2, 1], 10);
  addImage(scene, 'heart', heartPx());
  addImage(scene, 'mp_orb', mpOrbPx());
  addStrip(scene, 'fountain', fountainStrip(), 28, 32);
  anim(scene, 'fountain_flow', 'fountain', [0, 1, 2, 3], 6);
  addImage(scene, 'sign', signPx());
  addStrip(scene, 'beacon', beaconStrip(), 16, 36);
  anim(scene, 'beacon_lit', 'beacon', [1, 2], 3);
  addImage(scene, 'key', keyPx());
  addImage(scene, 'bosskey', keyPx('#e05a5a'));
  addImage(scene, 'prompt', promptPx());
  const doors: Record<string, [string, string]> = {
    house: ['#7a4a2a', '#5a3a1a'],
    cave: ['#1a1418', '#3a3040'],
    gate: ['#5a5a6a', '#3a3a4a'],
    shrine: ['#c8d0e8', '#8a90a4'],
    dark: ['#2a1a3a', '#140c1e'],
    locked: ['#6a4a2a', '#c8a040'],
    boss: ['#6a1a2a', '#c8a040'],
  };
  for (const [k, [c, f]] of Object.entries(doors)) addStrip(scene, `door_${k}`, doorStrip(c, f), 20, 32);

  for (const k of ['nut', 'bolt', 'feather', 'fire', 'rock', 'dark', 'bubble'] as const) addImage(scene, `p_${k}`, projectilePx(k));
  for (const k of ['side', 'up', 'down', 'thrust'] as const) {
    scene.textures.addCanvas(`slash_${k}`, slashCanvas(k));
    scene.textures.addCanvas(`slash_${k}_gold`, slashCanvas(k, '#ffe89a'));
  }

  scene.textures.addCanvas('light', lightCanvas(128));
  scene.textures.addCanvas('light_warm', lightCanvas(128, '#ffd890', 0.8));
  scene.textures.addCanvas('light_cool', lightCanvas(128, '#9fe6ff', 0.8));
  scene.textures.addCanvas('light_red', lightCanvas(128, '#ff6a3a', 0.8));
  scene.textures.addCanvas('light_violet', lightCanvas(128, '#b070ff', 0.8));
  const dot = new Px(3, 3);
  dot.rect(0, 0, 3, 3, '#ffffff');
  addImage(scene, 'particle', dot);
  const soft = new Px(2, 2);
  soft.rect(0, 0, 2, 2, '#ffffff');
  addImage(scene, 'dot', soft);

  for (const theme of Object.keys(TILE_STYLES)) addImage(scene, `tiles_${theme}`, tileStrip(theme));
  for (const [k, t] of Object.entries(BG_THEMES)) {
    addImage(scene, `bg_${k}_sky`, skyPx(t));
    addImage(scene, `bg_${k}_far`, farPx(t));
    addImage(scene, `bg_${k}_mid`, midPx(t));
  }
  for (const k of Object.keys(PROPS)) addImage(scene, `prop_${k}`, PROPS[k]());
  addStrip(scene, 'flame', flameStrip(), 12, 14);
  anim(scene, 'flame_burn', 'flame', [0, 1, 2, 3], 10);

  addStrip(scene, 'icons', iconsPx(), ICON, ICON);
}
