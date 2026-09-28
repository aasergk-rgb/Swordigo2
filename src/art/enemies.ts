// Enemies and bosses for chapters 1-6.
import Phaser from 'phaser';
import { SHADOW } from './creatures';
import { drawHumanoid, HUMAN_H, HUMAN_W, LOOKS, type Look, type Pose, playerStrip } from './humanoid';
import { addStrip, anim, type Color, Px, shade, strip, tint } from './pixels';

const OUT = '#0b0612';

// ---------------------------------------------------------------- humanoid soldiers

/** idle, walk1, walk2, windup, strike, guard/cast */
export function soldierStrip(look: Look): Px {
  const poses: Pose[] = [
    { armF: 60, armB: 100, sword: 20 },
    { legF: [4, 0], legB: [-3, 1], armF: 55, armB: 120, sword: 20, bob: -1 },
    { legF: [-3, 1], legB: [4, 0], armF: 65, armB: 80, sword: 25 },
    { legF: [3, 0], legB: [-3, 0], armF: -130, armB: 120, sword: -160, lean: -1 },
    { legF: [5, 0], legB: [-4, 0], armF: 20, armB: 140, sword: 15, lean: 2 },
    { legF: [2, 0], legB: [-2, 0], armF: -40, armB: 80, sword: -60 },
  ];
  const p = new Px(HUMAN_W * poses.length, HUMAN_H);
  poses.forEach((pose, i) => {
    p.at(i * HUMAN_W, 0);
    drawHumanoid(p, look, pose);
    p.at(0, 0);
    p.outline(i * HUMAN_W, 0, HUMAN_W, HUMAN_H, OUT);
  });
  return p;
}

const hollowMage: Look = {
  skin: '#0e0816',
  hair: '#000000',
  eye: '#ffffff',
  tunic: '#301a48',
  belt: '#6a3aa0',
  pants: '#180c24',
  boots: '#0e0816',
  robe: '#2a1440',
  cap: '#3a1e58',
  sword: 'staff',
  glowEyes: true,
};

// ---------------------------------------------------------------- small creatures

function rockbugStrip(scale = 1, eye: Color = '#ffb040'): Px {
  const W = Math.round(26 * scale);
  const H = Math.round(18 * scale);
  return strip(
    W,
    H,
    3,
    (p, i) => {
      const S = (v: number) => v * scale;
      const base = H - 1;
      if (i === 2) {
        // Curled into a ball.
        p.disc(W / 2, base - S(7), S(7.5), '#6a5a4a');
        for (let k = 0; k < 4; k++) p.line(W / 2 - S(6) + S(k * 4), base - S(13), W / 2 - S(7) + S(k * 4), base - S(1), '#4a3e32', Math.max(1, S(1)));
        p.disc(W / 2 - S(2), base - S(10), S(2), '#8a7a66');
        return;
      }
      // Legs.
      for (let k = 0; k < 4; k++) {
        const x = S(6 + k * 4);
        const off = (k + i) % 2 ? 1 : -1;
        p.line(x, base - S(4), x + off * S(2), base, '#3a2e24', Math.max(1, S(1)));
      }
      // Segmented shell.
      p.ellipse(W / 2 - S(1), base - S(7), S(10), S(6), '#6a5a4a');
      for (let k = 0; k < 4; k++) p.rect(S(5) + S(k * 4.5), base - S(12), Math.max(1, S(1)), S(9), '#4a3e32');
      p.ellipse(W / 2 - S(3), base - S(10), S(5), S(2), '#8a7a66');
      // Head.
      p.ellipse(W - S(5), base - S(5), S(4), S(3.5), '#5a4a3a');
      p.rect(W - S(4), base - S(7), Math.max(1, S(2)), Math.max(1, S(2)), eye);
      p.line(W - S(3), base - S(2), W, base - S(1), '#3a2e24', Math.max(1, S(1)));
    },
    OUT,
  );
}

function wispStrip(): Px {
  return strip(18, 22, 4, (p, i) => {
    const bob = [0, 1, 2, 1][i];
    p.ellipse(9, 9 + bob, 6, 7, '#3a6a7a');
    p.poly(
      [
        [3, 10 + bob],
        [15, 10 + bob],
        [12 + (i % 2), 21],
        [9, 17 + bob],
        [6 - (i % 2), 21],
      ],
      '#3a6a7a',
    );
    p.ellipse(9, 9 + bob, 4, 5, '#6ac0d0');
    p.rect(6, 8 + bob, 2, 2, '#ffffff').rect(11, 8 + bob, 2, 2, '#ffffff');
    p.disc(9, 13 + bob, 1.5, '#ffe08a');
  });
}

function windSpriteStrip(): Px {
  return strip(22, 22, 4, (p, i) => {
    const a0 = (i * Math.PI) / 2;
    for (let k = 0; k < 18; k++) {
      const a = a0 + k * 0.45;
      const r = 2 + k * 0.45;
      p.rect(11 + Math.cos(a) * r, 11 + Math.sin(a) * r, 2, 2, k > 12 ? '#ffffff' : '#a8e0f0');
    }
    p.disc(11, 11, 3, '#e8fbff');
    p.px(10, 10, '#2a4a6a').px(12, 10, '#2a4a6a');
  });
}

function jellyStrip(): Px {
  return strip(20, 26, 4, (p, i) => {
    const squash = [0, 1, 2, 1][i];
    p.ellipse(10, 8 + squash, 8 + squash * 0.5, 7 - squash * 0.5, '#6ad0e8');
    p.ellipse(10, 7 + squash, 6, 5 - squash * 0.5, '#aaf0ff');
    p.px(7, 5 + squash, '#ffffff');
    for (let k = 0; k < 4; k++) {
      const x = 4 + k * 4;
      for (let y = 14; y < 25; y++) p.px(x + Math.round(Math.sin((y + i * 2 + k) / 2) * 1.2), y, y % 3 ? '#6ad0e8' : '#3aa0c8');
    }
    p.rect(7, 8 + squash, 1, 2, '#1a3a4a').rect(12, 8 + squash, 1, 2, '#1a3a4a');
  });
}

function lizardStrip(): Px {
  return strip(
    32,
    16,
    3,
    (p, i) => {
      const legs = i === 0 ? [2, -2] : i === 1 ? [-2, 2] : [0, 0];
      p.poly(
        [
          [0, 10],
          [8, 8],
          [8, 12],
        ],
        '#a83a1a',
      );
      p.ellipse(15, 10, 9, 4, '#c8502a');
      p.ellipse(15, 8, 7, 2, '#e8803a');
      for (let k = 0; k < 4; k++) p.px(10 + k * 3, 6, '#ffd040');
      p.line(10, 12, 10 + legs[0], 15, '#8a2a1a', 2).line(20, 12, 20 + legs[1], 15, '#8a2a1a', 2);
      const open = i === 2 ? 2 : 0;
      p.poly(
        [
          [22, 6],
          [31, 8 - open],
          [31, 10],
          [22, 12],
        ],
        '#c8502a',
      );
      if (open) p.poly(
        [
          [24, 10],
          [31, 9],
          [31, 12],
        ],
        '#ffb040',
      );
      p.px(26, 8, '#ffffff');
    },
    OUT,
  );
}

function lavaGolemStrip(): Px {
  return strip(
    36,
    34,
    3,
    (p, i) => {
      const slam = i === 2;
      const legOff = i === 1 ? 2 : 0;
      p.rect(8 + legOff, 24, 7, 10, '#3a2a2a').rect(21 - legOff, 24, 7, 10, '#3a2a2a');
      p.rect(6, 8, 24, 18, '#4a3434');
      p.rect(6, 8, 24, 3, '#6a4a44');
      p.line(10, 12, 16, 22, '#ff7a2a').line(24, 10, 20, 20, '#ff7a2a');
      p.disc(18, 16, 3, '#ffb040');
      p.rect(12, 0, 12, 9, '#4a3434').rect(15, 3, 2, 2, '#ffd040').rect(20, 3, 2, 2, '#ffd040');
      if (slam) {
        p.rect(0, 20, 8, 12, '#3a2a2a').rect(28, 20, 8, 12, '#3a2a2a');
      } else {
        p.rect(0, 10, 7, 12, '#3a2a2a').rect(29, 10, 7, 12, '#3a2a2a');
      }
    },
    OUT,
  );
}

// ---------------------------------------------------------------- bosses

/** Rock-eater golem: idle, raise, slam, core open, stunned. */
function golemStrip(): Px {
  return strip(
    80,
    84,
    5,
    (p, i) => {
      const stone = '#7a7266';
      const dark = '#4e483f';
      const light = '#a0968a';
      const raise = i === 1;
      const slam = i === 2;
      const open = i === 3 || i === 4;
      const sag = i === 4 ? 4 : 0;
      // Legs.
      p.rect(22, 62, 14, 22, dark).rect(44, 62, 14, 22, dark);
      p.rect(20, 78, 18, 6, stone).rect(42, 78, 18, 6, stone);
      // Torso.
      p.rect(14, 26 + sag, 52, 40, stone);
      p.rect(14, 26 + sag, 52, 5, light);
      p.rect(14, 60 + sag, 52, 6, dark);
      for (const [x, y] of [
        [20, 36],
        [52, 44],
        [26, 54],
      ])
        p.rect(x, y + sag, 8, 4, dark);
      // Chest core.
      if (open) {
        p.rect(30, 34 + sag, 20, 18, '#2a1a10');
        p.disc(40, 43 + sag, 7, '#ffcf5a');
        p.disc(40, 43 + sag, 4, '#fff6d0');
      } else {
        p.rect(30, 34 + sag, 20, 18, dark);
        p.rect(32, 36 + sag, 16, 14, stone);
        p.disc(40, 43 + sag, 2, '#ffcf5a');
      }
      // Head.
      p.rect(28, 8 + sag, 24, 20, stone);
      p.rect(28, 8 + sag, 24, 4, light);
      const eye = i === 4 ? '#6a5a4a' : '#ff9a2a';
      p.rect(33, 16 + sag, 5, 3, eye).rect(43, 16 + sag, 5, 3, eye);
      p.rect(34, 23 + sag, 12, 2, dark);
      // Arms.
      const armY = raise ? 0 : slam ? 50 : 30;
      for (const [sx, dir] of [
        [8, -1],
        [72, 1],
      ] as const) {
        p.rect(sx - 7, 28 + sag, 14, 12, dark);
        const fx = sx + dir * (slam ? 2 : 0);
        p.rect(fx - 7, armY + 10 + sag, 14, 22, stone);
        p.rect(fx - 9, armY + 30 + sag, 18, 14, dark);
        p.rect(fx - 9, armY + 30 + sag, 18, 3, light);
      }
    },
    OUT,
  );
}

/** Storm eagle: 3 flap frames, dive, perched. */
function eagleStrip(): Px {
  return strip(
    88,
    60,
    5,
    (p, i) => {
      const body = '#5a6a8a';
      const light = '#c8d8f0';
      const dark = '#34405a';
      const cx = 44;
      const cy = 30;
      const dive = i === 3;
      const perch = i === 4;
      const wingA = perch ? 60 : dive ? 70 : [-35, 5, 40][i];
      for (const s of [-1, 1]) {
        const a = (wingA * Math.PI) / 180;
        const tipX = cx + s * 40 * Math.cos(a) * (dive ? 0.4 : 1);
        const tipY = cy + 34 * Math.sin(a) * (dive ? 0.6 : 1) - 4;
        p.poly(
          [
            [cx + s * 6, cy - 4],
            [tipX, tipY],
            [tipX - s * 6, tipY + 8],
            [cx + s * 22 * Math.cos(a), cy + 8 + 10 * Math.sin(a)],
            [cx + s * 6, cy + 6],
          ],
          s < 0 ? dark : body,
        );
        for (let k = 1; k < 4; k++) p.line(cx + s * 8, cy, tipX - s * k * 5, tipY + k * 3, light);
      }
      // Body and tail.
      p.poly(
        [
          [cx - 4, cy + 10],
          [cx + 4, cy + 10],
          [cx + 8, cy + 26],
          [cx - 8, cy + 26],
        ],
        dark,
      );
      p.ellipse(cx, cy + 2, 9, 12, body);
      p.ellipse(cx, cy + 5, 6, 8, light);
      // Head with hooked beak (facing right).
      p.disc(cx + 4, cy - 12, 7, light);
      p.poly(
        [
          [cx + 9, cy - 13],
          [cx + 17, cy - 10],
          [cx + 12, cy - 6],
          [cx + 9, cy - 8],
        ],
        '#f0b030',
      );
      p.rect(cx + 6, cy - 14, 2, 2, '#1a1a2a');
      p.line(cx + 3, cy - 17, cx - 3, cy - 21, '#e8425a', 2);
      // Talons.
      p.line(cx - 3, cy + 12, cx - 5, cy + 18 + (perch ? 6 : 0), '#f0b030', 2).line(cx + 3, cy + 12, cx + 5, cy + 18 + (perch ? 6 : 0), '#f0b030', 2);
    },
    OUT,
  );
}

/** Sea serpent head (idle x2, roar, hurt) and a tentacle segment strip. */
function leviaStrip(): Px {
  return strip(
    72,
    64,
    4,
    (p, i) => {
      const skin = '#2a7a8a';
      const light = '#6ad0c8';
      const dark = '#18485a';
      const roar = i === 2;
      const bob = i === 1 ? 2 : 0;
      // Neck.
      p.poly(
        [
          [10, 64],
          [26, 30 + bob],
          [44, 30 + bob],
          [34, 64],
        ],
        dark,
      );
      for (let y = 36; y < 64; y += 6) p.rect(20, y, 12, 2, light);
      // Head.
      p.ellipse(40, 26 + bob, 22, 14, skin);
      p.ellipse(38, 20 + bob, 16, 6, light);
      // Fins.
      p.poly(
        [
          [22, 16 + bob],
          [16, 0],
          [30, 14 + bob],
        ],
        light,
      );
      p.poly(
        [
          [32, 12 + bob],
          [30, -2],
          [42, 12 + bob],
        ],
        light,
      );
      // Jaw.
      if (roar) {
        p.poly(
          [
            [44, 30],
            [70, 42],
            [44, 44],
          ],
          dark,
        );
        p.poly(
          [
            [46, 32],
            [66, 40],
            [46, 41],
          ],
          '#7a1a2a',
        );
        for (let k = 0; k < 4; k++) p.px(50 + k * 4, 33 + k, '#ffffff');
      } else {
        p.poly(
          [
            [44, 30 + bob],
            [66, 32 + bob],
            [44, 38 + bob],
          ],
          dark,
        );
      }
      const eye = i === 3 ? '#ffffff' : '#ffe040';
      p.disc(48, 22 + bob, 4, '#10202a');
      p.disc(49, 21 + bob, 2.5, eye);
    },
    OUT,
  );
}

function tentacleStrip(): Px {
  return strip(20, 72, 3, (p, i) => {
    for (let y = 0; y < 72; y++) {
      const w = 7 - (y / 72) * 5;
      const x = 10 + Math.sin(y / 9 + i) * 3 * (y / 72);
      p.rect(x - w / 2, 71 - y, w, 1, y % 8 < 2 ? '#6ad0c8' : '#2a7a8a');
    }
    for (let y = 8; y < 60; y += 10) p.disc(10 + Math.sin(y / 9 + i) * 3 * (y / 72) + 2, 71 - y, 1.2, '#b0f0e0');
  });
}

/** Lava dragon: idle x2, breath, tail-sweep, hurt. */
function dragonStrip(): Px {
  return strip(
    112,
    80,
    5,
    (p, i) => {
      const skin = '#8a2a1a';
      const light = '#d8602a';
      const dark = '#4a140c';
      const bob = i === 1 ? 2 : 0;
      const breath = i === 2;
      const tail = i === 3;
      // Tail.
      p.line(20, 64, tail ? 2 : 6, tail ? 74 : 44, skin, 7);
      p.line(tail ? 2 : 6, tail ? 74 : 44, tail ? 0 : 14, tail ? 70 : 32, skin, 4);
      // Wings.
      p.poly(
        [
          [40, 30 + bob],
          [24, 0],
          [60, 12],
          [56, 32 + bob],
        ],
        dark,
      );
      for (let k = 0; k < 3; k++) p.line(40, 30 + bob, 28 + k * 12, 4 + k * 3, skin);
      // Legs and body.
      p.rect(32, 60, 12, 20, dark).rect(62, 60, 12, 20, dark);
      p.ellipse(52, 52 + bob, 30, 18, skin);
      p.ellipse(56, 58 + bob, 20, 9, '#e8a060');
      for (let k = 0; k < 6; k++) p.poly(
        [
          [30 + k * 8, 36 + bob],
          [34 + k * 8, 28 + bob],
          [38 + k * 8, 36 + bob],
        ],
        light,
      );
      // Neck and head.
      p.line(74, 48 + bob, 90, 28 + bob, skin, 10);
      p.ellipse(96, 24 + bob, 13, 9, skin);
      p.poly(
        [
          [90, 16 + bob],
          [84, 2],
          [96, 14 + bob],
        ],
        '#e8d0a0',
      );
      if (breath) {
        p.poly(
          [
            [100, 26],
            [112, 22],
            [112, 36],
            [100, 32],
          ],
          dark,
        );
        p.poly(
          [
            [102, 28],
            [112, 26],
            [112, 32],
          ],
          '#ffb040',
        );
      } else {
        p.poly(
          [
            [100, 22 + bob],
            [112, 26 + bob],
            [100, 32 + bob],
          ],
          skin,
        );
      }
      p.rect(97, 20 + bob, 3, 2, i === 4 ? '#ffffff' : '#ffe040');
      p.line(66, 44 + bob, 80, 40 + bob, '#ffb040');
    },
    OUT,
  );
}

/** Nox's second form: a huge shadow with white eyes (idle x2, roar) and its hands. */
function noxGiantStrip(): Px {
  return strip(120, 110, 3, (p, i) => {
    const bob = i === 1 ? 3 : 0;
    p.ellipse(60, 70 + bob, 52, 40, SHADOW.body);
    p.ellipse(60, 60 + bob, 40, 34, SHADOW.mid);
    for (let k = 0; k < 10; k++) {
      const x = 12 + k * 10;
      p.poly(
        [
          [x - 5, 90 + bob],
          [x, 108 - (k % 3) * 4],
          [x + 5, 90 + bob],
        ],
        SHADOW.body,
      );
    }
    for (let k = 0; k < 7; k++) p.poly(
      [
        [20 + k * 12, 40 + bob],
        [24 + k * 12, 18 + ((k * 7) % 12) + bob],
        [30 + k * 12, 38 + bob],
      ],
      SHADOW.mid,
    );
    const open = i === 2 ? 3 : 0;
    p.ellipse(42, 56 + bob, 8, 4 + open, '#ffffff');
    p.ellipse(78, 56 + bob, 8, 4 + open, '#ffffff');
    p.rect(40, 54 + bob, 3, 4, SHADOW.body).rect(76, 54 + bob, 3, 4, SHADOW.body);
    if (i === 2) p.ellipse(60, 80, 16, 8, '#0b0612');
    for (let k = 0; k < 20; k++) p.px(10 + ((k * 37) % 100), 30 + ((k * 53) % 70), SHADOW.wisp);
  });
}

function shadowHandStrip(): Px {
  return strip(36, 40, 2, (p, i) => {
    const spread = i ? 3 : 0;
    p.ellipse(18, 26, 12, 12, SHADOW.mid);
    for (let k = 0; k < 4; k++) p.line(9 + k * 6, 20, 6 + k * 8 - spread + k * spread * 0.7, 2, SHADOW.mid, 4);
    p.line(28, 26, 35, 16, SHADOW.mid, 4);
    p.disc(18, 26, 4, '#e8e0ff');
    p.disc(18, 26, 2, '#ffffff');
  }, OUT);
}

// ---------------------------------------------------------------- registration

export function registerChapterArt(scene: Phaser.Scene): void {
  const soldiers: Record<string, Look> = {
    sentinel: LOOKS.sentinel,
    knight: LOOKS.knight,
    hollowKnight: LOOKS.hollowKnight,
    hollowMage: hollowMage,
    guard: LOOKS.guard,
  };
  for (const [k, look] of Object.entries(soldiers)) {
    addStrip(scene, `sol_${k}`, soldierStrip(look), HUMAN_W, HUMAN_H);
    anim(scene, `sol_${k}_idle`, `sol_${k}`, [0], 1);
    anim(scene, `sol_${k}_walk`, `sol_${k}`, [1, 0, 2, 0], 8);
    anim(scene, `sol_${k}_windup`, `sol_${k}`, [3], 1);
    anim(scene, `sol_${k}_strike`, `sol_${k}`, [4], 1);
    anim(scene, `sol_${k}_guard`, `sol_${k}`, [5], 1);
  }
  // Kai fights with Rio's move set.
  addStrip(scene, 'kai', playerStrip(LOOKS.kai), HUMAN_W, HUMAN_H);

  addStrip(scene, 'rockbug', rockbugStrip(), 26, 18);
  anim(scene, 'rockbug_walk', 'rockbug', [0, 1], 6);
  anim(scene, 'rockbug_curl', 'rockbug', [2], 1);
  addStrip(scene, 'rockqueen', rockbugStrip(2.2, '#ff5a3a'), 57, 40);
  anim(scene, 'rockqueen_walk', 'rockqueen', [0, 1], 5);
  anim(scene, 'rockqueen_curl', 'rockqueen', [2], 1);
  addStrip(scene, 'wisp', wispStrip(), 18, 22);
  anim(scene, 'wisp_float', 'wisp', [0, 1, 2, 3], 6);
  addStrip(scene, 'windsprite', windSpriteStrip(), 22, 22);
  anim(scene, 'windsprite_spin', 'windsprite', [0, 1, 2, 3], 12);
  addStrip(scene, 'jelly', jellyStrip(), 20, 26);
  anim(scene, 'jelly_swim', 'jelly', [0, 1, 2, 1], 5);
  addStrip(scene, 'lizard', lizardStrip(), 32, 16);
  anim(scene, 'lizard_walk', 'lizard', [0, 1], 6);
  anim(scene, 'lizard_spit', 'lizard', [2], 1);
  addStrip(scene, 'lavagolem', lavaGolemStrip(), 36, 34);
  anim(scene, 'lavagolem_walk', 'lavagolem', [0, 1], 3);
  anim(scene, 'lavagolem_slam', 'lavagolem', [2], 1);

  addStrip(scene, 'golem', golemStrip(), 80, 84);
  addStrip(scene, 'eagle', eagleStrip(), 88, 60);
  anim(scene, 'eagle_fly', 'eagle', [0, 1, 2, 1], 8);
  addStrip(scene, 'levia', leviaStrip(), 72, 64);
  anim(scene, 'levia_idle', 'levia', [0, 1], 2);
  addStrip(scene, 'tentacle', tentacleStrip(), 20, 72);
  anim(scene, 'tentacle_wave', 'tentacle', [0, 1, 2, 1], 5);
  addStrip(scene, 'dragon', dragonStrip(), 112, 80);
  anim(scene, 'dragon_idle', 'dragon', [0, 1], 2);
  addStrip(scene, 'noxgiant', noxGiantStrip(), 120, 110);
  anim(scene, 'noxgiant_idle', 'noxgiant', [0, 1], 2);
  addStrip(scene, 'shadowhand', shadowHandStrip(), 36, 40);
  anim(scene, 'shadowhand_grab', 'shadowhand', [0, 1], 4);

  // Sword fragment pickup and bomb.
  const frag = strip(12, 20, 2, (p, i) => {
    p.poly(
      [
        [6, 0],
        [10, 6],
        [7, 20],
        [3, 14],
      ],
      i ? '#ffffff' : '#fff3a0',
    );
    p.poly(
      [
        [6, 0],
        [7, 20],
        [3, 14],
      ],
      tint('#fff3a0', 0.5),
    );
  });
  addStrip(scene, 'fragment', frag, 12, 20);
  anim(scene, 'fragment_shine', 'fragment', [0, 1], 4);
  const bomb = strip(14, 14, 2, (p, i) => {
    p.disc(7, 8, 5.5, '#3a2a4a').disc(6, 7, 2, '#8a6aa8').line(10, 3, 12, 1, '#c89a5a');
    p.disc(12, 1, 1.5, i ? '#ffffff' : '#ffd040');
  });
  addStrip(scene, 'bomb', bomb, 14, 14);
  anim(scene, 'bomb_fuse', 'bomb', [0, 1], 12);
  const orb = strip(14, 14, 2, (p, i) => {
    p.disc(7, 7, 6, shade('#c8a040', 0.3)).disc(7, 7, 5, i ? '#fff3a0' : '#4a4a5a').disc(5, 5, 1.5, i ? '#ffffff' : '#7a7a8a');
  });
  addStrip(scene, 'orb', orb, 14, 14);
}

/** Everything above, for the dev art preview page. */
export function previewStrips(): Record<string, Px> {
  return {
    sentinel: soldierStrip(LOOKS.sentinel),
    knight: soldierStrip(LOOKS.knight),
    hollowKnight: soldierStrip(LOOKS.hollowKnight),
    hollowMage: soldierStrip(hollowMage),
    kai: playerStrip(LOOKS.kai),
    rockbug: rockbugStrip(),
    rockqueen: rockbugStrip(2.2, '#ff5a3a'),
    wisp: wispStrip(),
    windsprite: windSpriteStrip(),
    jelly: jellyStrip(),
    lizard: lizardStrip(),
    lavagolem: lavaGolemStrip(),
    golem: golemStrip(),
    eagle: eagleStrip(),
    levia: leviaStrip(),
    tentacle: tentacleStrip(),
    dragon: dragonStrip(),
    noxgiant: noxGiantStrip(),
    shadowhand: shadowHandStrip(),
  };
}
