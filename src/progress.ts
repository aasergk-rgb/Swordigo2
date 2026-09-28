// Pure game-state logic (no Phaser), so it can be unit tested.
import { CONSUMABLES, EQUIPMENT, type Consumable, type SpellId } from './data/items';

export type StatChoice = 'hp' | 'atk' | 'mag';

export interface Abilities {
  doubleJump: boolean;
  charge: boolean;
  bolt: boolean;
  rift: boolean;
  bomb: boolean;
  ward: boolean;
}

export interface Equipped {
  sword: string;
  armor: string;
  charms: string[]; // up to 2
}

export interface SaveData {
  version: 2;
  /** Room of the last spring of light (respawn/continue point). */
  room: string;
  level: number;
  exp: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  atk: number;
  mag: number;
  coins: number;
  abilities: Abilities;
  spell: SpellId;
  items: Record<Consumable['id'], number>;
  owned: string[];
  equip: Equipped;
  /** Small keys held per area, and areas whose boss key was found. */
  keys: Record<string, number>;
  bossKeys: string[];
  fragments: number;
  /** Side quests finished ("entrusted lights"). */
  lights: string[];
  beacons: string[];
  visited: string[];
  flags: Record<string, boolean>;
  /** Small numeric states (e.g. water levels). */
  vars: Record<string, number>;
  opened: string[];
  playTime: number;
  easy: boolean;
}

export const MAX_LEVEL = 30;
export const MAX_CHARMS = 2;

export function newGame(): SaveData {
  return {
    version: 2,
    room: 'village',
    level: 1,
    exp: 0,
    hp: 10,
    hpMax: 10,
    mp: 20,
    mpMax: 20,
    atk: 3,
    mag: 3,
    coins: 0,
    abilities: { doubleJump: false, charge: false, bolt: false, rift: false, bomb: false, ward: false },
    spell: 'bolt',
    items: { potion: 1, bigPotion: 0, ether: 0 },
    owned: ['apprentice', 'cloth'],
    equip: { sword: 'apprentice', armor: 'cloth', charms: [] },
    keys: {},
    bossKeys: [],
    fragments: 0,
    lights: [],
    beacons: [],
    visited: [],
    flags: {},
    vars: {},
    opened: [],
    playTime: 0,
    easy: false,
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
    s.hp = maxHp(s);
    s.mp = s.mpMax;
  }
  return ups;
}

export function applyLevelChoice(s: SaveData, choice: StatChoice): void {
  if (choice === 'hp') {
    s.hpMax += 2;
    s.hp = maxHp(s);
  } else if (choice === 'atk') {
    s.atk += 1;
  } else {
    s.mpMax += 4;
    s.mp = s.mpMax;
    s.mag += 1;
  }
}

export function hasCharm(s: SaveData, id: string): boolean {
  return s.equip.charms.includes(id);
}

/** Max HP including equipment bonuses. */
export function maxHp(s: SaveData): number {
  return s.hpMax + (hasCharm(s, 'vigor') ? 4 : 0);
}

/** Sword power including the equipped blade and charms. */
export function attackPower(s: SaveData): number {
  let a = s.atk + (EQUIPMENT[s.equip.sword]?.atk ?? 0);
  if (hasCharm(s, 'fullMoon') && s.hp >= maxHp(s)) a += 2;
  return a;
}

export function defense(s: SaveData): number {
  return EQUIPMENT[s.equip.armor]?.def ?? 0;
}

export function damageTaken(enemyAtk: number, def: number, s?: SaveData): number {
  let d = Math.max(1, enemyAtk - def);
  if (s && hasCharm(s, 'greed')) d += 1;
  if (s?.easy) d = Math.max(1, Math.ceil(d / 2));
  return d;
}

export function swordDamage(atk: number, mult: number): number {
  return Math.max(1, Math.round(atk * mult));
}

export function coinGain(s: SaveData, amount: number): number {
  return hasCharm(s, 'greed') ? Math.ceil(amount * 1.5) : amount;
}

/** Death penalty: lose a share of coins, come back at full HP/MP. Returns coins lost. */
export function applyDeath(s: SaveData, lossRate: number): number {
  const lost = s.easy ? 0 : Math.floor(s.coins * lossRate);
  s.coins -= lost;
  s.hp = maxHp(s);
  s.mp = s.mpMax;
  return lost;
}

// ---------------------------------------------------------------- inventory

export function giveEquipment(s: SaveData, id: string): boolean {
  if (!EQUIPMENT[id] || s.owned.includes(id)) return false;
  s.owned.push(id);
  return true;
}

/** Equips an owned item; charms toggle in and out of the two charm slots. */
export function equip(s: SaveData, id: string): boolean {
  const e = EQUIPMENT[id];
  if (!e || !s.owned.includes(id)) return false;
  if (e.slot === 'sword') s.equip.sword = id;
  else if (e.slot === 'armor') s.equip.armor = id;
  else {
    const i = s.equip.charms.indexOf(id);
    if (i >= 0) s.equip.charms.splice(i, 1);
    else if (s.equip.charms.length < MAX_CHARMS) s.equip.charms.push(id);
    else return false;
  }
  s.hp = Math.min(s.hp, maxHp(s));
  return true;
}

export type BuyResult = 'ok' | 'poor' | 'owned' | 'full';

export function buy(s: SaveData, kind: 'equip' | 'item', id: string): BuyResult {
  if (kind === 'equip') {
    const e = EQUIPMENT[id];
    if (s.owned.includes(id)) return 'owned';
    if (s.coins < (e.price ?? 0)) return 'poor';
    s.coins -= e.price ?? 0;
    s.owned.push(id);
    return 'ok';
  }
  const c = CONSUMABLES[id as Consumable['id']];
  if (s.items[c.id] >= c.max) return 'full';
  if (s.coins < c.price) return 'poor';
  s.coins -= c.price;
  s.items[c.id] += 1;
  return 'ok';
}

/** Uses the best healing item available. Returns the item used, or null. */
export function useHeal(s: SaveData): Consumable['id'] | null {
  if (s.hp >= maxHp(s)) return null;
  if (s.items.potion > 0 && maxHp(s) - s.hp <= 8) {
    s.items.potion -= 1;
    s.hp = Math.min(maxHp(s), s.hp + 5);
    return 'potion';
  }
  if (s.items.bigPotion > 0) {
    s.items.bigPotion -= 1;
    s.hp = maxHp(s);
    return 'bigPotion';
  }
  if (s.items.potion > 0) {
    s.items.potion -= 1;
    s.hp = Math.min(maxHp(s), s.hp + 5);
    return 'potion';
  }
  return null;
}

export function useEther(s: SaveData): boolean {
  if (s.items.ether <= 0 || s.mp >= s.mpMax) return false;
  s.items.ether -= 1;
  s.mp = s.mpMax;
  return true;
}

export function takeKey(s: SaveData, area: string): boolean {
  if ((s.keys[area] ?? 0) <= 0) return false;
  s.keys[area] -= 1;
  return true;
}

// ---------------------------------------------------------------- save format

export function serialize(s: SaveData): string {
  return JSON.stringify(s);
}

/** Parses a save (v1 saves from the prototype are upgraded); returns null when unusable. */
export function deserialize(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if ((d.version !== 1 && d.version !== 2) || typeof d.room !== 'string' || typeof d.level !== 'number') return null;
    const base = newGame();
    const out = { ...base, ...(d as Partial<SaveData>), version: 2 } as SaveData;
    out.abilities = { ...base.abilities, ...((d.abilities as Partial<Abilities>) ?? {}) };
    out.items = { ...base.items, ...((d.items as SaveData['items']) ?? {}) };
    out.equip = { ...base.equip, ...((d.equip as Partial<Equipped>) ?? {}) };
    out.equip.charms = Array.isArray(out.equip.charms) ? [...out.equip.charms] : [];
    for (const k of ['owned', 'bossKeys', 'lights', 'beacons', 'visited', 'opened'] as const) {
      const v = d[k];
      out[k] = Array.isArray(v) ? [...(v as string[])] : [...base[k]];
    }
    out.keys = { ...((d.keys as Record<string, number>) ?? {}) };
    out.flags = { ...((d.flags as Record<string, boolean>) ?? {}) };
    out.vars = { ...((d.vars as Record<string, number>) ?? {}) };
    return out;
  } catch {
    return null;
  }
}
