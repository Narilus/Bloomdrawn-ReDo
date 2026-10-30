import { describe, expect, it } from 'vitest';
import type { Registry } from '../engine/index.ts';
import { affordableLevels, ascend, ascensionCost, expToNext, levelCap, levelCost, levelUp, MAX_LEVEL, moneyToNext, payExp } from './levels.ts';
import { NEW_PROFILE, type Profile } from './profile.ts';

// Levels, Memories and ascension (owner, 29 Oct, placeholders): the next level costs 100 × the
// current level in EXP and 20 × it in Ducats; Faint, Clear and Vivid Memories are 100, 500 and 2,000
// EXP; ascension at 10, 20 and 30 costs 1, 2 and 3 of the Domain's material plus 1,000, 3,000 and 6,000 Ducats.

const F = 'memory.faint';
const C = 'memory.clear';
const V = 'memory.vivid';
const MAT = 'material.test';
const registry = { characters: { ana: { domain: 'test' } }, domains: { test: { material: MAT } } } as unknown as Registry;
const withItems = (items: Record<string, number>, extra: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, items, ...extra });

describe('the cost of a level', () => {
  it('is 100 × the current level in EXP and 20 × it in Ducats; level 1 to 40 is 78,000 EXP', () => {
    expect([expToNext(1), expToNext(9), moneyToNext(1), moneyToNext(9)]).toEqual([100, 900, 20, 180]);
    expect(levelCost(1, 9)).toEqual({ exp: 4500, money: 900 });
    expect(levelCost(1, MAX_LEVEL - 1)).toEqual({ exp: 78000, money: 15600 });
  });
});

describe('paying EXP in Memories', () => {
  it('spends the smallest first, then as many bigger ones as cover the rest', () => {
    expect(payExp({ [F]: 3, [C]: 1 }, 300)).toEqual({ [F]: 0, [C]: 1 });
    expect(payExp({ [F]: 2, [C]: 3, [V]: 1 }, 1200)).toEqual({ [F]: 0, [C]: 1, [V]: 1 });
  });

  it('refunds what a bigger Memory overpays as smaller ones', () => {
    expect(payExp({ [C]: 1 }, 300)).toEqual({ [C]: 0, [F]: 2 });
    expect(payExp({ [V]: 1 }, 300)).toEqual({ [V]: 0, [C]: 3, [F]: 2 });
    expect(payExp({ [F]: 1, [V]: 1 }, 600)).toEqual({ [F]: 0, [V]: 0, [C]: 3 });
  });

  it("can't pay more than the Memories are worth", () => {
    expect(payExp({ [F]: 2, [C]: 1 }, 800)).toBeUndefined();
    expect(payExp({}, 100)).toBeUndefined();
    expect(payExp({}, 0)).toEqual({});
  });
});

describe('levelling up', () => {
  it('raises her level and pays for every level, Ducats included, refunding the excess', () => {
    const result = levelUp(withItems({ [C]: 1, money: 100 }), 'ana', 2);
    // Levels 1 → 3: 100 + 200 EXP and 20 + 40 Ducats.
    expect(result).toEqual({
      ok: true,
      level: 3,
      profile: withItems({ [F]: 2, money: 40 }, { levels: { ana: 3 } }),
      change: { [C]: -1, [F]: 2, money: -60 },
    });
  });

  it('refuses what the profile can\'t pay, and changes nothing', () => {
    expect(levelUp(withItems({ [F]: 1 }), 'ana', 2)).toEqual({ ok: false, reason: 'This needs 300 EXP in Memories.' });
    expect(levelUp(withItems({ [F]: 3, money: 59 }), 'ana', 2)).toEqual({ ok: false, reason: 'This needs 60 Ducats.' });
    expect(levelUp(withItems({ [V]: 9, money: 9999 }), 'ana', 0).ok).toBe(false);
  });

  it('stops at 10, 20 and 30 until she ascends, and at 40 for good', () => {
    const rich = withItems({ [V]: 99, money: 999999, [MAT]: 9 });
    expect(levelUp(rich, 'ana', 10)).toEqual({ ok: false, reason: 'Level 10 needs an ascension first.' });
    const at10 = levelUp(rich, 'ana', 9);
    expect(at10.ok && at10.level).toBe(10);
    if (!at10.ok) return;
    expect(levelUp(at10.profile, 'ana', 1).ok).toBe(false);
    expect(affordableLevels(at10.profile, 'ana')).toBe(0);
    const ascended = ascend(at10.profile, 'ana', registry);
    expect(ascended.ok && levelUp(ascended.profile, 'ana', 10).ok).toBe(true);
    const top = withItems(rich.items!, { levels: { ana: MAX_LEVEL }, ascensions: { ana: 3 } });
    expect(levelUp(top, 'ana', 1)).toEqual({ ok: false, reason: 'Level 40 is the highest.' });
    expect([levelCap(0), levelCap(1), levelCap(2), levelCap(3)]).toEqual([10, 20, 30, 40]);
  });

  it('as far as can be paid for counts only whole levels up to the next cap', () => {
    // 100 + 200 + 300 EXP is three levels; the fourth needs 400 more.
    expect(affordableLevels(withItems({ [F]: 9, money: 9999 }), 'ana')).toBe(3);
    expect(affordableLevels(withItems({ [F]: 9, money: 59 }), 'ana')).toBe(1);
    expect(affordableLevels(withItems({ [V]: 99, money: 999999 }), 'ana')).toBe(9);
  });
});

describe('ascension', () => {
  const at = (level: number, ascensions = 0, items: Record<string, number> = { [MAT]: 9, money: 99999 }) =>
    withItems(items, { levels: { ana: level }, ...(ascensions && { ascensions: { ana: ascensions } }) });

  it("costs 1, 2 and 3 of her Domain's material and 1,000, 3,000 and 6,000 Ducats", () => {
    expect([0, 1, 2].map((n) => ascensionCost(at(10, n), 'ana', registry))).toEqual([
      { [MAT]: 1, money: 1000 },
      { [MAT]: 2, money: 3000 },
      { [MAT]: 3, money: 6000 },
    ]);
    expect(ascensionCost(at(40, 3), 'ana', registry)).toBeUndefined();
    expect(ascend(at(20, 1), 'ana', registry)).toEqual({
      ok: true,
      level: 20,
      profile: { ...at(20, 2), pulls: at(20, 2).pulls + 1, items: { [MAT]: 7, money: 96999 } },
      change: { [MAT]: -2, money: -3000 },
      pulls: 1,
    });
  });

  it('gives one Purified Bloom at each of the three ascensions, and a refusal gives none', () => {
    let profile = at(10);
    const start = profile.pulls;
    const pulls = [start];
    for (const level of [10, 20, 30]) {
      profile = { ...profile, levels: { ana: level } };
      const ascended = ascend(profile, 'ana', registry);
      if (!ascended.ok) throw new Error(ascended.reason);
      profile = ascended.profile;
      pulls.push(profile.pulls);
    }
    expect(pulls).toEqual([start, start + 1, start + 2, start + 3]);
    expect(ascend(at(9), 'ana', registry)).toMatchObject({ ok: false });
  });

  it('needs her level cap, the material and the Ducats, and refuses otherwise', () => {
    expect(ascend(at(9), 'ana', registry)).toEqual({ ok: false, reason: 'Ascension needs level 10.' });
    expect(ascend(at(10, 0, { money: 99999 }), 'ana', registry)).toEqual({ ok: false, reason: 'This needs more than the profile has.' });
    expect(ascend(at(10, 0, { [MAT]: 1, money: 999 }), 'ana', registry).ok).toBe(false);
    expect(ascend(at(40, 3), 'ana', registry)).toEqual({ ok: false, reason: 'Every ascension is made.' });
    expect(ascend(at(10, 0, { [MAT]: 1, money: 1000 }), 'ana', registry)).toMatchObject({ ok: true, profile: { items: {}, ascensions: { ana: 1 } } });
  });
});
