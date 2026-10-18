import { describe, expect } from 'vitest';
import { scenario, STARTER_PARTY, type ScenarioPlay } from '../testing/scenario.ts';

/** Every damage and Shield number the preview showed is what the play actually did. */
function previewMatchesResult({ preview, events }: ScenarioPlay) {
  const shown = preview.filter((p) => p.op === 'damage' || p.op === 'gainShield');
  const done = events.filter((e) => e.type === 'damageDealt' || e.type === 'shieldGained');
  expect(shown.length).toBeGreaterThan(0);
  expect(done.map((e) => [e.target, e.amount, e.absorbed ?? 0])).toEqual(
    shown.map((p) => [p.target, p.amount, p.absorbed ?? 0]),
  );
}

describe('starter Strikes and Defenses', () => {
  scenario('Maelia\'s Strike into the dummy: preview equals result', {
    setup: { hand: ['maelia.strike'] },
    play: [{ card: 'maelia.strike', target: 0 }],
    expect: { enemyHp: [60 - (6 + 4)], mana: 5 },
    check: ({ plays }) => previewMatchesResult(plays[0] as ScenarioPlay),
  });

  for (const who of STARTER_PARTY) {
    scenario(`${who}: Strike then Defense preview equals result`, {
      setup: { hand: [`${who}.strike`, `${who}.defense`] },
      play: [{ card: `${who}.strike`, target: 0 }, { card: `${who}.defense` }],
      expect: { partyShield: 5 + 4, handSize: 0, mana: 4 },
      check: ({ plays }) => plays.forEach(previewMatchesResult),
    });
  }
});
