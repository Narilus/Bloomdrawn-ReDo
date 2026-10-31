import { describe, expect, it } from 'vitest';
import { apply, cardCost, domainCounters, gainResource, startCombat, type CardDef, type CombatState, type Command, type Registry } from '../../engine/index.ts';
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
  it("starts damage per hit at 80% of the party's average Attack, only when a Rapture character is in the party", () => {
    // Agathe's First Hymn adds the 1 Tentacle; the Domain starts it at 0. Attack 4 and 3 average 3.5: 2.8 a hit.
    const pair = begin(['agathe', 'maelia']).resources;
    expect([pair['tentacles'], pair['potency']]).toEqual([1, expect.closeTo(2.8)]);
    expect(begin(['agathe', 'maelia', 'anthe', 'leonora']).resources['potency']).toBe(3);
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
    // Anthe's Vigil has also been adding Essence each turn; the Ritual adds 1 more.
    expect([after.mana, after.resources['essence']]).toEqual([6, (state.resources['essence'] ?? 0) + 1]);
    expect(after.piles.discard.find((c) => c.uid === card.uid)).toEqual({ uid: card.uid, card: ritual.id, owner: 'm0' });
  });
});

describe('Poison', () => {
  // Owner, 19 Oct: Shield blocks Poison.
  it('ticks for its stacks at end of turn after Tentacles, Shield blocks it, and it does not decay', () => {
    const state = begin(['agathe'], [DUMMY, DUMMY]);
    Object.assign(state.resources, { tentacles: 1, potency: 3 });
    const target = state.enemies[1]!;
    target.statuses.push({ status: 'status.poison', stacks: 4 });
    target.shield = 3;
    const { state: after, events } = run(state, endTurn);
    expect(after.enemies[1]!.hp).toBe(60 - 1);
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

describe('HUD counters', () => {
  it('one badge per Domain present: Tentacles as count × damage per hit, the rest as a count', () => {
    const state = begin(['agathe', 'maelia', 'anthe', 'leonora']);
    Object.assign(state.resources, { tentacles: 3, potency: 5, embryo: 4, essence: 2 });
    // Each badge also carries its icon and help text; the numbers are what's checked here.
    expect(domainCounters(state, registry).map(({ domain, count, each, total }) => ({ domain, count, each, total }))).toEqual([
      { domain: 'rapture', count: 3, each: 5, total: 15 },
      { domain: 'flesh', count: 4, each: undefined, total: undefined },
      { domain: 'spirit', count: 2, each: undefined, total: undefined },
    ]);
    expect(domainCounters(state, registry).map((c) => c.icon)).toEqual(['tentacle', 'embryo', 'essence']);
  });
});
