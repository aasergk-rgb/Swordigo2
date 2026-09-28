// Monsters. Shadow creatures share a palette: near-black violet bodies with white eyes.
import { type Color, Px, shade, strip, tint } from './pixels';

export const SHADOW = {
  body: '#231733',
  mid: '#342249',
  light: '#4d3470',
  wisp: '#6a4a9a',
  eye: '#ffffff',
  outline: '#0b0612',
};

const OUT = SHADOW.outline;

export function slimeStrip(): Px {
  // idle squash x2, hop stretch, land squash
  const shapes = [
    [7, 5, 0],
    [7.5, 4.5, 1],
    [5, 6.5, -2],
    [8, 3.5, 2],
  ];
  return strip(
    20,
    16,
    4,
    (p, i) => {
      const [rx, ry, dy] = shapes[i];
      const cy = 15 - ry + Math.max(0, dy * 0.3);
      p.ellipse(10, cy, rx, ry, SHADOW.body);
      p.ellipse(10, cy + 1, rx - 1, ry - 1.5, SHADOW.mid);
      p.ellipse(8, cy - ry + 2.5, 2, 1, SHADOW.light);
      p.px(7, cy - ry + 2, tint(SHADOW.light, 0.4));
      p.rect(11, cy - 1, 1, 2, SHADOW.eye).rect(14, cy - 1, 1, 2, SHADOW.eye);
      // A few wisps rising from the top.
      p.px(9 + (i % 2), cy - ry - 1, SHADOW.wisp);
    },
    OUT,
  );
}

export function batStrip(): Px {
  const wing = [-40, -10, 25, -10];
  return strip(
    22,
    16,
    4,
    (p, i) => {
      const a = (wing[i] * Math.PI) / 180;
      const cx = 11;
      const cy = 8;
      for (const s of [-1, 1]) {
        const tipX = cx + s * 10 * Math.cos(a);
        const tipY = cy + 10 * Math.sin(a);
        p.poly(
          [
            [cx + s * 2, cy - 1],
            [tipX, tipY],
            [cx + s * 7 * Math.cos(a), cy + 3 + 6 * Math.sin(a) * 0.6],
            [cx + s * 2, cy + 2],
          ],
          s < 0 ? SHADOW.body : SHADOW.mid,
        );
      }
      p.ellipse(cx, cy, 3, 3, SHADOW.mid);
      p.px(cx - 2, cy - 4, SHADOW.mid).px(cx + 2, cy - 4, SHADOW.mid);
      p.px(cx - 1, cy - 1, SHADOW.eye).px(cx + 1, cy - 1, SHADOW.eye);
    },
    OUT,
  );
}

/** Four-legged shadow wolf; `s` scales it for the boss. */
function drawWolf(p: Px, frame: number, s: number, eye: Color, oy: number): void {
  // frames: 0-3 run, 4 idle, 5 pounce, 6 crouch (windup), 7 howl
  const run = [
    [4, -3, 3, -4],
    [2, 0, 1, -1],
    [-2, 3, -3, 4],
    [0, 1, 0, 1],
  ];
  // [near back, near front, far back, far front]
  const legs = frame < 4 ? run[frame] : frame === 5 ? [-6, 6, -5, 5] : [1, -1, 1, -1];
  const crouch = frame === 6 ? 2 : frame === 5 ? -1 : 0;
  const S = (v: number) => v * s;
  const bx = S(14);
  const by = oy - S(9) + S(crouch);
  const bob = frame < 4 ? (frame % 2) * s : 0;

  // Tail.
  const tailUp = frame === 7 ? -4 : frame === 5 ? -1 : -2 - (frame % 2);
  p.poly(
    [
      [bx - S(6), by - S(1) + bob],
      [bx - S(12), by + S(tailUp) + bob],
      [bx - S(11), by + S(tailUp + 2) + bob],
      [bx - S(6), by + S(2) + bob],
    ],
    SHADOW.body,
  );
  // Far legs.
  const legW = Math.max(2, Math.round(2 * s));
  const hipB = bx - S(4);
  const hipF = bx + S(4);
  const ground = oy - 1;
  p.line(hipB, by + S(2), hipB + S(legs[2]) * 0.8, ground, SHADOW.body, legW);
  p.line(hipF, by + S(2), hipF + S(legs[3]) * 0.8, ground, SHADOW.body, legW);
  // Body.
  p.ellipse(bx, by + bob, S(8), S(4), SHADOW.mid);
  p.ellipse(bx + S(1), by - S(1.5) + bob, S(6), S(2), SHADOW.light);
  // Near legs.
  p.line(hipB - S(1), by + S(2), hipB + S(legs[0]) - S(1), ground, SHADOW.mid, legW);
  p.line(hipF + S(1), by + S(2), hipF + S(legs[1]) + S(1), ground, SHADOW.mid, legW);
  // Head.
  const howl = frame === 7;
  const hx = bx + S(8);
  const hy = by - S(3) + bob - (howl ? S(3) : 0);
  p.ellipse(hx, hy, S(3.5), S(3), SHADOW.mid);
  p.poly(
    howl
      ? [
          [hx + S(1), hy - S(1)],
          [hx + S(5), hy - S(5)],
          [hx + S(6), hy - S(3)],
          [hx + S(3), hy + S(1)],
        ]
      : [
          [hx + S(2), hy - S(1)],
          [hx + S(7), hy + S(0.5)],
          [hx + S(6), hy + S(2)],
          [hx + S(1), hy + S(2)],
        ],
    SHADOW.mid,
  );
  // Ears.
  p.poly(
    [
      [hx - S(2), hy - S(2)],
      [hx - S(1), hy - S(6)],
      [hx + S(1), hy - S(2)],
    ],
    SHADOW.body,
  );
  p.poly(
    [
      [hx, hy - S(2)],
      [hx + S(1.5), hy - S(5.5)],
      [hx + S(2.5), hy - S(2)],
    ],
    SHADOW.mid,
  );
  // Eye.
  p.rect(hx + S(1.5), hy - S(1), Math.max(1, S(1.5)), Math.max(1, S(1)), eye);
  // Shadow wisps along the back.
  for (let k = 0; k < 3; k++) p.px(bx - S(4) + S(k * 4), by - S(5) + bob - ((frame + k) % 2), SHADOW.wisp);
}

export function wolfStrip(): Px {
  return strip(34, 22, 8, (p, i) => drawWolf(p, i, 1, SHADOW.eye, 21), OUT);
}

export function bossWolfStrip(): Px {
  return strip(
    64,
    40,
    8,
    (p, i) => {
      drawWolf(p, i, 1.9, '#ff4a5a', 39);
    },
    OUT,
  );
}

// ---------------------------------------------------------------- generic helpers for later chapters

export function glowOrbStrip(color: Color, size = 12, frames = 4): Px {
  return strip(size, size, frames, (p, i) => {
    const c = size / 2;
    p.disc(c - 0.5, c - 0.5, size / 2 - 1 - (i % 2) * 0.5, shade(color, 0.4));
    p.disc(c - 0.5, c - 0.5, size / 2 - 2.5, color);
    p.disc(c - 1.5, c - 1.5, 1.2, tint(color, 0.7));
  });
}
