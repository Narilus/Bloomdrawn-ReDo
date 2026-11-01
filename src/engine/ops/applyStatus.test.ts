import { describe, expect, it } from 'vitest';
import { formulaText } from '../formula.ts';
import type { Registry } from '../defs.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { applyStatus, applyStatusOp } from './applyStatus.ts';

const ctx = { source: 'm0', owner: 'm0', target: 'e20' };
const stacksAfter = (status: string, first: number, second: number) => {
  const draft = fixtureCombat();
  applyStatusOp.resolve(draft, applyStatus({ id: status }, first), ctx, registry);
  applyStatusOp.resolve(draft, applyStatus({ id: status }, second), ctx, registry);
  return draft.enemies[0]?.statuses;
};

describe('applyStatus', () => {
  it('applies stacks to the chosen target, and preview matches', () => {
    const draft = fixtureCombat();
    const call = applyStatus({ id: 'test.add' }, 3);
    expect(applyStatusOp.preview(draft, call, ctx, registry)).toEqual([
      { op: 'applyStatus', target: 'e20', status: 'test.add', amount: 3 },
    ]);
    const { events } = applyStatusOp.resolve(draft, call, ctx, registry);
    expect(draft.enemies[0]?.statuses).toEqual([{ status: 'test.add', stacks: 3 }]);
    expect(events).toEqual([{ type: 'statusApplied', source: 'm0', target: 'e20', status: 'test.add', amount: 3 }]);
  });

  it('follows the status stacking rule', () => {
    expect(stacksAfter('test.add', 3, 2)).toEqual([{ status: 'test.add', stacks: 5 }]);
    expect(stacksAfter('test.refresh', 3, 2)).toEqual([{ status: 'test.refresh', stacks: 2 }]);
    expect(stacksAfter('test.highest', 3, 2)).toEqual([{ status: 'test.highest', stacks: 3 }]);
  });

  // Owner, 19 Oct: statuses on the party side land on the whole party.
  it("can target the source's side, which for a party member is the whole party, and needs a living bearer", () => {
    const draft = fixtureCombat();
    applyStatusOp.resolve(draft, applyStatus({ id: 'test.add' }, 1, 'self'), ctx, registry);
    expect(draft.party.statuses).toEqual([{ status: 'test.add', stacks: 1 }]);
    expect(applyStatusOp.validate?.(draft, applyStatus({ id: 'test.add' }, 1), { source: 'm0' }, registry)).toBeDefined();
  });

  it("an add's status goes to the ally that leads it, a Boss or a summoner, else to itself (a Trial's Talismans)", () => {
    const withBoss: Registry = {
      ...registry,
      enemies: { ...registry.enemies, 'test.boss': { id: 'test.boss', name: 'Boss', hp: 100, phases: [{ name: 'Second', hp: 100, rouse: { id: 'r', name: 'R', effects: [] }, intents: [{ id: 'a', name: 'A', effects: [] }] }] } },
    };
    const chant = applyStatus({ id: 'test.add' }, 1, 'leader');
    const led = fixtureCombat(['test.dummy', 'test.boss', 'test.dummy'], [], withBoss);
    applyStatusOp.resolve(led, chant, { source: led.enemies[2]!.id }, withBoss);
    expect(led.enemies.map((e) => e.statuses.length)).toEqual([0, 1, 0]);
    const alone = fixtureCombat(['test.dummy', 'test.dummy'], [], withBoss);
    applyStatusOp.resolve(alone, chant, { source: alone.enemies[1]!.id }, withBoss);
    expect(alone.enemies.map((e) => e.statuses.length)).toEqual([0, 1]);
    expect(applyStatusOp.describe(chant, formulaText, withBoss)).toBe('Apply 1 Test.add to its leader');
  });

  it('describes itself', () => {
    expect(applyStatusOp.describe(applyStatus({ id: 'status.bleed' }, 2), formulaText, registry)).toBe('Apply 2 Bleed');
  });

  it('applies to every living enemy with allEnemies', () => {
    const draft = fixtureCombat(['test.dummy', 'test.dummy', 'test.dummy']);
    draft.enemies[1]!.hp = 0;
    const { events } = applyStatusOp.resolve(draft, applyStatus({ id: 'test.add' }, 2, 'allEnemies'), { source: 'm0' }, registry);
    expect(events.map((e) => e.target)).toEqual(['e20', 'e22']);
    expect(draft.enemies.map((e) => e.statuses.length)).toEqual([1, 0, 1]);
    expect(applyStatusOp.describe(applyStatus({ id: 'status.poison' }, 2, 'allEnemies'), formulaText, registry)).toBe(
      'Apply 2 Poison to all enemies',
    );
  });
});
