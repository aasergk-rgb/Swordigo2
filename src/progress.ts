// Pure game-state logic (no Phaser), so it can be unit tested.

export type StatChoice = 'hp' | 'atk' | 'mag';

export interface Abilities {
  doubleJump: boolean;
  bolt: boolean;
}

export interface SaveData {
  version: 1;
  room: string;
  level: number;
  exp: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atk: number;
  mag: number;
  def: number;
  coins: number;
  abilities: Abilities;
  flags: Record<string, boolean>;
  opened: string[];
  playTime: number;
}

export const MAX_LEVEL = 30;

export function newGame(): SaveData {
  return {
    version: 1,
    room: 'village',
    level: 1,
    exp: 0,
    hp: 10,
    hpMax: 10,
    mp: 20,
    mpMax: 20,
    atk: 3,
    mag: 3,
    def: 0,
    coins: 0,
    abilities: { doubleJump: false, bolt: false },
    flags: {},
    opened: [],
    playTime: 0,
  };
}

/** EXP needed to go from `level` to `level + 1`. */
export function expToNext(level: number): number {
  return Math.floor(20 * Math.pow(level, 1.5));
}

/** Adds EXP and returns how many level-ups happened (each one grants a stat choice). */
export function addExp(s: SaveData, amount: number): number {
  let ups = 0;
  s.exp += amount;
  while (s.level < MAX_LEVEL && s.exp >= expToNext(s.level)) {
    s.exp -= expToNext(s.level);
    s.level += 1;
    ups += 1;
  }
  if (s.level >= MAX_LEVEL) s.exp = 0;
  if (ups > 0) {
    s.hp = s.hpMax;
    s.mp = s.mpMax;
  }
  return ups;
}

export function applyLevelChoice(s: SaveData, choice: StatChoice): void {
  if (choice === 'hp') {
    s.hpMax += 2;
    s.hp = s.hpMax;
  } else if (choice === 'atk') {
    s.atk += 1;
  } else {
    s.mpMax += 4;
    s.mp = s.mpMax;
    s.mag += 1;
  }
}

export function damageTaken(enemyAtk: number, def: number): number {
  return Math.max(1, enemyAtk - def);
}

export function swordDamage(atk: number, mult: number): number {
  return Math.max(1, Math.round(atk * mult));
}

/** Death penalty: lose a share of coins, come back at full HP/MP. Returns coins lost. */
export function applyDeath(s: SaveData, lossRate: number): number {
  const lost = Math.floor(s.coins * lossRate);
  s.coins -= lost;
  s.hp = s.hpMax;
  s.mp = s.mpMax;
  return lost;
}

export function serialize(s: SaveData): string {
  return JSON.stringify(s);
}

/** Parses a save; returns null when the data is missing or malformed. */
export function deserialize(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.version !== 1 || typeof d.room !== 'string' || typeof d.level !== 'number') return null;
    const base = newGame();
    return {
      ...base,
      ...d,
      abilities: { ...base.abilities, ...(d.abilities ?? {}) },
      flags: { ...(d.flags ?? {}) },
      opened: Array.isArray(d.opened) ? [...d.opened] : [],
    } as SaveData;
  } catch {
    return null;
  }
}
