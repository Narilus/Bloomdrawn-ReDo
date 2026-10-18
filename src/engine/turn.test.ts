import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { CardDef, Registry } from './defs.ts';
import { heldTurns, handCount, manaSpent } from './formula.ts';
import { chargeUltimate } from './ops/chargeUltimate.ts';
import { gainResource } from './ops/gainResource.ts';
import { manaDebt } from './ops/manaDebt.ts';
import { repeatNext } from './ops/repeatNext.ts';
import type { CombatState } from './state.ts';
import { fixtureCombat, fixtureRegistry, STARTERS, testGain, withCardInHand, withCards } from './testing/fixtures.ts';

const ritual: CardDef = { id: 'test.a.ritual', name: 'Ritual', owner: 'test.a', cost: 4, target: 'none', keywords: ['ritual'], effects: [testGain('x')] };
const echoNext: CardDef = { id: 'test.a.twice', name: 'Twice', owner: 'test.a', cost: 1, target: 'none', effects: [repeatNext()] };
const bump: CardDef = { id: 'test.a.bump', name: 'Bump', owner: 'test.a', cost: 2, target: 'none', charge: 10, effects: [testGain('bumps')] };
const borrow: CardDef = { id: 'test.a.borrow', name: 'Borrow', owner: 'test.a', cost: 0, target: 'none', effects: [manaDebt(4)] };
const borrowMore: CardDef = { ...borrow, id: 'test.a.borrow-more', effects: [manaDebt(9)] };
const count: CardDef = {
  id: 'test.a.count', name: 'Count', owner: 'test.a', cost: 0, target: 'none',
  effects: [gainResource('rituals', handCount('ritual')), gainResource('held', heldTurns('ritual')), gainResource('spent', manaSpent())],
};
const registry = withCards(ritual, echoNext, bump, borrow, borrowMore, count);

function run(state: CombatState, command: Command, reg: Registry = registry) {
  const result = apply(state, command, reg);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const playUid = (uid: string): Command => ({ type: 'playCard', card: uid });
const endTurn: Command = { type: 'endTurn' };

describe('cleanup and Retain', () => {
  it('a Ritual stays in hand, counts its held turns, and the hand still draws to 5 in total', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.ritual');
    const one = run(state, endTurn).state;
    expect(one.piles.hand.find((c) => c.uid === card.uid)?.held).toBe(1);
    expect(one.piles.hand).toHaveLength(5);
    const two = run(one, endTurn).state;
    expect(two.piles.hand.find((c) => c.uid === card.uid)?.held).toBe(2);
  });

  it('formulas read Rituals in hand, their held turns and the Mana spent', () => {
    const [start, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.ritual');
    const state = run(run(start, endTurn).state, endTurn).state;
    const [withBump, b] = withCardInHand(state, 'test.a.bump');
    const [withCount, c] = withCardInHand(run(withBump, playUid(b.uid)).state, 'test.a.count');
    const after = run(withCount, playUid(c.uid)).state;
    expect(after.piles.hand.some((x) => x.uid === card.uid)).toBe(true);
    expect([after.resources['rituals'], after.resources['held'], after.resources['spent']]).toEqual([1, 2, 2]);
  });

  it('lifecycle order at end of turn: cleanup, turnEnd, statusTick, enemy phase', () => {
    const { events } = run(fixtureCombat(), endTurn);
    const lifecycle = events.map((e) => e.type).filter((t) => ['cleanup', 'turnEnd', 'statusTick', 'enemyPhaseStart', 'turnStart'].includes(t));
    expect(lifecycle).toEqual(['cleanup', 'turnEnd', 'statusTick', 'enemyPhaseStart', 'turnStart']);
  });
});

describe('the next card', () => {
  it('repeatNext makes the next card resolve twice but charge once, and only the next card', () => {
    const [start, twice] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.twice');
    const [s1, b1] = withCardInHand(start, 'test.a.bump');
    const [s2, b2] = withCardInHand(s1, 'test.a.bump');
    let state = run(run(s2, playUid(twice.uid)).state, playUid(b1.uid)).state;
    expect([state.resources['bumps'], state.members[0]?.gauge]).toEqual([2, 10]);
    state = run(state, playUid(b2.uid)).state;
    expect([state.resources['bumps'], state.members[0]?.gauge]).toEqual([3, 20]);
  });

  it('a pending repeat is cleared at cleanup', () => {
    const [state, twice] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.twice');
    expect(run(state, playUid(twice.uid)).state.next.repeat).toBe(1);
    expect(run(run(state, playUid(twice.uid)).state, endTurn).state.next).toEqual({ costDelta: 0, repeat: 0 });
  });
});

describe('Mana debt', () => {
  it('comes off the next refill, then raises manaDebtPaid after the turn draw', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.borrow');
    const { state: next, events } = run(run(state, playUid(card.uid)).state, endTurn);
    expect([next.mana, next.manaDebt]).toEqual([2, 0]);
    const types = events.map((e) => e.type);
    expect(types.lastIndexOf('cardDrawn')).toBeLessThan(types.indexOf('manaDebtPaid'));
    expect(events.find((e) => e.type === 'manaDebtPaid')?.amount).toBe(4);
    expect(run(next, endTurn).state.mana).toBe(6);
  });

  it('never takes Mana below 0, and debt beyond one refill is not carried', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.a.borrow-more');
    const { state: next, events } = run(run(state, playUid(card.uid)).state, endTurn);
    expect([next.mana, next.manaDebt]).toEqual([0, 0]);
    expect(events.find((e) => e.type === 'manaDebtPaid')?.amount).toBe(6);
    expect(run(next, endTurn).state.mana).toBe(6);
  });
});

describe('ultimate gauges', () => {
  it('carry in from the run, clamped to 0–100', () => {
    const { state } = startCombat({ seed: 1, party: STARTERS, enemies: ['test.dummy'], gauges: [70, 150, -5] }, registry);
    expect(state.members.map((m) => m.gauge)).toEqual([70, 100, 0, 0]);
  });
});

describe('Domain hooks', () => {
  const withDomain: Registry = {
    ...fixtureRegistry,
    domains: {
      test: {
        id: 'test', name: 'Test',
        resources: [{ id: 'charge', name: 'Charge', start: 3 }],
        triggers: [{ on: 'turnEnd', do: [testGain('order'), chargeUltimate(5)] }],
      },
    },
    relics: { ...fixtureRegistry.relics, 'test.late': { id: 'test.late', triggers: [{ on: 'turnEnd', do: [testGain('relic')] }] } },
  };

  it('start their resources, and resolve after every other trigger, holding no gauge', () => {
    const begin = startCombat({ seed: 1, party: STARTERS, enemies: ['test.dummy'], relics: ['test.late'] }, withDomain);
    expect(begin.state.resources['charge']).toBe(3);
    const { state, events } = run(begin.state, endTurn, withDomain);
    const gains = events.filter((e) => e.type === 'resourceGained').map((e) => [e.resource, e.source]);
    expect(gains).toEqual([['relic', 'r21'], ['order', 'm0']]);
    expect(state.members.every((m) => m.gauge === 0)).toBe(true);
  });

  it('are inactive when no party member belongs to the Domain', () => {
    const elsewhere = { ...withDomain, domains: { other: withDomain.domains['test']! } };
    const begin = startCombat({ seed: 1, party: STARTERS, enemies: ['test.dummy'] }, elsewhere);
    expect(begin.state.resources['charge']).toBeUndefined();
    expect(run(begin.state, endTurn, elsewhere).events.some((e) => e.resource === 'order')).toBe(false);
  });
});

describe('trigger limits', () => {
  // test.w0 gains 'order' whenever any card is played; this variant does it once a turn, and only
  // for gains raised by a card itself.
  const limited: Registry = {
    ...registry,
    characters: {
      ...registry.characters,
      'test.a': {
        ...registry.characters['test.a']!,
        passive: { triggers: [{ on: 'resourceGained', filter: { resource: 'bumps', direct: true }, once: 'turn', do: [testGain('bumps')] }] },
      },
    },
  };

  it('once a turn: fires on the first matching event only, and again next turn', () => {
    const [s1, a] = withCardInHand(fixtureCombat(['test.dummy'], [], limited), 'test.a.bump');
    const [s2, b] = withCardInHand(s1, 'test.a.bump');
    const turn1 = run(run(s2, playUid(a.uid), limited).state, playUid(b.uid), limited).state;
    // Two plays, one extra from the trigger. The trigger's own gain is not direct, so it doesn't re-fire.
    expect(turn1.resources['bumps']).toBe(3);
    const [s3, c] = withCardInHand(run(turn1, endTurn, limited).state, 'test.a.bump');
    expect(run(s3, playUid(c.uid), limited).state.resources['bumps']).toBe(5);
  });
});
