import { describe, expect } from 'vitest';
import { statsAtLevel } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario, STARTER_PARTY, type ScenarioPlay } from '../testing/scenario.ts';

// Levels (owner, 29 Oct, placeholders): each level past 1 adds 2.5% of base HP, Attack and Defense,
// rounded. Strike is 6 + Attack and Defense 5 + Defense for everyone, so a levelled character's
// cards show and do her levelled numbers. The party's HP is its members' HP added up.

/** Every damage and Shield number the preview showed is what the play actually did. */
function previewMatchesResult({ preview, events }: ScenarioPlay) {
  const shown = preview.filter((p) => p.op === 'damage' || p.op === 'gainShield');
  const done = events.filter((e) => e.type === 'damageDealt' || e.type === 'shieldGained');
  expect(shown.length).toBeGreaterThan(0);
  expect(done.map((e) => [e.target, e.amount, e.absorbed ?? 0])).toEqual(shown.map((p) => [p.target, p.amount, p.absorbed ?? 0]));
}

const BANNER = ['virelle', 'isadora', 'kibane', 'hester'];
const DUMMY_HP = 60;

describe('a levelled character', () => {
  scenario('Maelia at level 21 (×1.5): Attack 5, Defense 8, HP 83; her Strike and Defense preview and do 11 and 13', {
    levels: { maelia: 21 },
    setup: { hand: ['maelia.strike', 'maelia.defense'] },
    play: [{ card: 'maelia.strike', target: 0 }, { card: 'maelia.defense' }],
    expect: { enemyHp: [DUMMY_HP - 11], partyShield: 13 },
    check: ({ state, plays }) => {
      plays.forEach(previewMatchesResult);
      expect(state.party.maxHp).toBe(83 + 50 + 60 + 45);
    },
  });

  for (const [party, level] of [[STARTER_PARTY, 40], [BANNER, 20]] as const) {
    for (const who of party) {
      const stats = statsAtLevel(registry.characters[who]!.stats, level);
      scenario(`${who} at level ${level}: Strike then Defense preview equals result, at her levelled stats`, {
        party: [...party],
        levels: { [who]: level },
        setup: { hand: [`${who}.strike`, `${who}.defense`] },
        play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
        expect: { enemyHp: [DUMMY_HP - 6 - stats.attack], partyShield: 5 + stats.defense },
        check: ({ plays }) => plays.forEach(previewMatchesResult),
      });
    }
  }

  scenario('levels grow her stats at her dupe level: Virelle at C2 and level 21 has Attack 11 (7 × 1.5, rounded)', {
    party: BANNER,
    dupes: { virelle: 2 },
    levels: { virelle: 21 },
    setup: { hand: ['virelle.strike'] },
    play: [{ card: 'virelle.strike', target: 0 }],
    expect: { enemyHp: [DUMMY_HP - 17] },
    check: ({ plays, state }) => {
      plays.forEach(previewMatchesResult);
      // C2's 50 HP × 1.5.
      expect(state.party.maxHp).toBe(75 + 50 + 50 + 55);
    },
  });
});
