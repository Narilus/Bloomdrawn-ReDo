import { describe, expect, it } from 'vitest';
import { apply } from '../combat.ts';
import { consumed, formulaText, mul } from '../formula.ts';
import { previewCard } from '../preview.ts';
import { fixtureCombat, withCardInHand, withCards } from '../testing/fixtures.ts';
import { damage } from './damage.ts';
import { gainResource } from './gainResource.ts';
import { ifConsume, ifConsumeOp } from './ifConsume.ts';

const spender = {
  id: 'test.a.spender',
  owner: 'test.a',
  cost: 1,
  target: 'chosenEnemy' as const,
  effects: [damage(2), ifConsume('embryo', 2, [damage(mul(5, consumed()))])],
};
// The bonus branch hits the chosen target, which the first operation has just killed.
const overkill = { ...spender, id: 'test.a.overkill', effects: [damage(99), ifConsume('embryo', 2, [damage(1)])] };
const registry = withCards(spender, overkill);

function play(card: string, embryo: number, enemies = ['test.dummy']) {
  const start = fixtureCombat(enemies, [], registry);
  start.resources['embryo'] = embryo;
  const [state, instance] = withCardInHand(start, card);
  const command = { type: 'playCard' as const, card: instance.uid, target: 'e20' };
  const preview = previewCard(state, command, registry);
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return { preview, state: result.state, events: result.events };
}

describe('ifConsume', () => {
  it('spends the resource and resolves the branch, which can read the amount consumed', () => {
    const { state, events, preview } = play('test.a.spender', 3);
    expect(state.resources['embryo']).toBe(1);
    expect(state.enemies[0]?.hp).toBe(40 - 2 - 10);
    expect(events.filter((e) => e.type === 'resourceConsumed')).toEqual([
      { type: 'resourceConsumed', source: 'm0', owner: 'm0', resource: 'embryo', amount: 2 },
    ]);
    expect(preview).toEqual([
      { op: 'damage', target: 'e20', amount: 2, absorbed: 0 },
      {
        op: 'ifConsume',
        resource: 'embryo',
        amount: 2,
        resolves: true,
        branch: [{ op: 'damage', target: 'e20', amount: 10, absorbed: 0 }],
      },
    ]);
  });

  it('spends nothing when there is not enough to consume', () => {
    const { state, events, preview } = play('test.a.spender', 1);
    expect(state.resources['embryo']).toBe(1);
    expect(state.enemies[0]?.hp).toBe(38);
    expect(events.some((e) => e.type === 'resourceConsumed')).toBe(false);
    expect(preview?.[1]).toEqual({ op: 'ifConsume', resource: 'embryo', amount: 2, resolves: false });
  });

  it('spends nothing when its branch cannot resolve', () => {
    const { state, events } = play('test.a.overkill', 5, ['test.dummy', 'test.dummy']);
    expect(state.enemies[0]?.hp).toBe(0);
    expect(state.resources['embryo']).toBe(5);
    expect(events.some((e) => e.type === 'resourceConsumed')).toBe(false);
  });

  it('describes itself', () => {
    const call = ifConsume('embryo', 2, [damage(5), gainResource('tentacles', 1)]);
    expect(ifConsumeOp.describe(call, formulaText, registry)).toBe('Consume 2 Embryo: deal 5 damage, gain 1 Tentacles');
  });
});
