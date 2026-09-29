// Pixel art for the on-screen touch controls: indigo stone set in a gold rim, lit up like a
// lantern while pressed. Drawn small on a plain canvas and scaled up with crisp pixels.

type Rgb = [number, number, number];

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const OUTLINE = hex('#120a20');
const RIM = { light: hex('#ffe08a'), mid: hex('#c9a44a'), dark: hex('#7a5a20') };
const INNER_LINE = hex('#2a1a10');
const STONE = { top: hex('#3e3072'), bottom: hex('#1a1234'), shine: hex('#56469a') };
const LIT = { core: hex('#fff3a0'), mid: hex('#ffc850'), edge: hex('#b0702a') };

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
/** Picks a or b with ordered dithering, so blends stay in pixel-art colours. */
const dither = (a: Rgb, b: Rgb, t: number, x: number, y: number): Rgb => (t * 16 > BAYER[y & 3][x & 3] + 0.5 ? b : a);

/**
 * Paints a shape given `inside(x, y)`: the distance of a pixel from the shape's edge
 * (negative outside). Rim lighting comes from the top left.
 */
function paint(w: number, h: number, inside: (x: number, y: number) => number, lit: boolean, fillOnly?: (x: number, y: number) => boolean): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const put = (x: number, y: number, [r, g, b]: Rgb, a = 255) => {
    const i = (y * w + x) * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = inside(x + 0.5, y + 0.5);
      if (e <= 0) continue;
      const nx = (x + 0.5) / w - 0.5;
      const ny = (y + 0.5) / h - 0.5;
      if (fillOnly) {
        if (e > 4 && fillOnly(x, y)) put(x, y, litColour(nx, ny, x, y));
        continue;
      }
      if (e <= 1) put(x, y, OUTLINE);
      else if (e <= 3) {
        const l = -(nx + ny) / (Math.hypot(nx, ny) * 1.414 || 1);
        put(x, y, l > 0.35 ? RIM.light : l < -0.35 ? RIM.dark : RIM.mid);
      } else if (e <= 4) put(x, y, INNER_LINE);
      else if (lit) put(x, y, litColour(nx, ny, x, y));
      else {
        let col = dither(STONE.top, STONE.bottom, ny + 0.5, x, y);
        // A soft shine along the upper-left inside of the rim.
        if (e <= 6 && -(nx + ny) > 0.25) col = STONE.shine;
        put(x, y, col, 235);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function litColour(nx: number, ny: number, x: number, y: number): Rgb {
  const d = Math.min(1, Math.hypot(nx, ny) * 2);
  return d < 0.45 ? dither(LIT.core, LIT.mid, d / 0.45, x, y) : dither(LIT.mid, LIT.edge, (d - 0.45) / 0.55, x, y);
}

const cache = new Map<string, string>();
const memo = (key: string, make: () => string) => {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = make()));
  return v;
};

/** Round button face, 32×32. */
export const medallion = (lit: boolean) =>
  memo(`med${lit}`, () => paint(32, 32, (x, y) => 16 - Math.hypot(x - 16, y - 16), lit));

/** Rounded stone plate; `ends` says which ends are fully rounded. */
export function plate(w: number, h: number, lit: boolean, ends: 'both' | 'left' | 'right' = 'both'): string {
  return memo(`plate${w}x${h}${lit}${ends}`, () => {
    const r = h / 2;
    const rl = ends === 'right' ? 4 : r;
    const rr = ends === 'left' ? 4 : r;
    return paint(
      w,
      h,
      (x, y) => {
        const rad = x < w / 2 ? rl : rr;
        const cx = Math.min(Math.max(x, rad), w - rad);
        const cy = Math.min(Math.max(y, rad), h - rad);
        return rad - Math.hypot(x - cx, y - cy);
      },
      lit,
    );
  });
}

/** Cross-shaped D-pad, 48×48; `arm` lights one arm (drawn as an overlay without the rim). */
export function cross(arm?: 'left' | 'right' | 'up' | 'down'): string {
  return memo(`cross${arm ?? ''}`, () => {
    const S = 48;
    const a0 = 15;
    const a1 = 33;
    const rect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => Math.min(x - x0, x1 - x, y - y0, y1 - y);
    const inside = (x: number, y: number) => Math.max(rect(x, y, 0, a0, S, a1), rect(x, y, a0, 0, a1, S));
    if (!arm) return paint(S, S, inside, false);
    const inArm = (x: number, y: number) =>
      arm === 'left' ? x < a0 + 1 : arm === 'right' ? x > a1 - 2 : arm === 'up' ? y < a0 + 1 : y > a1 - 2;
    return paint(S, S, inside, true, inArm);
  });
}

// Small gold glyphs with a dark outline, from bitmaps ('#' = pixel).
const GLYPHS: Record<string, string[]> = {
  left: ['...#', '..##', '.###', '####', '.###', '..##', '...#'],
  right: ['#...', '##..', '###.', '####', '###.', '##..', '#...'],
  up: ['...#...', '..###..', '.#####.', '#######'],
  down: ['#######', '.#####.', '..###..', '...#...'],
  jump: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'],
  menu: ['#######', '.......', '#######', '.......', '#######'],
  switch: ['..#....', '.######', '..#...#', '#.....#', '#...#..', '######.', '....#..'],
};

export function glyph(name: keyof typeof GLYPHS | string): string {
  return memo(`glyph${name}`, () => {
    const rows = GLYPHS[name];
    const w = rows[0].length + 2;
    const h = rows.length + 2;
    const on = (x: number, y: number) => rows[y - 1]?.[x - 1] === '#';
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (on(x, y)) {
          ctx.fillStyle = y <= h / 2 ? '#ffe08a' : '#e0b050';
          ctx.fillRect(x, y, 1, 1);
        } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
          ctx.fillStyle = '#120a20';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    return c.toDataURL();
  });
}
