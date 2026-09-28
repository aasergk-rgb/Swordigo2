// Decorative scenery. Each prop is anchored at its bottom centre.
import { type Color, Px, rng, shade, strip, tint } from './pixels';

const OUT = '#140c18';

type PropFn = () => Px;

function house(wall: Color, roof: Color, trim: Color): Px {
  const p = new Px(96, 80);
  // Walls with timber frame.
  p.rect(8, 34, 80, 46, wall);
  p.rect(8, 34, 80, 3, shade(wall, 0.2));
  for (const x of [8, 46, 84]) p.rect(x, 34, 4, 46, trim);
  p.rect(8, 56, 80, 3, trim);
  // Roof.
  p.poly(
    [
      [0, 38],
      [48, 4],
      [96, 38],
    ],
    roof,
  );
  p.poly(
    [
      [6, 38],
      [48, 10],
      [90, 38],
    ],
    tint(roof, 0.1),
  );
  for (let y = 14; y < 38; y += 5) p.rect(48 - (y - 4) * 1.35, y, (y - 4) * 2.7, 1, shade(roof, 0.25));
  p.rect(0, 36, 96, 3, shade(roof, 0.35));
  // Chimney.
  p.rect(66, 8, 8, 16, shade(wall, 0.3));
  p.rect(64, 6, 12, 3, shade(wall, 0.45));
  // Windows with warm light.
  for (const x of [18, 60]) {
    p.rect(x, 42, 14, 12, '#3a2a1a');
    p.rect(x + 1, 43, 12, 10, '#ffd67a');
    p.rect(x + 1, 43, 12, 3, '#fff0b0');
    p.rect(x + 6, 43, 2, 10, '#3a2a1a');
    p.rect(x - 1, 54, 16, 2, trim);
  }
  // Flower boxes.
  for (const x of [18, 60]) for (let k = 0; k < 6; k++) p.px(x + 1 + k * 2, 53, k % 2 ? '#e8425a' : '#f0d040');
  p.outline(0, 0, 96, 80, OUT);
  return p;
}

function tree(leaf: Color, trunk: Color, seed: number): Px {
  const p = new Px(64, 80);
  const r = rng(seed);
  p.rect(28, 40, 8, 40, trunk);
  p.rect(28, 40, 2, 40, shade(trunk, 0.3));
  p.line(32, 56, 20, 44, trunk, 3);
  p.line(33, 50, 46, 40, trunk, 3);
  const blobs = [
    [32, 26, 20],
    [18, 36, 13],
    [46, 34, 14],
    [26, 14, 12],
    [40, 16, 12],
  ];
  for (const [x, y, rad] of blobs) p.disc(x, y, rad, shade(leaf, 0.25));
  for (const [x, y, rad] of blobs) p.disc(x - 2, y - 2, rad - 3, leaf);
  for (const [x, y, rad] of blobs) p.disc(x - 5, y - 5, rad / 3, tint(leaf, 0.2));
  for (let k = 0; k < 30; k++) p.px(8 + r() * 48, 4 + r() * 44, r() < 0.5 ? tint(leaf, 0.3) : shade(leaf, 0.35));
  p.outline(0, 0, 64, 80, OUT);
  return p;
}

function pine(leaf: Color, seed: number): Px {
  const p = new Px(40, 88);
  const r = rng(seed);
  p.rect(18, 70, 5, 18, '#4a2e1a');
  for (let k = 0; k < 5; k++) {
    const y = 4 + k * 14;
    const w = 8 + k * 4;
    p.poly(
      [
        [20 - w, y + 20],
        [20, y],
        [20 + w, y + 20],
      ],
      shade(leaf, 0.2),
    );
    p.poly(
      [
        [20 - w + 2, y + 18],
        [20, y + 2],
        [20 + w - 6, y + 18],
      ],
      leaf,
    );
    p.px(20 - w + 4 + r() * w, y + 14, tint(leaf, 0.3));
  }
  p.outline(0, 0, 40, 88, OUT);
  return p;
}

function simple(w: number, h: number, draw: (p: Px) => void, outline = true): PropFn {
  return () => {
    const p = new Px(w, h);
    draw(p);
    if (outline) p.outline(0, 0, w, h, OUT);
    return p;
  };
}

export const PROPS: Record<string, PropFn> = {
  house: () => house('#d8c8a0', '#a8483a', '#6a4a2a'),
  houseBlue: () => house('#c8c8d0', '#3a5a9a', '#4a3a2a'),
  houseStone: () => house('#8a8494', '#5a4a6a', '#4a4050'),
  houseDark: () => house('#3a3a4a', '#1e1e2e', '#2a2a36'),
  tree: () => tree('#4c9a4a', '#6a4028', 11),
  treeDark: () => tree('#1e5a44', '#3a2618', 12),
  treeAutumn: () => tree('#c8803a', '#6a4028', 13),
  pine: () => pine('#2f6a4a', 21),
  pineDark: () => pine('#173e34', 22),
  bush: simple(28, 16, (p) => {
    p.ellipse(8, 10, 8, 6, '#2f7a3a').ellipse(19, 9, 9, 7, '#3f9b4a').ellipse(14, 6, 6, 5, '#5ab85a');
    p.px(10, 5, '#f0d040').px(20, 7, '#e8425a');
  }),
  fence: simple(48, 16, (p) => {
    for (const x of [2, 18, 34]) p.rect(x, 2, 4, 14, '#9a6a3a').rect(x, 2, 4, 1, '#c89a5a');
    p.rect(0, 5, 48, 3, '#8a5a2a').rect(0, 11, 48, 3, '#8a5a2a');
  }),
  lamp: simple(12, 40, (p) => {
    p.rect(5, 10, 2, 30, '#3a3a4a');
    p.rect(2, 2, 8, 9, '#3a3a4a').rect(3, 3, 6, 7, '#ffe08a').rect(4, 4, 4, 3, '#fff8d0');
    p.rect(1, 1, 10, 2, '#2a2a36');
  }),
  well: simple(40, 40, (p) => {
    p.rect(4, 22, 32, 18, '#8a8494').rect(4, 22, 32, 3, '#aaa4b4');
    for (let x = 6; x < 36; x += 8) p.rect(x, 26, 1, 14, '#6a6474');
    p.rect(6, 2, 3, 22, '#6a4a2a').rect(31, 2, 3, 22, '#6a4a2a');
    p.poly(
      [
        [0, 6],
        [20, -4],
        [40, 6],
      ],
      '#a8483a',
    );
    p.rect(18, 6, 2, 12, '#b0b0b0').rect(16, 16, 6, 5, '#7a5a3a');
  }),
  rock: simple(24, 14, (p) => {
    p.ellipse(12, 9, 11, 6, '#6a6a76').ellipse(10, 7, 7, 4, '#8a8a96').px(7, 5, '#aaaab4');
  }),
  crystal: simple(16, 24, (p) => {
    p.poly(
      [
        [8, 0],
        [14, 10],
        [11, 24],
        [5, 24],
        [2, 10],
      ],
      '#4ad0e0',
    );
    p.poly(
      [
        [8, 0],
        [8, 24],
        [5, 24],
        [2, 10],
      ],
      '#9af0ff',
    );
    p.px(6, 6, '#ffffff');
  }),
  crystalPink: simple(16, 24, (p) => {
    p.poly(
      [
        [8, 0],
        [14, 10],
        [11, 24],
        [5, 24],
        [2, 10],
      ],
      '#d060c0',
    );
    p.poly(
      [
        [8, 0],
        [8, 24],
        [5, 24],
        [2, 10],
      ],
      '#f0a0e8',
    );
  }),
  beam: simple(40, 64, (p) => {
    p.rect(2, 0, 6, 64, '#7a5430').rect(32, 0, 6, 64, '#7a5430');
    p.rect(0, 0, 40, 7, '#8a6038').rect(0, 6, 40, 1, '#4a3018');
    p.line(8, 7, 16, 15, '#7a5430', 3).line(32, 7, 24, 15, '#7a5430', 3);
    p.rect(2, 0, 1, 64, '#9a7448').rect(32, 0, 1, 64, '#9a7448');
  }),
  minecart: simple(32, 22, (p) => {
    p.poly(
      [
        [0, 2],
        [32, 2],
        [28, 16],
        [4, 16],
      ],
      '#6a6a76',
    );
    p.rect(0, 2, 32, 2, '#8a8a96');
    p.disc(9, 18, 3.5, '#2a2a30').disc(23, 18, 3.5, '#2a2a30');
    p.rect(4, 0, 24, 3, '#d8b040').px(8, 0, '#f0d070').px(18, 1, '#a0a0a8');
  }),
  rails: simple(48, 6, (p) => {
    p.rect(0, 0, 48, 2, '#8a8a96');
    for (let x = 2; x < 48; x += 8) p.rect(x, 2, 5, 4, '#6a4a2a');
  }),
  torch: simple(12, 22, (p) => {
    p.rect(5, 8, 3, 14, '#6a4a2a');
    p.ellipse(6, 5, 3.5, 5, '#e8602a').ellipse(6, 6, 2, 3, '#ffc040').px(6, 6, '#fff4c0');
  }),
  statue: simple(32, 56, (p) => {
    p.rect(4, 44, 24, 12, '#8a8a96').rect(4, 44, 24, 2, '#aaaab4');
    p.rect(11, 20, 10, 24, '#9a9aa8');
    p.disc(16, 14, 6, '#9a9aa8');
    p.line(21, 24, 27, 4, '#b0b0bc', 2);
    p.rect(11, 20, 2, 24, '#7a7a88');
  }),
  pillar: simple(24, 96, (p) => {
    p.rect(4, 8, 16, 80, '#d8dce8');
    for (let x = 7; x < 20; x += 4) p.rect(x, 8, 1, 80, '#b0b6c6');
    p.rect(0, 0, 24, 8, '#eef0f8').rect(0, 88, 24, 8, '#eef0f8');
    p.rect(0, 7, 24, 1, '#a0a6b6');
  }),
  brokenPillar: simple(24, 48, (p) => {
    p.rect(4, 8, 16, 32, '#8ab0b0');
    for (let x = 7; x < 20; x += 4) p.rect(x, 8, 1, 32, '#6a9090');
    p.poly(
      [
        [4, 8],
        [10, 2],
        [14, 6],
        [20, 0],
        [20, 8],
      ],
      '#8ab0b0',
    );
    p.rect(0, 40, 24, 8, '#9ac0c0');
  }),
  banner: simple(20, 40, (p) => {
    p.rect(0, 0, 20, 3, '#6a4a2a');
    p.poly(
      [
        [2, 3],
        [18, 3],
        [18, 36],
        [10, 30],
        [2, 36],
      ],
      '#3a5a9a',
    );
    p.disc(10, 14, 4, '#f0c040');
  }),
  barrel: simple(16, 20, (p) => {
    p.ellipse(8, 10, 7, 10, '#8a5a2a').rect(1, 4, 14, 2, '#5a5a66').rect(1, 14, 14, 2, '#5a5a66').rect(4, 1, 8, 1, '#a07a4a');
  }),
  crate: simple(18, 18, (p) => {
    p.rect(0, 0, 18, 18, '#a07a3a').rect(0, 0, 18, 2, '#c09a5a');
    p.line(1, 1, 17, 17, '#6a4a1a', 2).rect(0, 16, 18, 2, '#6a4a1a');
  }),
  anvil: simple(28, 18, (p) => {
    p.rect(2, 0, 24, 6, '#4a4a56').rect(0, 0, 8, 3, '#4a4a56').rect(9, 6, 10, 6, '#3a3a46').rect(5, 12, 18, 6, '#4a4a56');
    p.rect(2, 0, 24, 1, '#7a7a86');
  }),
  bookshelf: simple(32, 40, (p) => {
    p.rect(0, 0, 32, 40, '#6a4a2a');
    for (let y = 3; y < 40; y += 12) {
      p.rect(2, y, 28, 9, '#2a1a0a');
      for (let x = 3; x < 29; x += 3) p.rect(x, y + 2 + (x % 2), 2, 7 - (x % 2), ['#a83a3a', '#3a6a9a', '#4a8a4a', '#c8a040'][x % 4]);
    }
  }),
  coral: simple(24, 24, (p) => {
    p.line(12, 24, 12, 8, '#e0706a', 3).line(12, 16, 5, 6, '#e0706a', 2).line(12, 13, 19, 3, '#e0706a', 2);
    p.disc(5, 6, 2, '#ff9a8a').disc(19, 3, 2, '#ff9a8a').disc(12, 7, 2, '#ff9a8a');
  }),
  seaweed: simple(12, 32, (p) => {
    for (let y = 0; y < 32; y += 2) p.rect(5 + Math.sin(y / 4) * 3, y, 3, 3, y < 4 ? '#6ad0a0' : '#2f9a70');
  }),
  mushroom: simple(12, 10, (p) => {
    p.rect(5, 5, 2, 5, '#e8dcc8');
    p.ellipse(6, 4, 5, 3, '#c83a4a').px(4, 3, '#ffffff').px(8, 2, '#ffffff');
  }),
  glowShroom: simple(12, 12, (p) => {
    p.rect(5, 6, 2, 6, '#b8e8e0');
    p.ellipse(6, 5, 5, 3, '#40d0c0').px(4, 4, '#e0fffa').px(8, 3, '#e0fffa');
  }),
  flowers: simple(24, 8, (p) => {
    const cols = ['#f0d040', '#e8425a', '#ffffff', '#b070e0'];
    for (let x = 1; x < 24; x += 4) {
      p.rect(x + 1, 3, 1, 5, '#3a8a3a');
      p.px(x + 1, 2, cols[x % 4]).px(x, 3, cols[x % 4]).px(x + 2, 3, cols[x % 4]);
    }
  }, false),
  stall: simple(56, 48, (p) => {
    p.rect(4, 14, 3, 34, '#6a4a2a').rect(49, 14, 3, 34, '#6a4a2a');
    for (let x = 0; x < 56; x += 8) p.rect(x, 4, 8, 12, x % 16 ? '#f0f0e0' : '#c83a3a');
    p.rect(0, 16, 56, 2, '#8a2a2a');
    p.rect(2, 32, 52, 16, '#8a6a3a').rect(2, 32, 52, 2, '#a88a5a');
    for (let x = 6; x < 50; x += 7) p.disc(x, 30, 2.5, ['#e8425a', '#f0d040', '#6ab04a'][x % 3]);
  }),
  windmill: simple(64, 96, (p) => {
    p.poly(
      [
        [20, 96],
        [26, 36],
        [38, 36],
        [44, 96],
      ],
      '#d8c8a0',
    );
    p.poly(
      [
        [22, 40],
        [32, 26],
        [42, 40],
      ],
      '#a8483a',
    );
    p.rect(28, 76, 8, 20, '#6a4a2a');
    for (let a = 0; a < 4; a++) {
      const ang = a * (Math.PI / 2) + 0.5;
      p.line(32, 34, 32 + Math.cos(ang) * 30, 34 + Math.sin(ang) * 30, '#8a6a4a', 2);
      p.line(32 + Math.cos(ang) * 8, 34 + Math.sin(ang) * 8, 32 + Math.cos(ang + 0.25) * 28, 34 + Math.sin(ang + 0.25) * 28, '#f0ecd8', 4);
    }
    p.disc(32, 34, 3, '#4a3a2a');
  }),
  tent: simple(48, 32, (p) => {
    p.poly(
      [
        [0, 32],
        [24, 0],
        [48, 32],
      ],
      '#8a6a4a',
    );
    p.poly(
      [
        [18, 32],
        [24, 14],
        [30, 32],
      ],
      '#2a1a0a',
    );
  }),
  grave: simple(16, 20, (p) => {
    p.rect(2, 4, 12, 16, '#7a7a86').disc(8, 5, 6, '#7a7a86').rect(7, 6, 2, 8, '#5a5a66').rect(4, 8, 8, 2, '#5a5a66');
  }),
  sheep: simple(22, 16, (p) => {
    p.rect(4, 10, 2, 6, '#3a3a3a').rect(15, 10, 2, 6, '#3a3a3a');
    p.ellipse(10, 8, 9, 6, '#f4f0e6').ellipse(8, 6, 5, 3, '#ffffff');
    p.ellipse(19, 6, 3, 3, '#3a3a3a').px(20, 5, '#ffffff');
  }),
  bell: simple(16, 20, (p) => {
    p.rect(7, 0, 2, 4, '#6a4a2a');
    p.poly(
      [
        [3, 16],
        [5, 5],
        [11, 5],
        [13, 16],
      ],
      '#d8a840',
    );
    p.rect(2, 15, 12, 2, '#b88a20').disc(8, 18, 1.5, '#8a6a20').px(6, 7, '#fff0a0');
  }),
  lever: simple(16, 16, (p) => {
    p.rect(2, 12, 12, 4, '#5a5a66');
    p.line(8, 12, 12, 2, '#8a6a3a', 2);
    p.disc(12, 2, 2, '#c83a3a');
  }),
  leverOn: simple(16, 16, (p) => {
    p.rect(2, 12, 12, 4, '#5a5a66');
    p.line(8, 12, 4, 2, '#8a6a3a', 2);
    p.disc(4, 2, 2, '#4ac04a');
  }),
  tablet: simple(16, 20, (p) => {
    p.rect(1, 2, 14, 18, '#8aa0a0').rect(1, 2, 14, 2, '#aac0c0');
    for (let y = 6; y < 18; y += 3) p.rect(3, y, 10, 1, '#4a6a6a');
  }),
  musicBox: simple(14, 12, (p) => {
    p.rect(1, 4, 12, 8, '#a0662a').rect(1, 4, 12, 2, '#c8884a').rect(5, 7, 4, 2, '#f2c14e');
    p.poly(
      [
        [1, 4],
        [4, 0],
        [13, 0],
        [13, 4],
      ],
      '#8a5020',
    );
  }),
  fireSpirit: simple(14, 16, (p) => {
    p.ellipse(7, 10, 5, 6, '#e8602a').ellipse(7, 11, 3, 4, '#ffc040');
    p.poly(
      [
        [3, 8],
        [7, 0],
        [11, 8],
      ],
      '#e8602a',
    );
    p.px(5, 10, '#2a1a0a').px(9, 10, '#2a1a0a');
  }),
  scale: simple(14, 14, (p) => {
    p.poly(
      [
        [7, 0],
        [14, 7],
        [7, 14],
        [0, 7],
      ],
      '#c83a2a',
    );
    p.poly(
      [
        [7, 2],
        [11, 7],
        [7, 12],
      ],
      '#ff7a4a',
    );
  }),
  iron: simple(14, 10, (p) => {
    p.poly(
      [
        [0, 10],
        [3, 2],
        [10, 0],
        [14, 10],
      ],
      '#3a3448',
    );
    p.px(6, 4, '#8a7aa8').px(9, 6, '#6a5a88');
  }),
  forgeFire: simple(40, 32, (p) => {
    p.rect(0, 12, 40, 20, '#4a3a3a').rect(0, 12, 40, 3, '#6a5a5a');
    p.ellipse(20, 12, 14, 8, '#e8502a').ellipse(20, 12, 8, 5, '#ffb040').ellipse(20, 11, 4, 2, '#fff0a0');
  }),
  bigCrystal: simple(40, 64, (p) => {
    p.poly(
      [
        [20, 0],
        [36, 24],
        [30, 64],
        [10, 64],
        [4, 24],
      ],
      '#f0e8a0',
    );
    p.poly(
      [
        [20, 0],
        [20, 64],
        [10, 64],
        [4, 24],
      ],
      '#fffbe0',
    );
  }),
  chain: simple(6, 64, (p) => {
    for (let y = 0; y < 64; y += 6) p.rect(1, y, 4, 5, '#4a4a56').rect(2, y + 1, 2, 3, '#1a1a22');
  }, false),
  throne: simple(40, 56, (p) => {
    p.rect(6, 0, 28, 40, '#6a2a4a').rect(10, 4, 20, 32, '#8a3a6a');
    p.rect(0, 36, 40, 8, '#c8a040').rect(4, 44, 6, 12, '#c8a040').rect(30, 44, 6, 12, '#c8a040');
    p.disc(20, 4, 4, '#f0d060');
  }),
};

export function propStrip(kind: string): Px | null {
  const fn = PROPS[kind];
  return fn ? fn() : null;
}

/** Flickering torch flames and swaying seaweed get their own animated strips. */
export function flameStrip(): Px {
  return strip(12, 14, 4, (p, i) => {
    const h = [6, 7, 5, 6][i];
    p.ellipse(6, 13 - h, 3.5, h, '#e8602a');
    p.ellipse(6 + (i % 2 ? 1 : -1) * 0.5, 13 - h * 0.7, 2, h * 0.6, '#ffc040');
    p.px(6, 12 - h * 0.4, '#fff4c0');
  });
}
