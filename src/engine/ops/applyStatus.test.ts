import { describe, expect, it } from 'vitest';
import { formulaText } from '../formula.ts';
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

  it('can target the source, and needs a living bearer', () => {
    const draft = fixtureCombat();
    applyStatusOp.resolve(draft, applyStatus({ id: 'test.add' }, 1, 'self'), ctx, registry);
    expect(draft.members[0]?.statuses).toEqual([{ status: 'test.add', stacks: 1 }]);
    expect(applyStatusOp.validate?.(draft, applyStatus({ id: 'test.add' }, 1), { source: 'm0' }, registry)).toBeDefined();
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
