import { describe, expect, it } from 'vitest';
import { startCombat } from './combat.ts';
import type { Role } from './defs.ts';
import { characterOf } from './dupes.ts';
import { critOf, statsAt, withGrowth } from './levels.ts';
import { fixtureRegistry, STARTERS } from './testing/fixtures.ts';

// Character growth (docs/notes/m6-scaling.md, 4.4–4.6; owner, 31 Oct, placeholders): by role, 70%
// of the growth from levels 1 to 40 and 10% from each ascension, so level 40 with three ascensions
// is base × the role's multiplier. Attackers gain crit at each ascension.

const BASE = { hp: 55, attack: 3, defense: 5 };
/** [level, ascensions] → [HP, Attack, Defense], from the formula by hand. */
const AT: [number, number][] = [[1, 0], [10, 0], [10, 1], [20, 1], [20, 2], [30, 3], [40, 3]];
const EXPECTED: Record<Role, [number, number, number][]> = {
  attacker: [[55, 3, 5], [99, 7, 8], [127, 9, 10], [176, 14, 14], [204, 16, 16], [281, 23, 21], [330, 27, 25]],
  sentinel: [[55, 3, 5], [126, 5, 11], [170, 6, 15], [249, 8, 23], [293, 9, 27], [416, 13, 38], [495, 15, 45]],
  support: [[55, 3, 5], [117, 5, 10], [156, 7, 13], [225, 10, 18], [263, 11, 21], [371, 15, 30], [440, 18, 35]],
  hybrid: [[55, 3, 5], [108, 6, 10], [141, 8, 13], [201, 12, 18], [234, 14, 21], [326, 19, 30], [385, 23, 35]],
};

describe('character growth', () => {
  for (const role of Object.keys(EXPECTED) as Role[]) {
    it(`${role}: stats at 1, 10 before and after ascending, 20, 30 and 40 follow the formula`, () => {
      const got = AT.map(([level, ascensions]) => statsAt(BASE, role, level, ascensions)).map((s) => [s.hp, s.attack, s.defense]);
      expect(got).toEqual(EXPECTED[role]);
    });
  }

  it('an ascension is a step: the same level with one more ascension is stronger', () => {
    expect(statsAt(BASE, 'hybrid', 10, 1).attack).toBeGreaterThan(statsAt(BASE, 'hybrid', 10, 0).attack);
  });

  it('every character crits 5% of hits for 150%; Attackers gain 5% rate and 10% damage per ascension, others none', () => {
    expect(critOf(BASE)).toEqual({ rate: 5, damage: 50 });
    expect(critOf(statsAt(BASE, 'attacker', 30, 3))).toEqual({ rate: 20, damage: 80 });
    expect(critOf(statsAt(BASE, 'attacker', 9, 0))).toEqual({ rate: 5, damage: 50 });
    expect(critOf(statsAt(BASE, 'support', 30, 3))).toEqual({ rate: 5, damage: 50 });
    expect(critOf({ ...BASE, critRate: 140 })).toEqual({ rate: 100, damage: 50 });
  });

  it('level 1 with no ascension is the character unchanged, so older states and the golden replay read the same', () => {
    const def = fixtureRegistry.characters[STARTERS[0]!]!;
    expect(withGrowth(def)).toBe(def);
    expect(withGrowth(def, 1, 0)).toBe(def);
    const state = startCombat({ seed: 1, party: [...STARTERS], enemies: ['test.dummy'] }, fixtureRegistry).state;
    expect(state.members.some((m) => 'level' in m || 'ascensions' in m)).toBe(false);
  });

  it('a member keeps her level and ascensions in combat state, and the party HP adds up the grown members', () => {
    const at = (setup: { levels?: number[]; ascensions?: number[] } = {}) => startCombat({ seed: 1, party: [...STARTERS], enemies: ['test.dummy'], ...setup }, fixtureRegistry).state;
    const grown = at({ levels: [21, 1, 1, 1], ascensions: [2, 0, 0, 0] });
    expect(grown.members.map((m) => [m.level, m.ascensions])).toEqual([[21, 2], [undefined, undefined], [undefined, undefined], [undefined, undefined]]);
    const def = fixtureRegistry.characters[STARTERS[0]!]!;
    const stats = statsAt(def.stats, def.role, 21, 2);
    expect(characterOf(grown.members[0]!, fixtureRegistry)?.stats).toEqual(stats);
    expect(grown.party.maxHp - at().party.maxHp).toBe(stats.hp - def.stats.hp);
  });
});
