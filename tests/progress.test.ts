import { describe, expect, it } from 'vitest';
import { addExp, applyDeath, applyLevelChoice, attackPower, buy, damageTaken, deserialize, equip, expToNext, maxHp, newGame, serialize, swordDamage, useHeal } from '../src/progress';

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
    expect(deserialize('{"version":3,"room":"x","level":1}')).toBeNull();
  });

  it('upgrades prototype (v1) saves', () => {
    const d = deserialize('{"version":1,"room":"forest3","level":4,"abilities":{"doubleJump":true,"bolt":false}}');
    expect(d?.version).toBe(2);
    expect(d?.abilities.doubleJump).toBe(true);
    expect(d?.abilities.rift).toBe(false);
    expect(d?.opened).toEqual([]);
    expect(d?.equip.sword).toBe('apprentice');
    expect(d?.room).toBe('forest3');
  });
});

describe('equipment and items', () => {
  it('buys, equips and counts equipment', () => {
    const s = newGame();
    s.coins = 1000;
    expect(buy(s, 'equip', 'machete')).toBe('ok');
    expect(buy(s, 'equip', 'machete')).toBe('owned');
    expect(s.coins).toBe(700);
    expect(equip(s, 'machete')).toBe(true);
    expect(attackPower(s)).toBe(5);
  });

  it('allows two charms at most and toggles them', () => {
    const s = newGame();
    s.owned.push('magnet', 'vigor', 'feather');
    expect(equip(s, 'magnet')).toBe(true);
    expect(equip(s, 'vigor')).toBe(true);
    expect(maxHp(s)).toBe(14);
    expect(equip(s, 'feather')).toBe(false);
    expect(equip(s, 'magnet')).toBe(true); // unequip
    expect(s.equip.charms).toEqual(['vigor']);
  });

  it('refuses items when broke or full', () => {
    const s = newGame();
    s.coins = 10;
    expect(buy(s, 'item', 'potion')).toBe('poor');
    s.coins = 1000;
    s.items.potion = 5;
    expect(buy(s, 'item', 'potion')).toBe('full');
  });

  it('heals with the smallest item that makes sense', () => {
    const s = newGame();
    s.items = { potion: 1, bigPotion: 1, ether: 0 };
    s.hp = 7;
    expect(useHeal(s)).toBe('potion');
    s.hp = 1;
    s.hpMax = 20;
    expect(useHeal(s)).toBe('bigPotion');
    expect(s.hp).toBe(20);
  });

  it('halves damage in easy mode', () => {
    const s = newGame();
    s.easy = true;
    expect(damageTaken(5, 0, s)).toBe(3);
  });
});

describe('shard count repair', () => {
  it('raises the shard count to the shard bosses beaten', async () => {
    const { deserialize, newGame, serialize } = await import('../src/progress');
    const s = newGame();
    Object.assign(s.flags, { boss_golem: true, boss_tempest: true, boss_levia: true, boss_ignia: true });
    s.fragments = 3;
    expect(deserialize(serialize(s))?.fragments).toBe(4);
    s.flags = { boss_golem: true };
    s.fragments = 1;
    expect(deserialize(serialize(s))?.fragments).toBe(1);
  });
});
