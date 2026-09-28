// Dev-only page (art.html) that shows every generated sprite enlarged.
import { BG_THEMES, farPx, midPx, skyPx } from './art/backgrounds';
import { previewStrips } from './art/enemies';
import { PROPS } from './art/props';
import { iconsPx } from './art/icons';
import { batStrip, bossWolfStrip, slimeStrip, wolfStrip } from './art/creatures';
import { LOOKS, npcStrip, playerStrip } from './art/humanoid';
import { beaconStrip, chestStrip, coinStrip, doorStrip, fountainStrip, grassStrip, heartPx, keyPx, mpOrbPx, potPx, projectilePx, signPx, slashCanvas } from './art/objects';
import { TILE_STYLES, tileStrip } from './art/tiles';

function show(title: string, canvas: HTMLCanvasElement, scale = 3, cls = ''): void {
  const h = document.createElement('h2');
  h.textContent = title;
  document.body.appendChild(h);
  const c = document.createElement('canvas');
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  if (cls) c.className = cls;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  document.body.appendChild(c);
}

const only = new URLSearchParams(location.search).get('only');
if (!only || only === 'chars') {
  show('rio', playerStrip(LOOKS.rio).canvas, 3);
  show('nox', playerStrip(LOOKS.nox).canvas, 3);
  for (const k of ['elder', 'boy', 'mina', 'kai', 'villager', 'villagerF', 'miner', 'merchant', 'smith', 'scholar', 'ghostGirl', 'knight', 'sentinel', 'hollowKnight', 'guard'] as const)
    show(k, npcStrip(LOOKS[k]).canvas, 3);
  show('garen lying', npcStrip(LOOKS.garen, true).canvas, 3);
}
if (!only || only === 'mobs') {
  show('slime', slimeStrip().canvas, 4);
  show('bat', batStrip().canvas, 4);
  show('wolf', wolfStrip().canvas, 4);
  show('boss wolf', bossWolfStrip().canvas, 3);
}
if (!only || only === 'objects') {
  for (const [k, px] of Object.entries({ pot: potPx(), grass: grassStrip(), chest: chestStrip(), coin: coinStrip(), heart: heartPx(), mp: mpOrbPx(), fountain: fountainStrip(), sign: signPx(), beacon: beaconStrip(), door: doorStrip('#7a4a2a', '#5a5a66'), key: keyPx() }))
    show(k, px.canvas, 4);
  for (const k of ['nut', 'bolt', 'feather', 'fire', 'rock', 'dark', 'bubble'] as const) show(k, projectilePx(k).canvas, 4);
  for (const k of ['side', 'up', 'down', 'thrust'] as const) show('slash ' + k, slashCanvas(k), 4);
}
if (!only || only === 'tiles') for (const k of Object.keys(TILE_STYLES)) show('tiles ' + k, tileStrip(k).canvas, 3);
if (!only || only === 'bg')
  for (const [k, t] of Object.entries(BG_THEMES)) {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 272;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(skyPx(t).canvas, 0, 0);
    ctx.drawImage(farPx(t).canvas, 0, 0);
    ctx.drawImage(midPx(t).canvas, 0, 0);
    show('bg ' + k, c, 1, 'bg');
  }
if (!only || only === 'enemies') for (const [k, px] of Object.entries(previewStrips())) show(k, px.canvas, 2);
if (!only || only === 'props') {
  for (const [k, fn] of Object.entries(PROPS)) show(k, fn().canvas, 2);
  show('icons', iconsPx().canvas, 4);
}
