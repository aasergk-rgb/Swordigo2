// Autotiled terrain. Each theme gets one strip of 24 tiles:
//   0-15  solid ground, index = open-neighbour mask (1 up, 2 right, 4 down, 8 left)
//   16 one-way platform   17 spikes   18 crumbling block   19 bomb wall
//   20 light grid         21 gate     22 water body        23 lava body
import { type Color, Px, rng, shade, tint } from './pixels';

export const TILE_PX = 16;

export const T = {
  platform: 16,
  spikes: 17,
  crumble: 18,
  bombWall: 19,
  grid: 20,
  gate: 21,
  water: 22,
  lava: 23,
} as const;

export interface TileStyle {
  base: Color;
  dark: Color;
  light: Color;
  speck: Color;
  surface: Color | null; // grass / moss colour on top faces
  surfaceLight?: Color;
  texture: 'dirt' | 'brick' | 'rock' | 'marble' | 'basalt' | 'wood';
  plank: Color;
  seed: number;
}

export const TILE_STYLES: Record<string, TileStyle> = {
  forest: { base: '#5a3d2b', dark: '#3a2618', light: '#7a5a3e', speck: '#4a3020', surface: '#4caf50', surfaceLight: '#8fe07a', texture: 'dirt', plank: '#9c6b3c', seed: 1 },
  village: { base: '#6a4a30', dark: '#442e1c', light: '#8a6a48', speck: '#5a3c24', surface: '#6cbf4a', surfaceLight: '#b0f080', texture: 'dirt', plank: '#a8743e', seed: 2 },
  road: { base: '#7a5a3a', dark: '#4e3822', light: '#9a7a52', speck: '#6a4a2c', surface: '#8ab04a', surfaceLight: '#c8e080', texture: 'dirt', plank: '#a8743e', seed: 3 },
  mine: { base: '#5a5a66', dark: '#383844', light: '#7a7a88', speck: '#4a4a56', surface: null, texture: 'rock', plank: '#8a6a3a', seed: 4 },
  dorm: { base: '#6a6070', dark: '#433c4a', light: '#8a8090', speck: '#5a5060', surface: '#7a9a5a', surfaceLight: '#aac880', texture: 'brick', plank: '#8a5a32', seed: 5 },
  plateau: { base: '#8a7a5a', dark: '#5a4e38', light: '#aa9a78', speck: '#7a6a4a', surface: '#7ad060', surfaceLight: '#c0f090', texture: 'rock', plank: '#b08050', seed: 6 },
  shrine: { base: '#c8ccd8', dark: '#8a90a4', light: '#eef0f8', speck: '#b0b6c6', surface: null, texture: 'marble', plank: '#d8c89a', seed: 7 },
  lake: { base: '#34505a', dark: '#1e343c', light: '#4a7078', speck: '#2a444c', surface: '#3ab0a0', surfaceLight: '#8af0d8', texture: 'rock', plank: '#6a5a4a', seed: 8 },
  aqualia: { base: '#3a6a74', dark: '#224650', light: '#5a8e96', speck: '#2e5a64', surface: '#4ac0a0', surfaceLight: '#9af0d0', texture: 'brick', plank: '#7a9a9a', seed: 9 },
  forge: { base: '#3a2a2a', dark: '#1e1414', light: '#5a3e38', speck: '#e05a2a', surface: null, texture: 'basalt', plank: '#5a4a4a', seed: 10 },
  capital: { base: '#7a7a86', dark: '#4e4e5a', light: '#9a9aa8', speck: '#6a6a76', surface: null, texture: 'brick', plank: '#8a6a4a', seed: 11 },
  tower: { base: '#2a2a2e', dark: '#141416', light: '#4a4a52', speck: '#3a3a44', surface: null, texture: 'marble', plank: '#5a5a62', seed: 12 },
};

function textureFill(p: Px, st: TileStyle, x0: number, seed: number): void {
  const r = rng(seed);
  p.rect(x0, 0, 16, 16, st.base);
  switch (st.texture) {
    case 'dirt':
      for (let k = 0; k < 7; k++) p.rect(x0 + Math.floor(r() * 14), Math.floor(r() * 14), 2, 1, st.speck);
      for (let k = 0; k < 3; k++) p.px(x0 + Math.floor(r() * 16), Math.floor(r() * 16), st.light);
      break;
    case 'rock': {
      for (let k = 0; k < 3; k++) {
        const cx = x0 + 2 + Math.floor(r() * 12);
        const cy = 2 + Math.floor(r() * 12);
        p.rect(cx - 2, cy - 1, 4, 3, st.light);
        p.rect(cx - 2, cy + 2, 4, 1, st.dark);
      }
      for (let k = 0; k < 5; k++) p.px(x0 + Math.floor(r() * 16), Math.floor(r() * 16), st.speck);
      break;
    }
    case 'brick':
      for (let row = 0; row < 4; row++) {
        p.rect(x0, row * 4 + 3, 16, 1, st.dark);
        const off = row % 2 ? 4 : 0;
        for (let c = off; c < 16; c += 8) p.rect(x0 + c, row * 4, 1, 3, st.dark);
        p.rect(x0, row * 4, 16, 1, tint(st.base, 0.08));
      }
      for (let k = 0; k < 3; k++) p.px(x0 + Math.floor(r() * 16), Math.floor(r() * 16), st.speck);
      break;
    case 'marble':
      p.rect(x0, 15, 16, 1, st.dark);
      p.rect(x0 + 15, 0, 1, 16, st.dark);
      p.line(x0 + 2 + r() * 4, 2, x0 + 8 + r() * 6, 12, st.speck);
      break;
    case 'basalt':
      for (let k = 0; k < 4; k++) {
        const x = x0 + Math.floor(r() * 14);
        const y = Math.floor(r() * 14);
        p.line(x, y, x + 2, y + 2, st.dark);
      }
      if (r() < 0.5) p.line(x0 + 3, 12, x0 + 8, 9, st.speck);
      break;
    case 'wood':
      for (let y = 0; y < 16; y += 4) p.rect(x0, y + 3, 16, 1, st.dark);
      break;
  }
}

export function tileStrip(themeName: string): Px {
  const st = TILE_STYLES[themeName] ?? TILE_STYLES.forest;
  const p = new Px(16 * 24, 16);
  for (let mask = 0; mask < 16; mask++) {
    const x0 = mask * 16;
    textureFill(p, st, x0, st.seed * 100 + mask);
    const openUp = mask & 1;
    const openRight = mask & 2;
    const openDown = mask & 4;
    const openLeft = mask & 8;
    if (openLeft) {
      p.rect(x0, 0, 1, 16, st.dark);
      p.rect(x0 + 1, 0, 1, 16, st.light);
    }
    if (openRight) {
      p.rect(x0 + 15, 0, 1, 16, st.dark);
      p.rect(x0 + 14, 0, 1, 16, shade(st.base, 0.15));
    }
    if (openDown) {
      p.rect(x0, 15, 16, 1, st.dark);
      p.rect(x0, 14, 16, 1, shade(st.base, 0.2));
    }
    if (openUp) {
      if (st.surface) {
        const r = rng(st.seed * 7 + mask);
        p.rect(x0, 0, 16, 4, st.surface);
        p.rect(x0, 0, 16, 1, st.surfaceLight ?? tint(st.surface, 0.3));
        // Ragged lower edge of the grass.
        for (let x = 0; x < 16; x++) if (r() < 0.55) p.px(x0 + x, 4, shade(st.surface, 0.25));
        for (let x = 0; x < 16; x += 3) if (r() < 0.5) p.px(x0 + x, 5, shade(st.surface, 0.35));
        if (openLeft) p.rect(x0, 0, 2, 6, st.surface);
        if (openRight) p.rect(x0 + 14, 0, 2, 6, st.surface);
      } else {
        p.rect(x0, 0, 16, 2, st.light);
        p.rect(x0, 0, 16, 1, tint(st.light, 0.3));
      }
    }
  }

  // 16 one-way platform.
  let x0 = T.platform * 16;
  p.rect(x0, 0, 16, 5, st.plank);
  p.rect(x0, 0, 16, 1, tint(st.plank, 0.3));
  p.rect(x0, 4, 16, 1, shade(st.plank, 0.35));
  p.rect(x0 + 7, 1, 1, 3, shade(st.plank, 0.25));
  p.rect(x0 + 2, 5, 2, 2, shade(st.plank, 0.4));
  p.rect(x0 + 12, 5, 2, 2, shade(st.plank, 0.4));

  // 17 spikes.
  x0 = T.spikes * 16;
  for (let i = 0; i < 4; i++) {
    p.poly(
      [
        [x0 + i * 4, 16],
        [x0 + i * 4 + 2, 6],
        [x0 + i * 4 + 4, 16],
      ],
      '#b8bcc8',
    );
    p.line(x0 + i * 4 + 2, 7, x0 + i * 4 + 2, 15, '#eef0f8');
  }

  // 18 crumbling block.
  x0 = T.crumble * 16;
  textureFill(p, st, x0, 999);
  p.line(x0 + 3, 0, x0 + 7, 8, st.dark).line(x0 + 7, 8, x0 + 5, 16, st.dark).line(x0 + 7, 8, x0 + 13, 5, st.dark);
  p.rect(x0, 0, 16, 1, st.light);

  // 19 bomb wall: cracked, lighter blocks.
  x0 = T.bombWall * 16;
  p.rect(x0, 0, 16, 16, tint(st.base, 0.1));
  p.rect(x0, 0, 8, 8, st.light).rect(x0 + 8, 8, 8, 8, st.light);
  p.line(x0 + 2, 2, x0 + 13, 13, st.dark).line(x0 + 13, 2, x0 + 3, 14, st.dark).line(x0 + 8, 0, x0 + 8, 16, st.dark);

  // 20 light grid.
  x0 = T.grid * 16;
  for (let i = 1; i < 16; i += 5) {
    p.rect(x0 + i, 0, 2, 16, '#ffe98a');
    p.rect(x0, i, 16, 1, '#ffd24a');
  }

  // 21 gate (iron bars).
  x0 = T.gate * 16;
  for (let i = 1; i < 16; i += 5) p.rect(x0 + i, 0, 3, 16, '#6a6a7a').rect(x0 + i, 0, 1, 16, '#9a9aaa');
  p.rect(x0, 2, 16, 2, '#4a4a5a').rect(x0, 12, 16, 2, '#4a4a5a');

  // 22 water body (translucent drawn separately; tile kept for completeness).
  p.rect(T.water * 16, 0, 16, 16, '#2a7ab0');
  // 23 lava.
  x0 = T.lava * 16;
  p.rect(x0, 0, 16, 16, '#d8401a');
  p.rect(x0, 0, 16, 3, '#ffb040');
  p.px(x0 + 4, 7, '#ff8030').px(x0 + 11, 11, '#ff8030');
  return p;
}
