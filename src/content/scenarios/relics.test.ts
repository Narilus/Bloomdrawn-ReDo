import { describe, expect, it } from 'vitest';
import { apply, startCombat, type CombatState, type Command } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// The first relics (docs/notes/m2-content.md), against a training dummy that never attacks.
const DUMMY = 'enemy.training-dummy';
const begin = (relics: string[]) => startCombat({ seed: 8, party: STARTER_PARTY, enemies: [DUMMY], relics }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const endTurn: Command = { type: 'endTurn' };
function hold(state: CombatState, card: string) {
  const owner = state.members.find((m) => m.character === registry.cards[card]?.owner)!;
  const instance = { uid: `c${state.nextUid++}`, card, owner: owner.id };
  state.piles.hand.push(instance);
  return instance;
}

describe('relics', () => {
  it('Brass Thimble: +1 Mana on the first turn only', () => {
    const state = begin(['relic.brass-thimble']);
    expect([state.mana, run(state, endTurn).state.mana]).toEqual([7, 6]);
  });

  it('Seed Packet: 2 Embryo at combat start', () => {
    expect(begin(['relic.seed-packet']).resources['embryo']).toBe(2);
  });

  it('Cracked Reliquary: Strike and Defense charge 5 more; other cards no more', () => {
    const state = begin(['relic.cracked-reliquary']);
    const strike = hold(state, 'agathe.strike');
    const choir = hold(state, 'agathe.call-the-choir');
    const struck = run(state, { type: 'playCard', card: strike.uid, target: state.enemies[0]!.id }).state;
    expect(struck.members[1]!.gauge).toBe(15);
    expect(run(struck, { type: 'playCard', card: choir.uid }).state.members[1]!.gauge).toBe(15);
  });

  it('Vigil Wax: a held Ritual at turn start draws a 6th card; without one, nothing', () => {
    const state = begin(['relic.vigil-wax']);
    const without = run(begin(['relic.vigil-wax']), endTurn).state;
    hold(state, 'anthe.votive-candle');
    expect([run(state, endTurn).state.piles.hand.length, without.piles.hand.length]).toEqual([6, 5]);
  });

  it("Midwife's Shears: consuming Embryo puts 1 Vulnerable on every enemy", () => {
    const state = begin(['relic.midwifes-shears']);
    state.resources['embryo'] = 2;
    const card = hold(state, 'maelia.bud-cutting');
    const after = run(state, { type: 'playCard', card: card.uid }).state;
    expect(after.enemies[0]!.statuses).toEqual([{ status: 'status.vulnerable', stacks: 1 }]);
  });

  it('Choir Bell: the Tentacles also volley at turn start', () => {
    const state = begin(['relic.choir-bell']);
    // Turn 1 start: First Hymn's Tentacle hits for 3. End of turn: 3. Turn 2 start: 3.
    expect(state.enemies[0]!.hp).toBe(60 - 3);
    expect(run(state, endTurn).state.enemies[0]!.hp).toBe(60 - 9);
  });

  it('Blooming Coin: +1 Mana every turn, and 3 damage to the party at turn start', () => {
    const state = begin(['relic.blooming-coin']);
    const next = run(state, endTurn).state;
    expect([state.mana, state.party.hp, next.mana, next.party.hp]).toEqual([7, 207, 7, 204]);
  });

  it('relic triggers resolve in acquisition order', () => {
    const order = (relics: string[]) => {
      const { state, events } = startCombat({ seed: 8, party: STARTER_PARTY, enemies: [DUMMY], relics }, registry);
      return events
        .filter((e) => e.type === 'resourceGained' && e.resource === 'mana')
        .map((e) => state.relics.find((r) => r.id === e.source)?.relic);
    };
    expect(order(['relic.brass-thimble', 'relic.blooming-coin'])).toEqual(['relic.brass-thimble', 'relic.blooming-coin']);
    expect(order(['relic.blooming-coin', 'relic.brass-thimble'])).toEqual(['relic.blooming-coin', 'relic.brass-thimble']);
  });
});
