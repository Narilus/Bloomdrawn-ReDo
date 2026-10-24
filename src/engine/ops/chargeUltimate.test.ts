import { describe, expect, it } from 'vitest';
import { apply } from '../combat.ts';
import type { CardDef } from '../defs.ts';
import { formulaText } from '../formula.ts';
import { previewCard } from '../preview.ts';
import { fixtureCombat, withCardInHand, withCards } from '../testing/fixtures.ts';
import { chargeUltimate, chargeUltimateOp } from './chargeUltimate.ts';
import { gainShield } from './gainShield.ts';

const guard: CardDef = { id: 'test.b.guard', name: 'Guard', owner: 'test.b', cost: 1, target: 'none', charge: 10, effects: [gainShield(1)] };
const registry = withCards(guard);

describe('chargeUltimate', () => {
  it('charges the owner, or every party member, and caps at 100', () => {
    const state = fixtureCombat(['test.dummy'], [], registry);
    state.members[1]!.gauge = 95;
    chargeUltimateOp.resolve(state, chargeUltimate(10), { source: 'm1', owner: 'm1' }, registry);
    expect(state.members.map((m) => m.gauge)).toEqual([0, 100, 0, 0]);
    const { events } = chargeUltimateOp.resolve(state, chargeUltimate(10, 'party'), { source: 'm0', owner: 'm0' }, registry);
    expect(state.members.map((m) => m.gauge)).toEqual([10, 100, 10, 10]);
    expect(events.map((e) => [e.target, e.amount])).toEqual([['m0', 10], ['m1', 0], ['m2', 10], ['m3', 10]]);
  });

  it('has no one to charge without an owner', () => {
    const state = fixtureCombat(['test.dummy'], [], registry);
    expect(chargeUltimateOp.validate?.(state, chargeUltimate(10), { source: 'e20' }, registry)).toBeDefined();
  });

  it('a card with charge charges its owner once when played, after its effects, and previews it', () => {
    const [state, card] = withCardInHand(fixtureCombat(['test.dummy'], [], registry), 'test.b.guard', 'm1');
    const command = { type: 'playCard' as const, card: card.uid };
    expect(previewCard(state, command, registry)?.map((p) => p.op)).toEqual(['gainShield', 'chargeUltimate']);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.members[1]?.gauge).toBe(10);
    expect(result.events.map((e) => e.type)).toEqual(['cardPlayed', 'shieldGained', 'ultimateCharged']);
  });

  it('describes itself', () => {
    expect(chargeUltimateOp.describe(chargeUltimate(10), formulaText, registry)).toBe("Charge its owner's ultimate by 10");
    expect(chargeUltimateOp.describe(chargeUltimate(10, 'party'), formulaText, registry)).toBe("Charge every party member's ultimate by 10");
  });
});
