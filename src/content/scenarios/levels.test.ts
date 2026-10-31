import { describe, expect } from 'vitest';
import { statsAt } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario, STARTER_PARTY, type ScenarioPlay } from '../testing/scenario.ts';

// Growth (docs/notes/m6-scaling.md, 4.4–4.5; owner, 31 Oct, placeholders): stats grow by role with
// level and ascension. Strike and Defense are ratios of Attack and Defense, so a grown character's
// cards show and do her grown numbers. The party's HP is its members' HP added up.

/** Each character's Strike as a share of her Attack, and Defense as a share of her Defense (today's level-1 numbers ÷ stat). */
const STRIKE: Record<string, number> = { maelia: 3, agathe: 2.5, anthe: 3, leonora: 2.2, virelle: 2, isadora: 2.2, kibane: 2.2, hester: 2.5 };
const DEFENSE: Record<string, number> = { maelia: 2, agathe: 2.25, anthe: 2, leonora: 2.67, virelle: 3.5, isadora: 2.67, kibane: 2.67, hester: 2.25 };
const share = (ratio: number, stat: number) => Math.floor(ratio * stat + 1e-9);

/** Every damage and Shield number the preview showed is what the play actually did. */
function previewMatchesResult({ preview, events }: ScenarioPlay) {
  const shown = preview.filter((p) => p.op === 'damage' || p.op === 'gainShield');
  const done = events.filter((e) => e.type === 'damageDealt' || e.type === 'shieldGained');
  expect(shown.length).toBeGreaterThan(0);
  expect(done.map((e) => [e.target, e.amount, e.absorbed ?? 0])).toEqual(shown.map((p) => [p.target, p.amount, p.absorbed ?? 0]));
}

const BANNER = ['virelle', 'isadora', 'kibane', 'hester'];
const DUMMY_HP = 60;
const BIG_HP = 9999;

describe('a levelled character', () => {
  // A Support at level 21 with two ascensions: HP 270, Attack 11, Defense 22; 300% and 200% of them.
  scenario('Maelia at level 21 with two ascensions: her Strike and Defense preview and do 33 and 44', {
    levels: { maelia: 21 },
    ascensions: { maelia: 2 },
    setup: { hand: ['maelia.strike', 'maelia.defense'] },
    play: [{ card: 'maelia.strike', target: 0 }, { card: 'maelia.defense' }],
    expect: { enemyHp: [DUMMY_HP - 33], partyShield: 44 },
    check: ({ state, plays }) => {
      plays.forEach(previewMatchesResult);
      expect(state.party.maxHp).toBe(270 + 50 + 60 + 45);
    },
  });

  for (const [party, level] of [[STARTER_PARTY, 40], [BANNER, 20]] as const) {
    for (const who of party) {
      const def = registry.characters[who]!;
      const ascensions = level === 40 ? 3 : 1;
      const stats = statsAt(def.stats, def.role, level, ascensions);
      scenario(`${who} at level ${level}: Strike then Defense preview equals result, at her grown stats`, {
        party: [...party],
        // A grown Strike would fell the 60-HP dummy: the big one.
        enemies: ['enemy.practice-dummy'],
        levels: { [who]: level },
        ascensions: { [who]: ascensions },
        setup: { hand: [`${who}.strike`, `${who}.defense`] },
        play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
        expect: { enemyHp: [BIG_HP - share(STRIKE[who]!, stats.attack)], partyShield: share(DEFENSE[who]!, stats.defense) },
        check: ({ plays }) => plays.forEach(previewMatchesResult),
      });
    }
  }

  // An Attacker at level 21, no ascension: C2's 7 Attack × (1 + 8 × 0.359) is 27, and her Strike 200% of it, 54; C2's 50 HP × (1 + 5 × 0.359) is 140.
  scenario('growth starts from her stats at her dupe level: Virelle at C2 and level 21 has Attack 27', {
    party: BANNER,
    dupes: { virelle: 2 },
    levels: { virelle: 21 },
    setup: { hand: ['virelle.strike'] },
    play: [{ card: 'virelle.strike', target: 0 }],
    expect: { enemyHp: [DUMMY_HP - 54] },
    check: ({ plays, state }) => {
      plays.forEach(previewMatchesResult);
      expect(state.party.maxHp).toBe(140 + 50 + 50 + 55);
    },
  });
});
