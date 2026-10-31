import { describe, expect } from 'vitest';
import { describeCardLive } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { scenario } from '../testing/scenario.ts';

// The M3 Symptoms (docs/notes/m3-labyrinth.md). The starter party has 210 max HP, and Maelia stands
// at the front, so she plays them. The training dummy never attacks.
const DUMMY = 'enemy.training-dummy';
const text = (state: Parameters<typeof describeCardLive>[1], id: string) =>
  describeCardLive(state.piles.hand.find((c) => c.card === id)!, state, registry);

describe('Symptoms', () => {
  scenario('Fevered Pulse: +2 Mana, the party loses 4% of its current HP (rounded down), and it Exhausts', {
    setup: { hand: ['symptom.fevered-pulse'], partyHp: 150 },
    play: [{ card: 'symptom.fevered-pulse' }],
    expect: { mana: 6 + 2, partyHp: 150 - 6 },
    check: ({ state, plays }) => {
      expect(text(plays[0]!.before, 'symptom.fevered-pulse')).toBe('Exhaust. Gain 2 Mana. The party loses 6 HP (4% of current).');
      expect(state.piles.graveyard.map((c) => c.card)).toEqual(['symptom.fevered-pulse']);
      expect(plays[0]!.before.piles.hand[0]!.owner).toBe('m0');
    },
  });

  // The front member plays it: Maelia here, 350% of Attack 3 (14 with Agathe, Attack 4, in front).
  scenario("Sweet Rot: 350% of the front member's Attack, and Poison equal to 1% of the party's max HP on every enemy and the party", {
    enemies: [DUMMY, DUMMY],
    setup: { hand: ['symptom.sweet-rot'] },
    play: [{ card: 'symptom.sweet-rot', target: 0 }, { endTurn: true }],
    // The party's Poison lands after the enemy phase.
    expect: { partyHp: 210 - 2 },
    check: ({ plays }) => {
      const after = plays[0]!.after;
      expect(text(plays[0]!.before, 'symptom.sweet-rot')).toBe("Deal 10 damage. Every enemy and the party gain 2 Poison (1% of the party's max HP).");
      expect(after.enemies.map((e) => e.hp)).toEqual([60 - 10, 60]);
      expect(after.enemies.map((e) => e.statuses)).toEqual([
        [{ status: 'status.poison', stacks: 2 }],
        [{ status: 'status.poison', stacks: 2 }],
      ]);
      expect(after.party.statuses).toEqual([{ status: 'status.poison', stacks: 2 }]);
    },
  });

  scenario('Grafted Hand: draw 2 now, and 1 fewer at the start of next turn', {
    setup: { hand: ['symptom.grafted-hand'] },
    play: [{ card: 'symptom.grafted-hand' }, { endTurn: true }],
    expect: { handSize: 4 },
    check: ({ plays }) => {
      expect(plays[0]!.after.piles.hand).toHaveLength(2);
      expect(text(plays[0]!.before, 'symptom.grafted-hand')).toBe('Draw 2 cards. Next turn, draw 1 fewer card.');
    },
  });

  scenario('Pollen Lung: every member gains 15 ultimate charge, and the party gains 1 Weak', {
    setup: { hand: ['symptom.pollen-lung'] },
    play: [{ card: 'symptom.pollen-lung' }],
    expect: { gauges: { maelia: 15, agathe: 15, anthe: 15, leonora: 15 }, mana: 5 },
    check: ({ state }) => expect(state.party.statuses).toEqual([{ status: 'status.weak', stacks: 1, fresh: 1 }]),
  });
});
