// Painted parallax backgrounds. Each theme = sky + far layer + mid layer, 480px wide and tileable.
import { type Color, Px, mix, rng, shade, tint } from './pixels';

export const BG_W = 480;
export const BG_H = 272;

type Far = 'mountains' | 'cliffs' | 'pillars' | 'stalactites' | 'city' | 'ruins' | 'volcano' | 'none';
type Mid = 'pines' | 'trees' | 'rocks' | 'columns' | 'houses' | 'crystals' | 'chains' | 'windmills' | 'none';

export interface BgTheme {
  skyTop: Color;
  skyBottom: Color;
  far: Far;
  farColor: Color;
  mid: Mid;
  midColor: Color;
  stars?: boolean;
  sun?: Color;
  clouds?: Color;
  seed: number;
}

export const BG_THEMES: Record<string, BgTheme> = {
  village: { skyTop: '#2a2350', skyBottom: '#f09a5a', far: 'mountains', farColor: '#6a4a78', mid: 'houses', midColor: '#3a2a44', sun: '#ffd890', clouds: '#f8b8a0', seed: 1 },
  villageNight: { skyTop: '#070818', skyBottom: '#1e2448', far: 'mountains', farColor: '#1e1e3a', mid: 'houses', midColor: '#12122a', stars: true, seed: 1 },
  forest: { skyTop: '#0e2420', skyBottom: '#2e5a44', far: 'mountains', farColor: '#1e3e34', mid: 'pines', midColor: '#12302a', stars: true, seed: 2 },
  forestDeep: { skyTop: '#060e14', skyBottom: '#16302e', far: 'mountains', farColor: '#10242a', mid: 'pines', midColor: '#0a1c1e', stars: true, seed: 3 },
  road: { skyTop: '#4a8ad0', skyBottom: '#c8e4f0', far: 'mountains', farColor: '#7a98b8', mid: 'trees', midColor: '#4a7a58', clouds: '#ffffff', sun: '#fff4c0', seed: 4 },
  dorm: { skyTop: '#3a3060', skyBottom: '#c8805a', far: 'cliffs', farColor: '#5a4a60', mid: 'houses', midColor: '#3a3040', sun: '#ffc070', seed: 5 },
  mine: { skyTop: '#0a0a10', skyBottom: '#1e1c24', far: 'stalactites', farColor: '#16151c', mid: 'chains', midColor: '#221f28', seed: 6 },
  plateau: { skyTop: '#3a8ae0', skyBottom: '#d0f0ff', far: 'mountains', farColor: '#90b8d8', mid: 'windmills', midColor: '#6a9a60', clouds: '#ffffff', sun: '#ffffe0', seed: 7 },
  shrine: { skyTop: '#80b8f0', skyBottom: '#f4f8ff', far: 'pillars', farColor: '#c0d0e8', mid: 'columns', midColor: '#a0b0cc', clouds: '#ffffff', seed: 8 },
  lake: { skyTop: '#04101a', skyBottom: '#0e3038', far: 'stalactites', farColor: '#0a2228', mid: 'crystals', midColor: '#14404a', seed: 9 },
  aqualia: { skyTop: '#062028', skyBottom: '#1a5058', far: 'ruins', farColor: '#123a42', mid: 'columns', midColor: '#1a4a52', seed: 10 },
  forge: { skyTop: '#1a0806', skyBottom: '#6a1a0a', far: 'volcano', farColor: '#3a1410', mid: 'rocks', midColor: '#2a100c', seed: 11 },
  capital: { skyTop: '#2a2a3a', skyBottom: '#7a7a8a', far: 'city', farColor: '#4a4a5a', mid: 'houses', midColor: '#2e2e3a', seed: 12 },
  tower: { skyTop: '#000000', skyBottom: '#1a1a22', far: 'pillars', farColor: '#16161c', mid: 'chains', midColor: '#101014', stars: true, seed: 13 },
};

/** Sky: vertical gradient in dithered bands, plus sun, stars and clouds. */
export function skyPx(t: BgTheme): Px {
  const p = new Px(BG_W, BG_H);
  const bands = 18;
  for (let b = 0; b < bands; b++) {
    const c = mix(t.skyTop, t.skyBottom, b / (bands - 1));
    const y0 = Math.floor((b * BG_H) / bands);
    const y1 = Math.floor(((b + 1) * BG_H) / bands);
    p.rect(0, y0, BG_W, y1 - y0, c);
    // Checker dither into the next band.
    if (b < bands - 1) {
      const n = mix(t.skyTop, t.skyBottom, (b + 1) / (bands - 1));
      for (let x = 0; x < BG_W; x += 2) p.px(x + ((y1 >> 0) % 2), y1 - 1, n);
    }
  }
  const r = rng(t.seed * 31);
  if (t.stars) for (let k = 0; k < 90; k++) p.px(r() * BG_W, r() * BG_H * 0.6, r() < 0.2 ? '#ffffff' : '#a0a8d0');
  if (t.sun) {
    p.disc(360, 70, 22, tint(t.sun, 0.2));
    p.disc(360, 70, 18, t.sun);
  }
  if (t.clouds) {
    for (let k = 0; k < 6; k++) {
      const cx = r() * BG_W;
      const cy = 30 + r() * 80;
      for (let j = 0; j < 5; j++) p.ellipse(cx + j * 9 - 18, cy - (j % 2) * 4, 12, 6, mix(t.clouds, t.skyBottom, 0.35));
      p.rect(cx - 30, cy + 2, 60, 4, mix(t.clouds, t.skyBottom, 0.35));
    }
  }
  return p;
}

export function farPx(t: BgTheme): Px {
  const p = new Px(BG_W, BG_H);
  const r = rng(t.seed * 57);
  const c = t.farColor;
  const hl = tint(c, 0.12);
  switch (t.far) {
    case 'mountains':
    case 'volcano': {
      // A continuous ridge that wraps around horizontally.
      const peaks = 7;
      const hs = Array.from({ length: peaks }, () => 90 + r() * 90);
      for (let x = 0; x < BG_W; x++) {
        const f = (x / BG_W) * peaks;
        const i = Math.floor(f);
        const a = hs[i % peaks];
        const b = hs[(i + 1) % peaks];
        const u = f - i;
        const h = a + (b - a) * (u * u * (3 - 2 * u)) + Math.sin(x * 0.2) * 2;
        p.rect(x, BG_H - h, 1, h, c);
        if (u < 0.5) p.rect(x, BG_H - h, 1, 3, hl);
      }
      if (t.far === 'volcano') {
        p.poly(
          [
            [150, BG_H],
            [220, 70],
            [260, 70],
            [330, BG_H],
          ],
          shade(c, 0.1),
        );
        p.rect(222, 66, 36, 5, '#e05a2a');
        for (let k = 0; k < 20; k++) p.px(230 + r() * 20, 30 + r() * 36, '#ff9040');
      }
      break;
    }
    case 'cliffs':
      for (let x = 0; x < BG_W; x += 24) {
        const h = 120 + r() * 100;
        p.rect(x, BG_H - h, 26, h, c);
        p.rect(x, BG_H - h, 26, 2, hl);
        p.rect(x + 20, BG_H - h, 2, h, shade(c, 0.2));
      }
      break;
    case 'pillars':
      for (let x = 10; x < BG_W; x += 60) {
        const h = 140 + r() * 100;
        p.rect(x, BG_H - h, 22, h, c);
        p.rect(x - 3, BG_H - h, 28, 6, hl);
        p.rect(x + 16, BG_H - h + 6, 3, h, shade(c, 0.15));
      }
      break;
    case 'stalactites':
      for (let x = 0; x < BG_W; x += 12) {
        const h = 30 + r() * 80;
        p.poly(
          [
            [x, 0],
            [x + 12, 0],
            [x + 6, h],
          ],
          c,
        );
        const g = 20 + r() * 60;
        p.poly(
          [
            [x, BG_H],
            [x + 12, BG_H],
            [x + 6, BG_H - g],
          ],
          c,
        );
      }
      break;
    case 'city':
      for (let x = 0; x < BG_W; x += 18 + Math.floor(r() * 10)) {
        const h = 60 + r() * 120;
        p.rect(x, BG_H - h, 16, h, c);
        if (r() < 0.3)
          p.poly(
            [
              [x - 2, BG_H - h],
              [x + 8, BG_H - h - 20],
              [x + 18, BG_H - h],
            ],
            c,
          );
        for (let k = 0; k < 4; k++) p.px(x + 3 + r() * 10, BG_H - h + 8 + r() * (h - 16), '#e8c070');
      }
      break;
    case 'ruins':
      for (let x = 0; x < BG_W; x += 70) {
        const h = 100 + r() * 90;
        p.rect(x + 10, BG_H - h, 14, h, c);
        p.rect(x + 40, BG_H - h * 0.7, 14, h * 0.7, c);
        p.rect(x + 6, BG_H - h, 52, 8, c);
        p.poly(
          [
            [x + 4, BG_H - h],
            [x + 32, BG_H - h - 26],
            [x + 60, BG_H - h],
          ],
          c,
        );
      }
      break;
    case 'none':
      break;
  }
  return p;
}

export function midPx(t: BgTheme): Px {
  const p = new Px(BG_W, BG_H);
  const r = rng(t.seed * 91);
  const c = t.midColor;
  const hl = tint(c, 0.12);
  const dk = shade(c, 0.25);
  switch (t.mid) {
    case 'pines':
      for (let x = 0; x < BG_W; x += 26 + Math.floor(r() * 16)) {
        const h = 90 + r() * 90;
        const w = 18 + r() * 10;
        for (let k = 0; k < 5; k++) {
          const y = BG_H - h + k * (h / 6);
          p.poly(
            [
              [x, y + h / 4],
              [x + w / 2, y],
              [x + w, y + h / 4],
            ],
            k % 2 ? c : hl,
          );
        }
        p.rect(x + w / 2 - 2, BG_H - h * 0.25, 4, h * 0.25, dk);
      }
      break;
    case 'trees':
      for (let x = 0; x < BG_W; x += 40 + Math.floor(r() * 30)) {
        const h = 60 + r() * 40;
        p.rect(x + 8, BG_H - h, 5, h, dk);
        p.ellipse(x + 10, BG_H - h, 20, 16, c);
        p.ellipse(x + 6, BG_H - h - 5, 10, 8, hl);
      }
      break;
    case 'houses':
      for (let x = 0; x < BG_W; x += 60 + Math.floor(r() * 30)) {
        const w = 34 + r() * 16;
        const h = 36 + r() * 24;
        p.rect(x, BG_H - h, w, h, c);
        p.poly(
          [
            [x - 5, BG_H - h],
            [x + w / 2, BG_H - h - 22],
            [x + w + 5, BG_H - h],
          ],
          dk,
        );
        p.rect(x + w / 2 - 4, BG_H - h + 10, 8, 8, '#f0c060');
        p.rect(x + w / 2, BG_H - h + 10, 1, 8, dk);
        if (r() < 0.6) p.rect(x + w - 10, BG_H - h - 18, 5, 12, dk);
      }
      break;
    case 'rocks':
      for (let x = 0; x < BG_W; x += 30 + Math.floor(r() * 30)) {
        const h = 30 + r() * 70;
        p.poly(
          [
            [x, BG_H],
            [x + 6, BG_H - h],
            [x + 20, BG_H - h - 10],
            [x + 34, BG_H],
          ],
          c,
        );
        p.line(x + 8, BG_H - h + 4, x + 14, BG_H - 10, '#c0401a');
      }
      break;
    case 'columns':
      for (let x = 20; x < BG_W; x += 80) {
        const h = 120 + r() * 60;
        p.rect(x, BG_H - h, 18, h, c);
        p.rect(x - 4, BG_H - h, 26, 6, hl);
        for (let y = BG_H - h + 10; y < BG_H; y += 6) p.rect(x + 3, y, 1, 4, dk);
        if (r() < 0.5) p.rect(x - 4, BG_H - h - 30, 60, 8, c);
      }
      break;
    case 'crystals':
      for (let x = 0; x < BG_W; x += 40 + Math.floor(r() * 30)) {
        const h = 30 + r() * 50;
        p.poly(
          [
            [x, BG_H],
            [x + 5, BG_H - h],
            [x + 10, BG_H - h - 8],
            [x + 15, BG_H],
          ],
          c,
        );
        p.line(x + 6, BG_H - h + 2, x + 8, BG_H - 4, '#4ad0d0');
      }
      break;
    case 'chains':
      for (let x = 30; x < BG_W; x += 90) {
        const h = 60 + r() * 120;
        for (let y = 0; y < h; y += 6) p.rect(x, y, 3, 4, c).rect(x + 1, y + 1, 1, 2, dk);
      }
      for (let x = 0; x < BG_W; x += 50) p.rect(x, BG_H - 20 - r() * 40, 30, 4, c);
      break;
    case 'windmills':
      for (let x = 40; x < BG_W; x += 160) {
        p.poly(
          [
            [x, BG_H],
            [x + 6, BG_H - 90],
            [x + 16, BG_H - 90],
            [x + 22, BG_H],
          ],
          c,
        );
        const hx = x + 11;
        const hy = BG_H - 88;
        for (let a = 0; a < 4; a++) {
          const ang = a * (Math.PI / 2) + 0.4;
          p.line(hx, hy, hx + Math.cos(ang) * 36, hy + Math.sin(ang) * 36, dk, 3);
        }
      }
      for (let x = 0; x < BG_W; x += 4) p.rect(x, BG_H - 16 - Math.sin(x / 40) * 6, 4, 30, hl);
      break;
    case 'none':
      break;
  }
  return p;
}
