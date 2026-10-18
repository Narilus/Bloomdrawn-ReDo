import { describe, expect, it } from 'vitest';
import { apply, cardCost, gainResource, startCombat, type CardDef, type CombatState, type Command, type Registry } from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';

// Domain engines from src/content/domains with the real registry, plus a test Ritual for Anthe.
const ritual: CardDef = {
  id: 'test.ritual', name: 'Ritual', owner: 'anthe', cost: 5, target: 'none', keywords: ['ritual'], effects: [gainResource('essence', 1)],
};
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, [ritual.id]: ritual } };
const DUMMY = 'enemy.training-dummy';

const begin = (party: string[], enemies = [DUMMY]) => startCombat({ seed: 3, party, enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const endTurn: Command = { type: 'endTurn' };

describe('Rapture', () => {
  it('starts damage per hit at 3 only when a Rapture character is in the party', () => {
    expect(begin(['agathe', 'maelia']).resources).toMatchObject({ tentacles: 0, potency: 3 });
    expect(begin(['maelia', 'leonora']).resources['potency']).toBeUndefined();
  });

  it('every Tentacle hits at end of turn, lowest HP first with overflow, and Tentacles stay', () => {
    const state = begin(['agathe', 'maelia'], [DUMMY, DUMMY]);
    state.enemies[1]!.hp = 5;
    Object.assign(state.resources, { tentacles: 3, potency: 4 });
    const after = run(state, endTurn).state;
    // Hit 1 leaves the 5-HP dummy on 1; hit 2 kills it and 3 carries over; hit 3 lands on the other.
    expect(after.enemies.map((e) => e.hp)).toEqual([60 - 3 - 4, 0]);
    expect(after.resources['tentacles']).toBe(3);
  });

  it('damage per hit raised mid-fight lasts into later turns', () => {
    const state = begin(['agathe']);
    Object.assign(state.resources, { tentacles: 2, potency: 5 });
    const one = run(state, endTurn).state;
    const two = run(one, endTurn).state;
    expect([one.enemies[0]!.hp, two.enemies[0]!.hp]).toEqual([50, 40]);
  });
});

describe('Spirit', () => {
  function heldRitual(party: string[]) {
    const state = begin(party);
    const anthe = state.members.find((m) => m.character === 'anthe')!;
    const card = { uid: `c${state.nextUid++}`, card: ritual.id, owner: anthe.id };
    state.piles.hand.push(card);
    return { state, card };
  }

  it('a held Ritual gets 1 cheaper each cleanup and bottoms out at 0', () => {
    const held = heldRitual(['anthe', 'leonora']);
    const { card } = held;
    let { state } = held;
    const costs: number[] = [];
    for (let turn = 0; turn < 7; turn++) {
      state = run(state, endTurn).state;
      costs.push(cardCost(state, state.piles.hand.find((c) => c.uid === card.uid)!, registry));
    }
    expect(costs).toEqual([4, 3, 2, 1, 0, 0, 0]);
  });

  it('played at 0, it resolves and leaves the hand at its printed cost again', () => {
    const held = heldRitual(['anthe']);
    const { card } = held;
    let { state } = held;
    for (let turn = 0; turn < 5; turn++) state = run(state, endTurn).state;
    const after = run(state, { type: 'playCard', card: card.uid }).state;
    expect([after.mana, after.resources['essence']]).toEqual([6, 1]);
    expect(after.piles.discard.find((c) => c.uid === card.uid)).toEqual({ uid: card.uid, card: ritual.id, owner: 'm0' });
  });
});

describe('Poison', () => {
  it('ticks for its stacks at end of turn after Tentacles, ignores Shield and does not decay', () => {
    const state = begin(['agathe'], [DUMMY, DUMMY]);
    Object.assign(state.resources, { tentacles: 1, potency: 3 });
    const target = state.enemies[1]!;
    target.statuses.push({ status: 'status.poison', stacks: 4 });
    target.shield = 50;
    const { state: after, events } = run(state, endTurn);
    expect(after.enemies[1]!.hp).toBe(60 - 4);
    expect(after.enemies[1]!.statuses).toEqual([{ status: 'status.poison', stacks: 4 }]);
    const hits = events.filter((e) => e.type === 'damageDealt').map((e) => [e.source, e.target, e.amount]);
    // The Tentacle hit the first dummy (both at 60, earlier slot wins), then Poison ticked on the second.
    const [first, second] = state.enemies.map((e) => e.id);
    expect(hits).toEqual([
      ['m0', first, 3],
      [second, second, 4],
    ]);
  });

  it('a Poison tick can win the fight', () => {
    const state = begin(['maelia']);
    state.enemies[0]!.hp = 3;
    state.enemies[0]!.statuses.push({ status: 'status.poison', stacks: 3 });
    expect(run(state, endTurn).state.outcome).toBe('victory');
  });
});
