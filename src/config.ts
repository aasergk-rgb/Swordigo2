// Tunable numbers. Values follow docs/03_game_system.md (all provisional).

export const TILE = 16;
export const VIEW_W = 480;
export const VIEW_H = 270;
/** The canvas is rendered at 2x so UI text stays sharp; the world camera zooms back in. */
export const RENDER_SCALE = 2;

export const PLAYER = {
  walkSpeed: 90,
  dashSpeed: 150,
  doubleTapWindow: 0.25,
  accelTime: 0.08,
  decelTime: 0.05,
  attackMoveFactor: 0.7,
  gravity: 900,
  fallGravityFactor: 1.4,
  maxFall: 300,
  // v = sqrt(2 * g * h)
  jumpVelocity: Math.sqrt(2 * 900 * 3.5 * TILE),
  doubleJumpVelocity: Math.sqrt(2 * 900 * 2.5 * TILE),
  jumpCutFactor: 0.45,
  coyoteTime: 0.1,
  jumpBuffer: 0.1,
  invulnTime: 1.0,
  knockbackX: 120,
  knockbackY: -140,
  knockbackTime: 0.2,
  pogoVelocity: -260,
};

export interface SwingSpec {
  mult: number;
  startup: number;
  active: number;
  total: number;
}

export const SWORD = {
  comboWindow: 0.35,
  combo: [
    { mult: 1.0, startup: 0.05, active: 0.1, total: 0.2 },
    { mult: 1.0, startup: 0.05, active: 0.1, total: 0.2 },
    { mult: 1.6, startup: 0.1, active: 0.12, total: 0.35 },
  ] as SwingSpec[],
  up: { mult: 1.0, startup: 0.06, active: 0.12, total: 0.25 } as SwingSpec,
  downMult: 1.2,
  downMaxTime: 0.6,
  reach: 22,
  hitstop: 40,
  mpOnHit: 1,
  reflectMult: 2,
};

export const MAGIC = {
  boltCost: 3,
  boltSpeed: 260,
};

export const DEATH_COIN_LOSS = 0.1;

export const SAVE_KEY = 'luminablade.save.v1';
