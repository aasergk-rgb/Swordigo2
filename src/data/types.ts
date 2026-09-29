// Shared data types for rooms, NPCs and story events.
import type { SaveData } from '../progress';

export interface Line {
  who?: string;
  text: string;
}

/**
 * Room grid legend (one character = one 16px tile):
 *
 * Terrain   #  solid        -  one-way platform   ^  spikes      &  lava
 *           %  bomb wall    =  crumbling block    |  light grid (rift passes)
 *           +  gate (opened by the room's orbs)
 * Markers   @  new-game spawn     0-9  links to other rooms (on the border = walk through,
 *           inside = door, press ↑)
 *           F  spring of light (save)   T  warp beacon   S  sign   B  boss
 *           L  locked door (small key)  X  boss door (boss key)   *  light orb switch
 * Things    p  pot   g  grass
 *           c  chest: coins   x  chest: EXP   h  chest: heart vessel   m  chest: MP vessel
 *           y  chest: small key   u  chest: boss key   i  chest: item from `items`
 * Enemies   s slime  b bat  w wolf  r rock bug  e mine wisp  f wind sprite  t sentinel
 *           j jelly  n sunken knight  z fire lizard  o lava golem  v hollow knight  q hollow mage
 * NPCs      any other capital letter, mapped through `npcs`
 */
export interface RoomDef {
  id: string;
  name: string;
  /** Area id: groups rooms for keys, the map and the location toast. */
  area: string;
  tiles: string;
  bg: string;
  rows: string[];
  links: Record<string, Link>;
  /** Sign texts in reading order; a sign can change once a flag condition holds. */
  signs?: (string | { when: string; text: string; before: string })[];
  npcs?: Record<string, string>;
  /** Contents of `i` chests, in reading order. */
  items?: string[];
  /** Darkness of the room, 0 (none) to 1 (pitch black). */
  dark?: number;
  /** Water surface row; with `levels`, orbs cycle between them. */
  water?: number | { levels: number[] };
  /** Rising lava: starts `start` rows above the bottom and rises `speed` px/s. */
  lava?: { start: number; speed: number; flag?: string };
  wind?: { col: number; row: number; w: number; h: number; fx: number; fy: number }[];
  orbs?: 'gate' | 'water';
  boss?: string;
  props?: Prop[];
  particles?: 'fireflies' | 'dust' | 'embers' | 'bubbles' | 'leaves' | 'motes' | 'ash' | 'sparkles';
  /** Story event run when entering the room (the event decides whether it applies). */
  onEnter?: string;
  /** Events fired once when the player walks past a column. */
  triggers?: { col: number; event: string }[];
  /** Hide objects/NPCs/links unless a flag condition holds: key = "col,row", value = flag or "!flag". */
  when?: Record<string, string>;
}

export interface Link {
  to: string;
  at: string;
  /** Look of an interior door. */
  door?: 'house' | 'cave' | 'gate' | 'shrine' | 'dark' | 'hidden';
}

export interface Prop {
  kind: string;
  col: number;
  row: number;
  /** Draw in front of the player instead of behind. */
  front?: boolean;
  flip?: boolean;
}

/** What story scripts and NPC dialogs can do. Implemented by the game scene. */
export interface GameApi {
  readonly save: SaveData;
  readonly roomId: string;
  say(lines: Line[] | string, who?: string): Promise<void>;
  choose(question: string, options: string[]): Promise<number>;
  wait(ms: number): Promise<void>;
  toast(text: string): void;
  flag(name: string): boolean;
  setFlag(name: string, value?: boolean): void;
  giveCoins(n: number): void;
  giveExp(n: number): Promise<void>;
  giveEquip(id: string): Promise<void>;
  giveItem(id: 'potion' | 'bigPotion' | 'ether', n: number): void;
  giveAbility(id: keyof SaveData['abilities'], title: string, help: string): Promise<void>;
  giveFragment(): Promise<void>;
  completeQuest(id: string, who: string): Promise<void>;
  openShop(id: string): Promise<void>;
  shake(ms: number, intensity?: number): void;
  flash(color: number, ms?: number): void;
  fadeOut(ms?: number, color?: number): Promise<void>;
  fadeIn(ms?: number): Promise<void>;
  npc(letter: string): NpcHandle | null;
  playerX(): number;
  lockPlayer(locked: boolean): void;
  face(dir: 1 | -1): void;
  warp(room: string, marker: string): Promise<void>;
  startBoss(): void;
  summon(kind: string, col: number, row: number): void;
  refreshRoom(): void;
  ending(): void;
  /** Hands control back to the player until every enemy in the room is gone. */
  waitNoEnemies(): Promise<void>;
  readonly roomAlive: boolean;
}

export interface NpcHandle {
  x: number;
  y: number;
  face(dir: 1 | -1): void;
  moveTo(x: number, speed?: number): Promise<void>;
  hide(): void;
  show(): void;
  setLook(look: string): void;
}

export interface NpcDef {
  name: string;
  /** Humanoid look name (art/humanoid LOOKS) or a texture key of a special sprite. */
  look: string;
  lying?: boolean;
  /** Only present when this flag condition holds ("flag" or "!flag"). */
  when?: string;
  /** Alternative look while a flag condition holds. */
  alt?: { when: string; look: string };
  talk: (g: GameApi) => Promise<void>;
}
