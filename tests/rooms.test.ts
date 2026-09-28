import { describe, expect, it } from 'vitest';
import { ROOMS, ROOM_HEIGHT, START_ROOM } from '../src/data/rooms';

const LEGEND = new Set('#-^@LRpgcxhsbwWFSEKG.'.split(''));
const count = (rows: string[], ch: string) => rows.join('').split(ch).length - 1;

describe('rooms', () => {
  it('starts in a room with a spawn point', () => {
    expect(count(ROOMS[START_ROOM].rows, '@')).toBe(1);
  });

  for (const room of Object.values(ROOMS)) {
    describe(room.id, () => {
      it('has a full, rectangular grid of known tiles', () => {
        expect(room.rows).toHaveLength(ROOM_HEIGHT);
        for (const line of room.rows) {
          expect(line).toHaveLength(room.width);
          for (const ch of line) expect(LEGEND.has(ch), `unknown tile "${ch}"`).toBe(true);
        }
      });

      it('has a matching entry marker for every exit', () => {
        if (room.exits.left) {
          expect(ROOMS[room.exits.left], 'left target exists').toBeDefined();
          expect(count(room.rows, 'L')).toBe(1);
          expect(ROOMS[room.exits.left].exits.right).toBe(room.id);
          expect(count(ROOMS[room.exits.left].rows, 'R')).toBe(1);
        }
        if (room.exits.right) {
          expect(ROOMS[room.exits.right], 'right target exists').toBeDefined();
          expect(ROOMS[room.exits.right].exits.left).toBe(room.id);
        }
      });

      it('has one sign text per sign', () => {
        expect(room.signs?.length ?? 0).toBe(count(room.rows, 'S'));
      });

      it('places objects on solid ground', () => {
        room.rows.forEach((line, r) =>
          line.split('').forEach((ch, c) => {
            if (!'@LRpgcxhFSEKGsw'.includes(ch)) return;
            const below = room.rows[r + 1]?.[c];
            expect('#-'.includes(below ?? ''), `${ch} at ${c},${r} floats`).toBe(true);
          }),
        );
      });
    });
  }
});
