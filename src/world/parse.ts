// Turns a room's ASCII grid into tile indices and object lists. Pure: unit tested.
import type { RoomDef } from '../data/types';

export const TILE = 16;

/** Tile indices inside a theme strip (see art/tiles.ts). */
export const TI = {
  platform: 16,
  spikes: 17,
  crumble: 18,
  bombWall: 19,
  grid: 20,
  gate: 21,
  lava: 23,
} as const;

export type Edge = 'left' | 'right' | 'top' | 'bottom';

export interface Marker {
  ch: string;
  col: number;
  row: number;
  edge: Edge | null;
}

export interface ParsedRoom {
  width: number;
  height: number;
  /** Tile index per cell, -1 when empty. */
  tiles: number[][];
  links: Marker[];
  objects: Marker[];
}

const TERRAIN = '#-^&%=|+';
const SOLIDISH = '#%=';

export function isSolidChar(ch: string | undefined): boolean {
  return ch !== undefined && SOLIDISH.includes(ch);
}

export function parseRoom(room: RoomDef): ParsedRoom {
  const rows = room.rows;
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const at = (c: number, r: number): string => {
    // Outside the room counts as solid so walls at the border get no rim.
    if (c < 0 || r < 0 || c >= width || r >= height) return '#';
    return rows[r][c] ?? '.';
  };

  const tiles: number[][] = [];
  const links: Marker[] = [];
  const objects: Marker[] = [];
  for (let r = 0; r < height; r++) {
    const line: number[] = [];
    for (let c = 0; c < width; c++) {
      const ch = at(c, r);
      let t = -1;
      if (ch === '#') {
        const open = (cc: number, rr: number) => !isSolidChar(at(cc, rr));
        t = (open(c, r - 1) ? 1 : 0) | (open(c + 1, r) ? 2 : 0) | (open(c, r + 1) ? 4 : 0) | (open(c - 1, r) ? 8 : 0);
      } else if (ch === '-') t = TI.platform;
      else if (ch === '^') t = TI.spikes;
      else if (ch === '&') t = TI.lava;
      else if (ch === '%') t = TI.bombWall;
      else if (ch === '=') t = TI.crumble;
      else if (ch === '|') t = TI.grid;
      else if (ch === '+') t = TI.gate;
      line.push(t);

      if (ch === '.' || ch === ' ' || TERRAIN.includes(ch)) continue;
      const edge: Edge | null = c === 0 ? 'left' : c === width - 1 ? 'right' : r === 0 ? 'top' : r === height - 1 ? 'bottom' : null;
      const m = { ch, col: c, row: r, edge };
      if (ch >= '0' && ch <= '9') links.push(m);
      else objects.push(m);
    }
    tiles.push(line);
  }
  return { width, height, tiles, links, objects };
}

/**
 * Builds a room grid from sparse rows: missing rows are empty, short rows are padded,
 * and the bottom `floor` rows are solid ground except for the given gaps.
 */
export function grid(
  width: number,
  height: number,
  rows: Record<number, string>,
  opts: { floor?: number; gaps?: [number, number][]; leftWall?: boolean; rightWall?: boolean; ceiling?: number } = {},
): string[] {
  const floor = opts.floor ?? 3;
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    let cells: string[];
    if (rows[r] !== undefined) {
      cells = rows[r].padEnd(width, '.').slice(0, width).split('');
    } else if (r >= height - floor) {
      cells = Array.from({ length: width }, () => '#');
      for (const [a, b] of opts.gaps ?? []) for (let c = a; c <= b; c++) cells[c] = '.';
    } else if (r < (opts.ceiling ?? 0)) {
      cells = Array.from({ length: width }, () => '#');
    } else {
      cells = Array.from({ length: width }, () => '.');
    }
    if (opts.leftWall && cells[0] === '.') cells[0] = '#';
    if (opts.rightWall && cells[width - 1] === '.') cells[width - 1] = '#';
    out.push(cells.join(''));
  }
  // Keep a doorway open above links on the left/right border.
  for (let r = 0; r < height; r++)
    for (const c of [0, width - 1]) {
      const ch = out[r][c];
      if (ch < '0' || ch > '9') continue;
      for (let k = 1; k <= 2 && r - k >= 0; k++) if (out[r - k][c] === '#') out[r - k] = out[r - k].slice(0, c) + '.' + out[r - k].slice(c + 1);
    }
  return out;
}

/** Flag condition: "name" means set, "!name" means not set. */
export function checkCond(cond: string | undefined, flags: Record<string, boolean>): boolean {
  if (!cond) return true;
  return cond.split('&').every((part) => {
    const p = part.trim();
    return p.startsWith('!') ? !flags[p.slice(1)] : !!flags[p];
  });
}

/** Builds one grid row by placing strings at columns: row(10, { 0: '1', 4: '###' }) → "1...###...". */
export function row(width: number, items: Record<number, string>, fill = '.'): string {
  const cells = Array.from({ length: width }, () => fill);
  for (const [col, s] of Object.entries(items)) for (let i = 0; i < s.length; i++) if (+col + i < width) cells[+col + i] = s[i];
  return cells.join('');
}

/** Solid run: "#" repeated n times. */
export const solid = (n: number, ch = '#'): string => ch.repeat(n);
