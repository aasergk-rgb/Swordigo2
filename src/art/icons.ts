// 16x16 HUD icons in one strip.
import { Px } from './pixels';

export const ICON = 16;

export const IC = {
  heartFull: 0,
  heartHalf: 1,
  heartEmpty: 2,
  mp: 3,
  coin: 4,
  key: 5,
  bossKey: 6,
  fragment: 7,
  light: 8,
  bolt: 9,
  rift: 10,
  bomb: 11,
  ward: 12,
  potion: 13,
  bigPotion: 14,
  ether: 15,
  sword: 16,
  armor: 17,
  charm: 18,
  beacon: 19,
} as const;

const HEART = ['..aa...aa...', '.abba.abba..', 'abbbbabbbba.', 'abbbbbbbbba.', 'abbbbbbbbba.', '.abbbbbbba..', '..abbbbba...', '...abbba....', '....aba.....', '.....a......'];

export function iconsPx(): Px {
  const n = 20;
  const p = new Px(ICON * n, ICON);
  const at = (i: number) => p.at(i * ICON, 0);

  const heart = (i: number, fill: 'full' | 'half' | 'empty') => {
    at(i);
    const pal = { a: '#3a0a18', b: fill === 'empty' ? '#4a2430' : '#e8425a' };
    p.grid(2, 3, HEART, pal);
    if (fill === 'half') p.grid(2, 3, HEART.map((r) => '......' + r.slice(6).replace(/b/g, 'c')), { c: '#4a2430' });
    if (fill !== 'empty') p.px(4, 5, '#ffb0c0').px(5, 5, '#ffb0c0');
  };
  heart(IC.heartFull, 'full');
  heart(IC.heartHalf, 'half');
  heart(IC.heartEmpty, 'empty');

  at(IC.mp);
  p.poly(
    [
      [8, 1],
      [14, 8],
      [8, 15],
      [2, 8],
    ],
    '#1a3a8a',
  );
  p.poly(
    [
      [8, 3],
      [12, 8],
      [8, 13],
      [4, 8],
    ],
    '#5fa8ff',
  );
  p.px(7, 6, '#e0f0ff');

  at(IC.coin);
  p.disc(7.5, 7.5, 6, '#a8781a').disc(7.5, 7.5, 5, '#f2c14e').rect(6, 4, 3, 7, '#ffe79a').px(5, 5, '#fffbe0');

  at(IC.key);
  p.disc(4, 8, 3, '#f2c14e').px(4, 8, '#3a2a10').rect(7, 7, 8, 2, '#f2c14e').rect(11, 9, 1, 3, '#f2c14e').rect(14, 9, 1, 3, '#f2c14e');
  at(IC.bossKey);
  p.disc(4, 8, 3.5, '#e05a5a').px(4, 8, '#3a0a10').rect(7, 7, 8, 3, '#e05a5a').rect(11, 10, 2, 3, '#e05a5a').rect(14, 10, 1, 3, '#e05a5a');

  at(IC.fragment);
  p.poly(
    [
      [8, 0],
      [12, 5],
      [9, 16],
      [5, 11],
    ],
    '#fff3a0',
  );
  p.poly(
    [
      [8, 0],
      [9, 16],
      [5, 11],
    ],
    '#ffffff',
  );

  at(IC.light);
  p.disc(7.5, 7.5, 6, '#6a5a1a').disc(7.5, 7.5, 4.5, '#ffe89a').disc(7.5, 7.5, 2.5, '#ffffff');

  at(IC.bolt);
  p.disc(7.5, 7.5, 5.5, '#ffd86a').disc(7.5, 7.5, 3.5, '#fff6c0').disc(7.5, 7.5, 1.5, '#ffffff');
  at(IC.rift);
  p.line(2, 8, 13, 8, '#9fe6ff', 2).line(9, 4, 13, 8, '#9fe6ff', 2).line(9, 12, 13, 8, '#9fe6ff', 2).px(3, 5, '#ffffff').px(5, 11, '#ffffff');
  at(IC.bomb);
  p.disc(7, 9, 5.5, '#3a2a4a').disc(6, 8, 2, '#8a6aa8').line(10, 4, 13, 1, '#c89a5a').px(13, 1, '#ffd040').px(14, 0, '#ffffff');
  at(IC.ward);
  p.poly(
    [
      [2, 2],
      [14, 2],
      [14, 8],
      [8, 15],
      [2, 8],
    ],
    '#e8c040',
  );
  p.poly(
    [
      [4, 4],
      [12, 4],
      [12, 8],
      [8, 13],
      [4, 8],
    ],
    '#fff3a0',
  );

  const bottle = (i: number, c: string, big: boolean) => {
    at(i);
    const w = big ? 10 : 8;
    p.rect(8 - w / 2, 6, w, 9, c).rect(6, 2, 4, 4, '#d8e0f0').rect(6, 1, 4, 1, '#8a6a4a').px(9 - w / 2, 8, '#ffffff');
  };
  bottle(IC.potion, '#e8425a', false);
  bottle(IC.bigPotion, '#ff6a8a', true);
  bottle(IC.ether, '#5fa8ff', false);

  at(IC.sword);
  p.line(3, 13, 13, 3, '#d8e2ec', 2).line(2, 10, 6, 14, '#e0b040').px(2, 14, '#6b4226');
  at(IC.armor);
  p.rect(3, 3, 10, 11, '#6a8ab0').rect(1, 3, 3, 4, '#6a8ab0').rect(12, 3, 3, 4, '#6a8ab0').rect(6, 3, 4, 2, '#1a1a2a');
  at(IC.charm);
  p.disc(8, 9, 4.5, '#b070e0').disc(8, 9, 2.5, '#e0c0ff').line(8, 1, 8, 4, '#c8a040');
  at(IC.beacon);
  p.rect(7, 6, 2, 10, '#4a4a5a').rect(4, 1, 8, 6, '#4a4a5a').rect(5, 2, 6, 4, '#ffe9a0');
  p.at(0, 0);
  return p;
}
