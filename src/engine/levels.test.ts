import { describe, expect, it } from 'vitest';
import { startCombat } from './combat.ts';
import { characterOf } from './dupes.ts';
import { statsAtLevel, withLevel } from './levels.ts';
import { fixtureRegistry, STARTERS } from './testing/fixtures.ts';

// Levels (owner, 29 Oct, placeholders): each level past 1 adds 2.5% of base HP, Attack and Defense, rounded.

describe('levels', () => {
  it('each level past 1 adds 2.5% of base, rounded; level 1 is the stats as written', () => {
    const base = { hp: 55, attack: 3, defense: 5 };
    expect(statsAtLevel(base, 1)).toEqual(base);
    expect(statsAtLevel(base, 2)).toEqual({ hp: 56, attack: 3, defense: 5 });
    expect(statsAtLevel(base, 21)).toEqual({ hp: 83, attack: 5, defense: 8 });
    expect(statsAtLevel(base, 40)).toEqual({ hp: 109, attack: 6, defense: 10 });
  });

  it('level 1, or none, is the character unchanged, so older states and the golden replay read the same', () => {
    const def = fixtureRegistry.characters[STARTERS[0]!]!;
    expect([withLevel(def), withLevel(def, 1)]).toEqual([def, def]);
    expect(withLevel(def, 1)).toBe(def);
    const state = startCombat({ seed: 1, party: [...STARTERS], enemies: ['test.dummy'] }, fixtureRegistry).state;
    expect(state.members.some((m) => 'level' in m)).toBe(false);
  });

  it('a member keeps her level in combat state, and the party HP adds up the levelled members', () => {
    const at = (levels?: number[]) => startCombat({ seed: 1, party: [...STARTERS], enemies: ['test.dummy'], ...(levels && { levels }) }, fixtureRegistry).state;
    const levelled = at([21, 1, 1, 1]);
    expect(levelled.members.map((m) => m.level)).toEqual([21, undefined, undefined, undefined]);
    const def = fixtureRegistry.characters[STARTERS[0]!]!;
    expect(characterOf(levelled.members[0]!, fixtureRegistry)?.stats).toEqual(statsAtLevel(def.stats, 21));
    expect(levelled.party.maxHp - at().party.maxHp).toBe(statsAtLevel(def.stats, 21).hp - def.stats.hp);
  });
});
