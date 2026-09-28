import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { EVENTS } from '../src/data/events';
import { EQUIPMENT } from '../src/data/items';
import { ROOMS, START_ROOM } from '../src/data/rooms/index';
import { parseRoom } from '../src/world/parse';

const KNOWN = new Set('#-^&%=|+@FTSBLX*pgcxhmyui0123456789sbwreftjnzovq.'.split(''));
const count = (rows: string[], ch: string) => rows.join('').split(ch).length - 1;
const RESERVED = 'FTSBLX';

describe('world', () => {
  it('starts in a room with a spawn point', () => {
    expect(count(ROOMS[START_ROOM].rows, '@') + count(ROOMS[START_ROOM].rows, 'F')).toBeGreaterThan(0);
  });

  for (const room of Object.values(ROOMS)) {
    describe(room.id, () => {
      const parsed = parseRoom(room);

      it('is a rectangular grid of known tiles, at least one screen big', () => {
        expect(room.rows.length).toBeGreaterThanOrEqual(17);
        const w = room.rows[0].length;
        expect(w).toBeGreaterThanOrEqual(30);
        for (const line of room.rows) {
          expect(line).toHaveLength(w);
          for (const ch of line) {
            const npc = ch >= 'A' && ch <= 'Z' && !RESERVED.includes(ch);
            expect(KNOWN.has(ch) || npc, `unknown tile "${ch}"`).toBe(true);
          }
        }
      });

      it('links every marker both ways', () => {
        const digits = new Set(parsed.links.map((m) => m.ch));
        for (const d of digits) {
          expect(count(room.rows, d), `marker ${d} appears once`).toBe(1);
          const link = room.links[d];
          expect(link, `link ${d} is defined`).toBeDefined();
          const target = ROOMS[link.to];
          expect(target, `room ${link.to} exists`).toBeDefined();
          expect(count(target.rows, link.at), `${link.to} has marker ${link.at}`).toBe(1);
          const back = target.links[link.at];
          expect(back?.to, `${link.to}:${link.at} links back`).toBe(room.id);
          expect(back?.at).toBe(d);
        }
        for (const d of Object.keys(room.links)) expect(digits.has(d), `link ${d} is placed`).toBe(true);
      });

      it('names every NPC and sign', () => {
        for (const m of parsed.objects) {
          if (m.ch >= 'A' && m.ch <= 'Z' && !RESERVED.includes(m.ch)) {
            const id = room.npcs?.[m.ch];
            expect(id, `NPC letter ${m.ch}`).toBeDefined();
            expect(NPCS[id!], `NPC ${id}`).toBeDefined();
          }
        }
        expect(room.signs?.length ?? 0).toBe(count(room.rows, 'S'));
        expect(room.items?.length ?? 0).toBe(count(room.rows, 'i'));
        for (const it of room.items ?? []) expect(it.startsWith('quest:') || ['potion', 'bigPotion', 'ether'].includes(it) || !!EQUIPMENT[it], it).toBe(true);
      });

      it('references existing events and a boss marker when it has a boss', () => {
        if (room.onEnter) expect(EVENTS[room.onEnter], room.onEnter).toBeDefined();
        for (const t of room.triggers ?? []) expect(EVENTS[t.event], t.event).toBeDefined();
        if (room.boss) expect(count(room.rows, 'B')).toBe(1);
      });

      it('places objects on something solid', () => {
        for (const m of parsed.objects) {
          if (!'@FTSpgcxhmyuiLX'.includes(m.ch) && !(m.ch >= 'A' && m.ch <= 'Z')) continue;
          if (m.ch === '*' || m.ch === 'B') continue;
          const below = room.rows[m.row + 1]?.[m.col];
          expect('#-=%&'.includes(below ?? ''), `${m.ch} at ${m.col},${m.row} floats`).toBe(true);
        }
      });

      it('keeps heart-vessel chests out of single-jump reach', () => {
        const rows = room.rows;
        const standable = (c: number, r: number) => '#-='.includes(rows[r][c]) && (r === 0 || !'#-='.includes(rows[r - 1][c]));
        rows.forEach((line, r) =>
          line.split('').forEach((ch, c) => {
            if (ch !== 'h') return;
            const ledge = r + 1;
            for (let rr = 0; rr < rows.length; rr++)
              for (let cc = Math.max(0, c - 8); cc <= Math.min(line.length - 1, c + 8); cc++) {
                if (!standable(cc, rr) || rr === ledge) continue;
                const rise = rr - ledge;
                expect(rise <= 0 || rise >= 5, `step at ${cc},${rr} reaches chest at ${c},${r}`).toBe(true);
              }
          }),
        );
      });
    });
  }
});
