// Room layouts for the prologue. One character = one 16px tile.
//
//  #  solid ground          -  one-way platform      ^  spikes
//  @  new-game spawn        L  entry from the left   R  entry from the right
//  p  pot    g  grass       c  chest (coins)  x  chest (EXP bag)  h  chest (heart vessel)
//  s  shadow slime   b  shadow bat   w  shadow wolf   W  boss: shadow-eater wolf
//  F  spring of light (save)   S  sign   E  elder Elda   K  shepherd boy   G  master Garen

export interface RoomDef {
  id: string;
  name: string;
  bg: number;
  width: number;
  rows: string[];
  exits: { left?: string; right?: string };
  /** Sign texts, in reading order (top-to-bottom, left-to-right). */
  signs?: string[];
  boss?: boolean;
}

export const ROOM_HEIGHT = 17;

/** Builds a room grid from sparse rows; missing rows are empty, short rows are padded. */
function grid(width: number, rows: Record<number, string>, opts: { gaps?: [number, number][]; leftWall?: boolean; rightWall?: boolean } = {}): string[] {
  const out: string[] = [];
  for (let r = 0; r < ROOM_HEIGHT; r++) {
    let line: string;
    if (r >= 14) {
      const cells = Array.from({ length: width }, () => '#');
      for (const [a, b] of opts.gaps ?? []) for (let c = a; c <= b; c++) cells[c] = '.';
      line = cells.join('');
    } else {
      line = (rows[r] ?? '').padEnd(width, '.').slice(0, width);
    }
    const cells = line.split('');
    if (opts.leftWall && r < 14) cells[0] = '#';
    if (opts.rightWall && r < 14) cells[width - 1] = '#';
    out.push(cells.join(''));
  }
  return out;
}

export const ROOMS: Record<string, RoomDef> = {
  village: {
    id: 'village',
    name: 'ハルナ村',
    bg: 0x3b2a4a,
    width: 48,
    exits: { right: 'forest1' },
    signs: [
      '← → で移動（2回押しでダッシュ）\nZ / スペース でジャンプ、X で剣\n↑ で話す・調べる',
      'この先 ささやきの森。\n虚（ウロ）に気をつけて。',
    ],
    rows: grid(
      48,
      {
        7: '..............-------',
        10: '........................----',
        13: '#...@..S....E.....F........p.p...K.....g.g.S.R.',
      },
      { leftWall: true },
    ),
  },

  forest1: {
    id: 'forest1',
    name: 'ささやきの森',
    bg: 0x1d3b2e,
    width: 74,
    exits: { left: 'village', right: 'forest2' },
    signs: [
      '壺や草は剣で壊せる。\n灯貨（お金）や回復が出ることもある。',
      '空中で ↓ + X で下突き。\n敵に当たると跳ね返る。\n同じ方向に続けて X で3段斬り。',
    ],
    rows: grid(
      74,
      {
        7: '...........................................b',
        8: '...............................c',
        9: '..............................----',
        10: '.....................................................x',
        11: '....................................................----',
        12: '........................###',
        13: 'L...S..g.g...p.......######.....s......g.g....p..s......S..........p..g.R',
      },
      { gaps: [[36, 38]] },
    ),
  },

  forest2: {
    id: 'forest2',
    name: 'ささやきの森・奥',
    bg: 0x152c25,
    width: 74,
    exits: { left: 'forest1', right: 'forest3' },
    signs: [
      'コウモリが投げる実は、\n剣で斬ると打ち返せる。',
      'トゲの上でも、\n下突き（空中で ↓ + X）なら跳ねて渡れる。',
    ],
    rows: grid(74, {
      7: '..................b.......................b',
      8: '..............................................................c',
      9: '............................................................-----',
      11: '...............................----',
      12: '...........................................###############',
      13: 'L.....p...w..S......g.g.....S.^^^^^^.....w.###############.....w...p...R',
    }),
  },

  forest3: {
    id: 'forest3',
    name: '静かな泉',
    bg: 0x122433,
    width: 40,
    exits: { left: 'forest2', right: 'boss' },
    signs: [
      '灯の泉：↑ でセーブと全回復。\n倒れたら、最後に触れた泉からやり直す。',
      '高い所に宝箱がある……今はまだ届かない。\n（二段ジャンプを手に入れたら戻ってこよう）',
    ],
    rows: grid(40, {
      6: '........................h',
      7: '.......................----',
      11: '.................---',
      13: 'L....S.......F...........S..........R',
    }),
  },

  boss: {
    id: 'boss',
    name: '森の最奥',
    bg: 0x0d1420,
    width: 36,
    exits: { left: 'forest3' },
    boss: true,
    rows: grid(
      36,
      {
        10: '......----...............----',
        13: 'L.............G.............W',
      },
      { rightWall: true },
    ),
  },
};

export const START_ROOM = 'village';
