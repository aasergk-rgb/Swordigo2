// Tiny pixel-art toolkit: every sprite in the game is drawn with these helpers at boot.
import Phaser from 'phaser';

export type Color = string; // css color, e.g. '#aabbcc'

/** Deterministic PRNG so generated art is identical on every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hex(n: number): Color {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Mixes two '#rrggbb' colors; t=0 gives a, t=1 gives b. */
export function mix(a: Color, b: Color, t: number): Color {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
}

export const shade = (c: Color, t: number): Color => mix(c, '#000000', t);
export const tint = (c: Color, t: number): Color => mix(c, '#ffffff', t);

export class Px {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Drawing origin offset, so the same drawing code can target any frame cell. */
  ox = 0;
  oy = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  at(ox: number, oy: number): this {
    this.ox = ox;
    this.oy = oy;
    return this;
  }

  px(x: number, y: number, c: Color): this {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, 1, 1);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, Math.round(w), Math.round(h));
    return this;
  }

  /** Filled disc (pixel-crisp). */
  disc(cx: number, cy: number, r: number, c: Color): this {
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++)
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) if (x * x + y * y <= r * r + r * 0.8) this.px(cx + x, cy + y, c);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): this {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
      for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) this.px(cx + x, cy + y, c);
    return this;
  }

  /** Thick line made of square stamps. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, width = 1): this {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const half = (width - 1) / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.rect(x0 + (x1 - x0) * t - half, y0 + (y1 - y0) * t - half, width, width, c);
    }
    return this;
  }

  poly(points: [number, number][], c: Color): this {
    const ctx = this.ctx;
    ctx.fillStyle = c;
    // Scanline fill for crisp edges.
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) ctx.fillRect(Math.round(xs[i]) + this.ox, y + this.oy, Math.round(xs[i + 1]) - Math.round(xs[i]), 1);
    }
    return this;
  }

  /** Draws an ASCII grid; '.' or ' ' is transparent. */
  grid(x: number, y: number, rows: string[], pal: Record<string, Color>): this {
    rows.forEach((row, r) =>
      row.split('').forEach((ch, c) => {
        const col = pal[ch];
        if (col) this.px(x + c, y + r, col);
      }),
    );
    return this;
  }

  /** Adds a 1px outline around opaque pixels inside a region. */
  outline(x: number, y: number, w: number, h: number, c: Color): this {
    const img = this.ctx.getImageData(x, y, w, h);
    const d = img.data;
    const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 40;
    const marks: [number, number][] = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) marks.push([i, j]);
    this.ctx.fillStyle = c;
    for (const [i, j] of marks) this.ctx.fillRect(x + i, y + j, 1, 1);
    return this;
  }

  /** Replaces every opaque pixel in a region with a color (for silhouettes / flashes). */
  fillOpaque(x: number, y: number, w: number, h: number, c: Color, alpha = 1): this {
    const img = this.ctx.getImageData(x, y, w, h);
    const d = img.data;
    const v = parseInt(c.slice(1), 16);
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 0) {
        d[i] = (v >> 16) & 255;
        d[i + 1] = (v >> 8) & 255;
        d[i + 2] = v & 255;
        d[i + 3] = Math.round(d[i + 3] * alpha);
      }
    this.ctx.putImageData(img, x, y);
    return this;
  }
}

/** Registers a canvas as a texture with a horizontal strip of equal frames named 0..n-1. */
export function addStrip(scene: Phaser.Scene, key: string, px: Px, frameW: number, frameH: number): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, px.canvas)!;
  const cols = Math.floor(px.w / frameW);
  const rows = Math.floor(px.h / frameH);
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(n++, 0, c * frameW, r * frameH, frameW, frameH);
}

export function addImage(scene: Phaser.Scene, key: string, px: Px): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, px.canvas);
}

/** Draws `n` frames side by side into one strip. */
export function strip(frameW: number, frameH: number, n: number, draw: (p: Px, i: number) => void, outline?: Color): Px {
  const p = new Px(frameW * n, frameH);
  for (let i = 0; i < n; i++) {
    p.at(i * frameW, 0);
    draw(p, i);
    p.at(0, 0);
    if (outline) p.outline(i * frameW, 0, frameW, frameH, outline);
  }
  return p;
}

export function anim(scene: Phaser.Scene, key: string, texture: string, frames: number[], frameRate: number, repeat = -1): void {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({ key, frames: frames.map((f) => ({ key: texture, frame: f })), frameRate, repeat });
}
