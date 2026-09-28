// A small skeletal "rig" for people: poses are drawn procedurally so every
// character (Rio, NPCs, knights, Nox) shares one consistent style.
import { type Color, Px, shade, tint } from './pixels';

export const HUMAN_W = 40;
export const HUMAN_H = 36;
/** Feet sit on this row; the body is centred on FOOT_X. */
export const FOOT_X = 20;
export const FOOT_Y = 35;

export interface Look {
  skin: Color;
  hair: Color;
  eye: Color;
  tunic: Color;
  belt: Color;
  pants: Color;
  boots: Color;
  scarf?: Color;
  sword?: 'blade' | 'dagger' | 'staff' | null;
  blade?: Color;
  robe?: Color; // long robe / skirt instead of trousers
  cap?: Color;
  beard?: Color;
  cloak?: Color;
  bag?: Color;
  hairStyle?: 'short' | 'long' | 'bald' | 'spiky' | 'bun';
  helmet?: Color;
  shield?: Color;
  glowEyes?: boolean;
}

export interface Pose {
  bob?: number;
  lean?: number;
  legF?: [number, number]; // foot offset (dx, lift)
  legB?: [number, number];
  armF?: number; // degrees: 0 = forward, 90 = down, -90 = up
  armB?: number;
  sword?: number | null; // sword angle; null hides it
  crouch?: number;
  scarf?: number;
  lying?: boolean;
  headTilt?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function drawHumanoid(p: Px, look: Look, pose: Pose): void {
  if (pose.lying) return drawLying(p, look);
  const bob = pose.bob ?? 0;
  const lean = pose.lean ?? 0;
  const crouch = pose.crouch ?? 0;
  const hipY = FOOT_Y - 8 + bob + crouch;
  const cx = FOOT_X + lean;
  const [fdx, fdy] = pose.legF ?? [2, 0];
  const [bdx, bdy] = pose.legB ?? [-2, 0];
  const armF = pose.armF ?? 80;
  const armB = pose.armB ?? 100;

  const skinD = shade(look.skin, 0.25);
  const tunicD = shade(look.tunic, 0.3);
  const pantsD = shade(look.pants, 0.3);

  // Cloak behind everything.
  if (look.cloak) {
    const flutter = pose.scarf ?? 0;
    p.poly(
      [
        [cx - 2, hipY - 7],
        [cx + 2, hipY - 7],
        [cx - 1, hipY + 4],
        [cx - 6 - flutter, hipY + 3 + (flutter % 2)],
      ],
      shade(look.cloak, 0.15),
    );
  }

  // Back arm.
  const shB = { x: cx - 1, y: hipY - 6 };
  const hb = { x: shB.x + Math.cos(rad(armB)) * 5, y: shB.y + Math.sin(rad(armB)) * 5 };
  p.line(shB.x, shB.y, hb.x, hb.y, tunicD, 2);
  p.rect(hb.x - 1, hb.y - 1, 2, 2, skinD);

  // Legs (or robe).
  const hipB = { x: cx - 1, y: hipY };
  const hipF = { x: cx + 1, y: hipY };
  const footB = { x: FOOT_X + bdx - 1, y: FOOT_Y - bdy };
  const footF = { x: FOOT_X + fdx + 1, y: FOOT_Y - fdy };
  if (look.robe) {
    const r = look.robe;
    p.poly(
      [
        [cx - 3, hipY - 1],
        [cx + 3, hipY - 1],
        [cx + 5, FOOT_Y - 1],
        [cx - 5, FOOT_Y - 1],
      ],
      r,
    );
    p.rect(cx - 5, FOOT_Y - 2, 10, 1, shade(r, 0.25));
    p.rect(footF.x, FOOT_Y, 3, 1, look.boots);
    p.rect(footB.x - 2, FOOT_Y, 3, 1, shade(look.boots, 0.3));
  } else {
    p.line(hipB.x, hipB.y, footB.x, footB.y - 2, pantsD, 3);
    p.rect(footB.x - 1, footB.y - 2, 3, 3, shade(look.boots, 0.3));
    p.rect(footB.x + 1, footB.y, 1, 1, shade(look.boots, 0.3));
  }

  // Torso.
  const tt = hipY - 7;
  p.rect(cx - 3, tt, 6, 8, look.tunic);
  p.rect(cx - 3, tt, 1, 8, tunicD);
  p.rect(cx + 2, tt + 1, 1, 6, tint(look.tunic, 0.15));
  p.rect(cx - 3, hipY - 1, 6, 1, look.belt);
  if (look.robe) p.rect(cx - 3, hipY, 6, 1, look.robe);
  if (look.bag) {
    p.rect(cx - 5, hipY - 3, 3, 4, look.bag);
    p.line(cx - 3, tt + 1, cx + 2, hipY - 3, shade(look.bag, 0.2), 1);
  }

  if (!look.robe) {
    p.line(hipF.x, hipF.y, footF.x, footF.y - 2, look.pants, 3);
    p.rect(footF.x - 1, footF.y - 2, 3, 3, look.boots);
    p.rect(footF.x + 2, footF.y, 1, 1, look.boots);
  }

  // Scarf: wraps the neck and trails behind.
  if (look.scarf) {
    const s = look.scarf;
    const f = pose.scarf ?? 0;
    p.rect(cx - 3, tt - 1, 7, 2, s);
    p.line(cx - 3, tt, cx - 7 - f, tt + 2 + (f === 1 ? -1 : f === 2 ? 1 : 0), shade(s, 0.15), 2);
    p.px(cx - 8 - f, tt + 3 + (f === 2 ? 1 : 0), shade(s, 0.3));
  }

  drawHead(p, look, cx + 1 + (pose.headTilt ?? 0), tt - 1);

  // Shield on the back arm side (worn in front).
  if (look.shield) {
    p.rect(cx + 2, hipY - 7, 4, 8, look.shield);
    p.rect(cx + 3, hipY - 6, 2, 6, tint(look.shield, 0.2));
  }

  // Front arm and weapon.
  const shF = { x: cx + 1, y: hipY - 6 };
  const hf = { x: shF.x + Math.cos(rad(armF)) * 5, y: shF.y + Math.sin(rad(armF)) * 5 };
  if (pose.sword !== null && pose.sword !== undefined && look.sword) drawWeapon(p, look, hf.x, hf.y, pose.sword);
  p.line(shF.x, shF.y, hf.x, hf.y, look.tunic, 2);
  p.rect(hf.x - 1, hf.y - 1, 2, 2, look.skin);
}

function drawHead(p: Px, look: Look, cx: number, neckY: number): void {
  const top = neckY - 7;
  const x0 = cx - 4;
  // Face.
  p.rect(x0, top, 8, 7, look.skin);
  p.rect(x0, top + 5, 8, 2, shade(look.skin, 0.12));
  if (look.helmet) {
    p.rect(x0 - 1, top - 1, 10, 4, look.helmet);
    p.rect(x0 - 1, top + 3, 3, 3, look.helmet);
    p.rect(x0 + 2, top + 3, 6, 1, shade(look.helmet, 0.3));
  } else {
    const h = look.hair;
    const style = look.hairStyle ?? 'short';
    if (style !== 'bald') {
      p.rect(x0 - 1, top - 1, 10, 3, h);
      p.rect(x0 - 1, top + 2, 3, 3, h); // back of the head
      p.px(x0 + 6, top + 2, h); // fringe
      p.px(x0 + 3, top + 2, h);
      p.rect(x0, top - 1, 7, 1, tint(h, 0.2));
      if (style === 'long') p.rect(x0 - 1, top + 5, 3, 5, h);
      if (style === 'spiky') {
        p.px(x0 - 2, top - 1, h).px(x0 + 1, top - 2, h).px(x0 + 5, top - 2, h).px(x0 - 2, top + 2, h);
      }
      if (style === 'bun') p.rect(x0 - 3, top - 1, 3, 3, h);
    } else {
      p.rect(x0 - 1, top + 2, 2, 3, look.hair);
    }
    if (look.cap) {
      p.rect(x0 - 1, top - 2, 10, 3, look.cap);
      p.rect(x0 + 6, top, 4, 1, shade(look.cap, 0.25));
    }
  }
  // Eye (facing right).
  const eyeC = look.glowEyes ? '#ffffff' : look.eye;
  p.rect(x0 + 5, top + 3, 1, 2, eyeC);
  if (look.glowEyes) p.rect(x0 + 2, top + 3, 1, 2, eyeC);
  if (look.beard) {
    p.rect(x0 + 2, top + 5, 6, 3, look.beard);
    p.px(x0 + 4, top + 8, look.beard);
  }
}

function drawWeapon(p: Px, look: Look, hx: number, hy: number, angle: number): void {
  const a = rad(angle);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const blade = look.blade ?? '#d8e2ec';
  if (look.sword === 'staff') {
    p.line(hx - dx * 6, hy - dy * 6, hx + dx * 9, hy + dy * 9, '#8a5a2b', 1);
    p.disc(hx + dx * 10, hy + dy * 10, 1.5, '#9fe6ff');
    return;
  }
  const len = look.sword === 'dagger' ? 6 : 10;
  // Grip behind the hand, guard across, then the blade.
  p.line(hx - dx * 2, hy - dy * 2, hx, hy, '#6b4226', 1);
  p.line(hx + dx * 1 - dy * 2, hy + dy * 1 + dx * 2, hx + dx * 1 + dy * 2, hy + dy * 1 - dx * 2, '#e0b040', 1);
  p.line(hx + dx * 2, hy + dy * 2, hx + dx * (len + 1), hy + dy * (len + 1), blade, 2);
  p.line(hx + dx * 2, hy + dy * 2, hx + dx * len, hy + dy * len, tint(blade, 0.6), 1);
}

function drawLying(p: Px, look: Look): void {
  const y = FOOT_Y;
  // Body lying on its back, head to the right.
  p.rect(8, y - 3, 12, 3, look.pants);
  p.rect(6, y - 3, 3, 3, look.boots);
  p.rect(19, y - 4, 9, 4, look.tunic);
  p.rect(19, y - 4, 9, 1, shade(look.tunic, 0.3));
  if (look.cloak) p.rect(12, y - 1, 18, 1, look.cloak);
  p.rect(28, y - 6, 6, 6, look.skin);
  p.rect(28, y - 7, 7, 2, look.hair);
  p.rect(33, y - 5, 2, 4, look.hair);
  if (look.beard) p.rect(28, y - 2, 4, 2, look.beard);
  p.px(30, y - 4, look.eye);
}

// ---------------------------------------------------------------- looks

export const LOOKS = {
  rio: {
    skin: '#f2c9a0',
    hair: '#6b3e26',
    eye: '#1d1a2b',
    tunic: '#3f7cc2',
    belt: '#6b4a2a',
    pants: '#3a3350',
    boots: '#7a4a28',
    scarf: '#d8443a',
    sword: 'blade',
    hairStyle: 'spiky',
  },
  nox: {
    skin: '#1a1024',
    hair: '#0c0714',
    eye: '#ffffff',
    tunic: '#2a1740',
    belt: '#120a1c',
    pants: '#150c22',
    boots: '#0c0714',
    scarf: '#5a2a8a',
    sword: 'blade',
    blade: '#6a3aa0',
    hairStyle: 'spiky',
    glowEyes: true,
  },
  elder: {
    skin: '#e8c29a',
    hair: '#d8d8d8',
    eye: '#2a2a2a',
    tunic: '#7a6a9a',
    belt: '#d8b050',
    pants: '#5a4a7a',
    boots: '#4a3a2a',
    robe: '#6a5a8a',
    beard: '#eeeeee',
    hairStyle: 'bald',
    sword: 'staff',
  },
  boy: {
    skin: '#f2c9a0',
    hair: '#d89a3a',
    eye: '#2a2a2a',
    tunic: '#6aa050',
    belt: '#6b4a2a',
    pants: '#7a5a3a',
    boots: '#5a3a1a',
    hairStyle: 'short',
  },
  garen: {
    skin: '#d9ad85',
    hair: '#9aa0a8',
    eye: '#2a2a2a',
    tunic: '#4a5a6a',
    belt: '#3a2a1a',
    pants: '#2a2a3a',
    boots: '#3a2a1a',
    beard: '#b0b4b8',
    cloak: '#5a3a2a',
  },
  mina: {
    skin: '#f5d0ae',
    hair: '#2f7f7a',
    eye: '#1d1a2b',
    tunic: '#e0a040',
    belt: '#6b4a2a',
    pants: '#4a3a5a',
    boots: '#6b3a28',
    robe: '#b85a3a',
    cap: '#8a4a2a',
    bag: '#9a6a3a',
    hairStyle: 'long',
  },
  kai: {
    skin: '#e6b890',
    hair: '#d8dce8',
    eye: '#7a1a2a',
    tunic: '#2a2a3a',
    belt: '#5a1a2a',
    pants: '#1a1a26',
    boots: '#2a1a1a',
    cloak: '#3a3a52',
    sword: 'dagger',
    hairStyle: 'spiky',
  },
  villager: {
    skin: '#eac09a',
    hair: '#4a3020',
    eye: '#2a2a2a',
    tunic: '#a07a50',
    belt: '#5a3a1a',
    pants: '#5a4a3a',
    boots: '#4a2a1a',
    hairStyle: 'short',
  },
  villagerF: {
    skin: '#f0caa6',
    hair: '#8a3a2a',
    eye: '#2a2a2a',
    tunic: '#d0d0b0',
    belt: '#8a6a4a',
    pants: '#5a4a3a',
    boots: '#4a2a1a',
    robe: '#5a7aa0',
    hairStyle: 'bun',
  },
  miner: {
    skin: '#d9a57a',
    hair: '#2a2020',
    eye: '#2a2a2a',
    tunic: '#8a6a3a',
    belt: '#4a2a1a',
    pants: '#3a3a4a',
    boots: '#3a2a1a',
    cap: '#d8b040',
    beard: '#3a2a20',
    hairStyle: 'short',
  },
  merchant: {
    skin: '#eac09a',
    hair: '#5a4030',
    eye: '#2a2a2a',
    tunic: '#8a3a5a',
    belt: '#d8b050',
    pants: '#3a2a3a',
    boots: '#3a2a1a',
    robe: '#6a2a4a',
    cap: '#3a6a5a',
    hairStyle: 'short',
  },
  smith: {
    skin: '#c98d62',
    hair: '#1a1a1a',
    eye: '#2a2a2a',
    tunic: '#6a4a3a',
    belt: '#2a1a1a',
    pants: '#3a3030',
    boots: '#2a1a1a',
    beard: '#1a1a1a',
    hairStyle: 'bald',
  },
  scholar: {
    skin: '#eac09a',
    hair: '#a0a0a0',
    eye: '#2a2a2a',
    tunic: '#3a4a7a',
    belt: '#d8b050',
    pants: '#2a2a3a',
    boots: '#2a1a1a',
    robe: '#2a3a6a',
    hairStyle: 'short',
  },
  ghostGirl: {
    skin: '#bfe8f0',
    hair: '#7ab0c8',
    eye: '#2a4a5a',
    tunic: '#a8d8e8',
    belt: '#8ac0d8',
    pants: '#8ac0d8',
    boots: '#8ac0d8',
    robe: '#9fd0e0',
    hairStyle: 'long',
  },
  knight: {
    skin: '#1a2a2a',
    hair: '#000000',
    eye: '#7af0e0',
    tunic: '#3a6a6a',
    belt: '#2a4a4a',
    pants: '#2a4a4a',
    boots: '#1a3a3a',
    helmet: '#4a7a7a',
    sword: 'blade',
    blade: '#a0c8c0',
    glowEyes: true,
  },
  sentinel: {
    skin: '#2a2a3a',
    hair: '#000000',
    eye: '#ffd040',
    tunic: '#b8b8c8',
    belt: '#8a8aa0',
    pants: '#8a8aa0',
    boots: '#6a6a80',
    helmet: '#d8d8e8',
    shield: '#c8a040',
    sword: 'blade',
    glowEyes: true,
  },
  hollowKnight: {
    skin: '#0e0816',
    hair: '#000000',
    eye: '#ffffff',
    tunic: '#241430',
    belt: '#140a1e',
    pants: '#180c24',
    boots: '#0e0816',
    helmet: '#2e1c3e',
    sword: 'blade',
    blade: '#5a3a80',
    glowEyes: true,
  },
  guard: {
    skin: '#eac09a',
    hair: '#4a3020',
    eye: '#2a2a2a',
    tunic: '#3a5a9a',
    belt: '#d8b050',
    pants: '#2a2a3a',
    boots: '#2a1a1a',
    helmet: '#b8c0c8',
    sword: 'blade',
  },
} satisfies Record<string, Look>;

export type LookName = keyof typeof LOOKS;

/** Standard NPC animation strip: 2 idle frames + talk frame. */
export function npcStrip(look: Look, lying = false): Px {
  const p = new Px(HUMAN_W * 3, HUMAN_H);
  const poses: Pose[] = lying
    ? [{ lying: true }, { lying: true }, { lying: true }]
    : [
        { armF: 85, armB: 95, sword: look.sword === 'staff' ? -80 : null },
        { armF: 85, armB: 95, bob: 1, sword: look.sword === 'staff' ? -80 : null },
        { armF: 30, armB: 95, sword: look.sword === 'staff' ? -80 : null, headTilt: 0 },
      ];
  poses.forEach((pose, i) => {
    p.at(i * HUMAN_W, 0);
    drawHumanoid(p, look, pose);
    p.at(0, 0);
    p.outline(i * HUMAN_W, 0, HUMAN_W, HUMAN_H, '#140c18');
  });
  return p;
}

/** Frame indices inside the player/Nox strip. */
export const PLAYER_FRAMES = {
  idle: [0, 1],
  run: [2, 3, 4, 5, 6, 7],
  jump: [8],
  fall: [9],
  atk1: [10, 11],
  atk2: [12, 13],
  atk3: [14],
  up: [15],
  down: [16],
  hurt: [17],
  dash: [18],
  cast: [19],
} as const;

export function playerStrip(look: Look): Px {
  const run: Pose[] = [
    { legF: [5, 0], legB: [-4, 1], armF: 50, armB: 130, sword: 15, bob: 0, scarf: 1 },
    { legF: [3, 1], legB: [-2, 2], armF: 60, armB: 115, sword: 22, bob: -1, scarf: 2 },
    { legF: [0, 2], legB: [1, 0], armF: 75, armB: 95, sword: 30, bob: 0, scarf: 0 },
    { legF: [-4, 1], legB: [5, 0], armF: 95, armB: 55, sword: 38, bob: 0, scarf: 1 },
    { legF: [-2, 2], legB: [3, 1], armF: 85, armB: 70, sword: 32, bob: -1, scarf: 2 },
    { legF: [1, 0], legB: [0, 2], armF: 70, armB: 90, sword: 24, bob: 0, scarf: 0 },
  ];
  const poses: Pose[] = [
    { armF: 60, armB: 100, sword: 35, scarf: 0 }, // idle 0
    { armF: 62, armB: 102, sword: 37, bob: 1, scarf: 1 }, // idle 1
    ...run,
    { legF: [3, 4], legB: [-2, 2], armF: -30, armB: 160, sword: -20, crouch: -1, scarf: 2 }, // jump
    { legF: [3, 1], legB: [-3, 0], armF: -60, armB: 200, sword: -70, scarf: 1 }, // fall
    { legF: [3, 0], legB: [-3, 0], armF: -130, armB: 120, sword: -160, lean: -1, scarf: 0 }, // atk1 windup
    { legF: [5, 0], legB: [-4, 0], armF: 20, armB: 140, sword: 15, lean: 2, scarf: 2 }, // atk1 strike
    { legF: [4, 0], legB: [-3, 0], armF: 110, armB: 150, sword: 140, lean: 0, scarf: 1 }, // atk2 windup (low)
    { legF: [5, 0], legB: [-4, 0], armF: -25, armB: 150, sword: -35, lean: 2, scarf: 2 }, // atk2 strike (rising)
    { legF: [6, 0], legB: [-5, 0], armF: 0, armB: 170, sword: 0, lean: 3, scarf: 2, crouch: 1 }, // atk3 thrust
    { legF: [2, 0], legB: [-2, 0], armF: -80, armB: 120, sword: -90, scarf: 1 }, // up slash
    { legF: [3, 4], legB: [-3, 4], armF: 90, armB: 200, sword: 90, crouch: -2, scarf: 0 }, // down thrust
    { legF: [-1, 1], legB: [-4, 0], armF: -110, armB: -140, sword: -150, lean: -3, scarf: 2, headTilt: -1 }, // hurt
    { legF: [6, 1], legB: [-6, 1], armF: 140, armB: 150, sword: 160, lean: 3, scarf: 2, crouch: 1 }, // dash
    { legF: [3, 0], legB: [-3, 0], armF: -10, armB: 100, sword: 35, lean: 1, scarf: 1 }, // cast (open hand forward)
  ];
  const p = new Px(HUMAN_W * poses.length, HUMAN_H);
  poses.forEach((pose, i) => {
    p.at(i * HUMAN_W, 0);
    drawHumanoid(p, look, pose);
    p.at(0, 0);
    p.outline(i * HUMAN_W, 0, HUMAN_W, HUMAN_H, look.glowEyes ? '#8a4ad0' : '#140c18');
  });
  return p;
}
