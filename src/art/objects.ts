// Props, pickups and effects.
import { type Color, Px, rng, shade, strip, tint } from './pixels';

const OUT = '#140c18';

export function potPx(): Px {
  const p = new Px(14, 16);
  p.ellipse(7, 10, 5.5, 5, '#a8643a');
  p.ellipse(6, 9, 3.5, 3, '#c07a48');
  p.rect(4, 2, 6, 3, '#8a4e2a');
  p.rect(3, 1, 8, 2, '#c07a48');
  p.rect(4, 11, 7, 1, '#7a4222');
  p.px(4, 8, '#e0a070').px(4, 9, '#e0a070');
  p.outline(0, 0, 14, 16, OUT);
  return p;
}

export function grassStrip(): Px {
  return strip(
    16,
    12,
    2,
    (p, i) => {
      const blades = [
        [2, 7, -1],
        [5, 10, 0],
        [8, 8, 1],
        [11, 11, 0],
        [13, 7, 1],
      ];
      for (const [x, h, lean] of blades) {
        const sway = i === 1 ? lean + 1 : lean;
        p.line(x, 11, x + sway, 11 - h, '#3f9b4a', 2);
        p.px(x + sway, 11 - h, '#8fe07a');
      }
      p.rect(1, 10, 14, 2, '#2f7a3a');
    },
    OUT,
  );
}

export function chestStrip(): Px {
  // 0 closed, 1 open
  return strip(
    18,
    16,
    2,
    (p, i) => {
      const wood = '#a0662a';
      const dark = '#6a3e18';
      const gold = '#f2c14e';
      p.rect(1, 7, 16, 9, wood);
      p.rect(1, 12, 16, 1, dark);
      if (i === 0) {
        p.rect(1, 2, 16, 6, tint(wood, 0.1));
        p.rect(1, 2, 16, 1, tint(wood, 0.3));
        p.rect(1, 7, 16, 1, dark);
        p.rect(7, 6, 4, 4, gold);
        p.px(8, 8, dark).px(9, 8, dark);
      } else {
        p.rect(1, 0, 16, 4, shade(wood, 0.2));
        p.rect(2, 5, 14, 3, '#2a1608');
        p.rect(4, 5, 10, 1, gold);
      }
      p.rect(3, 2 + (i ? -2 : 0), 1, i ? 4 : 14, gold);
      p.rect(14, 2 + (i ? -2 : 0), 1, i ? 4 : 14, gold);
    },
    OUT,
  );
}

export function coinStrip(): Px {
  const widths = [3, 2, 1, 2];
  return strip(8, 8, 4, (p, i) => {
    const w = widths[i];
    p.ellipse(4, 4, w, 3, '#e8b830');
    p.ellipse(4, 4, Math.max(0, w - 1), 2, '#ffe070');
    if (w > 1) p.px(3, 3, '#fffbe0');
  });
}

export function heartPx(): Px {
  const p = new Px(9, 8);
  p.grid(0, 0, ['.aa...aa.', 'abba.abba', 'abbbbbbba', 'abbbbbbba', '.abbbbba.', '..abbba..', '...aba...', '....a....'], {
    a: '#7a1a2a',
    b: '#e8425a',
  });
  p.px(2, 2, '#ffb0c0');
  return p;
}

export function mpOrbPx(): Px {
  const p = new Px(8, 8);
  p.disc(3.5, 3.5, 3, '#2f6fd0');
  p.disc(3.5, 3.5, 2, '#6fb0ff');
  p.px(2, 2, '#e0f0ff');
  return p;
}

export function fountainStrip(): Px {
  return strip(28, 32, 4, (p, i) => {
    const stone = '#8a94a8';
    const dark = '#5a6278';
    // Basin.
    p.rect(2, 22, 24, 10, stone);
    p.rect(2, 22, 24, 2, tint(stone, 0.3));
    p.rect(2, 30, 24, 2, dark);
    p.rect(4, 24, 20, 3, '#5ac8f0');
    // Pillar and bowl.
    p.rect(11, 10, 6, 13, stone);
    p.rect(11, 10, 1, 13, dark);
    p.rect(7, 8, 14, 3, stone);
    p.rect(7, 8, 14, 1, tint(stone, 0.3));
    // Water arcs, animated.
    const r = rng(7 + i);
    for (let k = 0; k < 6; k++) {
      const x = 8 + k * 2.4;
      const y = 4 + ((k + i) % 4);
      p.px(x, y, '#bff0ff').px(x, y + 1, '#7ad8ff');
    }
    for (let k = 0; k < 5; k++) p.px(5 + r() * 18, 12 + r() * 10, '#9fe6ff');
    // The spring's glowing heart.
    p.disc(14, 5, 2.5 + (i % 2) * 0.5, '#e6fbff');
  }, OUT);
}

export function signPx(): Px {
  const p = new Px(16, 16);
  p.rect(7, 8, 2, 8, '#6a4a2a');
  p.rect(1, 2, 14, 8, '#b08050');
  p.rect(1, 2, 14, 1, '#d0a070');
  p.rect(1, 9, 14, 1, '#7a5030');
  p.rect(3, 4, 8, 1, '#5a3a1a').rect(3, 6, 10, 1, '#5a3a1a');
  p.outline(0, 0, 16, 16, OUT);
  return p;
}

/** Warp beacon: unlit and lit frames. */
export function beaconStrip(): Px {
  return strip(
    16,
    36,
    3,
    (p, i) => {
      const iron = '#4a4a5a';
      p.rect(7, 12, 3, 22, iron);
      p.rect(4, 32, 9, 4, shade(iron, 0.2));
      p.rect(4, 3, 9, 10, iron);
      p.rect(5, 4, 7, 8, i === 0 ? '#2a2a3a' : i === 1 ? '#ffe9a0' : '#fff6d0');
      p.rect(3, 1, 11, 3, shade(iron, 0.1));
      p.rect(7, 0, 3, 1, iron);
      if (i > 0) p.rect(7, 6, 3, 4, '#ffffff');
    },
    OUT,
  );
}

export function doorStrip(color: Color, frame: Color): Px {
  // 0 closed, 1 open (dark doorway)
  return strip(
    20,
    32,
    2,
    (p, i) => {
      p.rect(0, 0, 20, 32, frame);
      p.rect(2, 2, 16, 30, i ? '#0a0610' : color);
      if (!i) {
        p.rect(9, 2, 1, 30, shade(color, 0.3));
        p.rect(14, 16, 2, 2, '#e0b040');
        for (let y = 6; y < 30; y += 6) p.rect(2, y, 16, 1, shade(color, 0.2));
      }
    },
    OUT,
  );
}

export function keyPx(color = '#f2c14e'): Px {
  const p = new Px(12, 8);
  p.disc(3, 3.5, 2.5, color);
  p.px(3, 3, '#3a2a10').px(3, 4, '#3a2a10');
  p.rect(5, 3, 6, 2, color);
  p.rect(8, 5, 1, 2, color).rect(10, 5, 1, 2, color);
  p.outline(0, 0, 12, 8, OUT);
  return p;
}

/** Soft radial light used for glows and the lighting mask. */
export function lightCanvas(size: number, color = '#ffffff', core = 0.9): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, hexA(color, core));
  g.addColorStop(0.4, hexA(color, core * 0.45));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

function hexA(c: Color, a: number): string {
  const v = parseInt(c.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** Sword slash crescents: side, up, down. Drawn with smooth gradients for a bright arc. */
export function slashCanvas(kind: 'side' | 'up' | 'down' | 'thrust', color = '#ffffff'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const w = kind === 'side' ? 34 : kind === 'thrust' ? 36 : 30;
  const h = kind === 'side' ? 30 : kind === 'thrust' ? 12 : 34;
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (kind === 'thrust') {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, hexA(color, 0));
    g.addColorStop(0.7, hexA(color, 0.8));
    g.addColorStop(1, hexA(color, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 - 3);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h / 2 + 3);
    ctx.fill();
    return c;
  }
  if (kind !== 'side') {
    // Up/down slashes are the side crescent rotated a quarter turn.
    const side = slashCanvas('side', color);
    ctx.save();
    if (kind === 'up') {
      ctx.translate(0, h);
      ctx.rotate(-Math.PI / 2);
    } else {
      ctx.translate(w, 0);
      ctx.rotate(Math.PI / 2);
    }
    ctx.drawImage(side, 0, 0);
    ctx.restore();
    return c;
  }
  // Outer arc minus inner arc = crescent.
  ctx.beginPath();
  ctx.ellipse(2, h / 2, w - 3, h / 2 - 1, 0, -Math.PI / 2, Math.PI / 2);
  ctx.ellipse(-4, h / 2, w - 12, h / 2 - 5, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, hexA(color, 0.05));
  g.addColorStop(0.6, hexA(color, 0.7));
  g.addColorStop(1, hexA(color, 1));
  ctx.fillStyle = g;
  ctx.fill();
  return c;
}

export function projectilePx(kind: 'nut' | 'bolt' | 'feather' | 'fire' | 'rock' | 'dark' | 'bubble'): Px {
  const p = new Px(10, 10);
  switch (kind) {
    case 'nut':
      p.ellipse(5, 5, 3, 3.5, '#8a5a2a').px(4, 3, '#c89a5a').rect(4, 1, 2, 1, '#4a8a3a');
      break;
    case 'bolt':
      p.disc(4.5, 4.5, 4, '#ffd86a').disc(4.5, 4.5, 2.5, '#fff6c0').disc(4.5, 4.5, 1, '#ffffff');
      break;
    case 'feather':
      p.line(1, 5, 9, 5, '#d8e0f0', 2).px(9, 5, '#ffffff').line(1, 5, 3, 3, '#9aa8c8');
      break;
    case 'fire':
      p.disc(5, 5, 4, '#e8502a').disc(5, 5, 2.5, '#ffb040').disc(5, 5, 1, '#fff0a0');
      break;
    case 'rock':
      p.ellipse(5, 5, 4, 3.5, '#7a7066').ellipse(4, 4, 2, 1.5, '#a0968a');
      break;
    case 'dark':
      p.disc(5, 5, 4, '#2a1040').disc(5, 5, 2.5, '#6a2aa0').px(4, 4, '#e0c0ff');
      break;
    case 'bubble':
      p.disc(5, 5, 4, '#6ad0e8').disc(5, 5, 3, '#0e3040').px(3, 3, '#e0fbff').px(4, 3, '#e0fbff');
      break;
  }
  return p;
}

export function promptPx(): Px {
  const p = new Px(9, 7);
  p.poly(
    [
      [4.5, 0],
      [0, 5],
      [9, 5],
    ],
    '#ffffff',
  );
  p.rect(3, 5, 3, 2, '#ffffff');
  p.outline(0, 0, 9, 7, OUT);
  return p;
}
