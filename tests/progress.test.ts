import { describe, expect, it } from 'vitest';
import { addExp, applyDeath, applyLevelChoice, damageTaken, deserialize, expToNext, newGame, serialize, swordDamage } from '../src/progress';

describe('leveling', () => {
  it('follows floor(20 * level^1.5)', () => {
    expect(expToNext(1)).toBe(20);
    expect(expToNext(5)).toBe(223);
    expect(expToNext(10)).toBe(632);
  });

  it('carries over EXP and can level up several times', () => {
    const s = newGame();
    s.hp = 1;
    const ups = addExp(s, 20 + 56 + 5); // Lv1->2 needs 20, Lv2->3 needs 56
    expect(ups).toBe(2);
    expect(s.level).toBe(3);
    expect(s.exp).toBe(5);
    expect(s.hp).toBe(s.hpMax);
  });

  it('does not level up below the threshold', () => {
    const s = newGame();
    expect(addExp(s, 19)).toBe(0);
    expect(s.level).toBe(1);
  });

  it('applies each stat choice', () => {
    const s = newGame();
    applyLevelChoice(s, 'hp');
    applyLevelChoice(s, 'atk');
    applyLevelChoice(s, 'mag');
    expect(s.hpMax).toBe(12);
    expect(s.atk).toBe(4);
    expect(s.mpMax).toBe(24);
    expect(s.mag).toBe(4);
  });
});

describe('combat math', () => {
  it('always deals at least 1 damage', () => {
    expect(damageTaken(2, 5)).toBe(1);
    expect(damageTaken(5, 2)).toBe(3);
    expect(swordDamage(3, 1.6)).toBe(5);
    expect(swordDamage(0, 1)).toBe(1);
  });

  it('death costs 10% of coins and restores HP/MP', () => {
    const s = newGame();
    s.coins = 105;
    s.hp = 0;
    s.mp = 0;
    expect(applyDeath(s, 0.1)).toBe(10);
    expect(s.coins).toBe(95);
    expect(s.hp).toBe(s.hpMax);
    expect(s.mp).toBe(s.mpMax);
  });
});

describe('save data', () => {
  it('round-trips', () => {
    const s = newGame();
    s.coins = 42;
    s.flags.bossWolf = true;
    s.opened.push('forest1:31,8');
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects broken data', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"version":2}')).toBeNull();
  });

  it('fills in fields missing from older saves', () => {
    const d = deserialize('{"version":1,"room":"forest3","level":4}');
    expect(d?.abilities).toEqual({ doubleJump: false, bolt: false });
    expect(d?.opened).toEqual([]);
    expect(d?.room).toBe('forest3');
  });
});
