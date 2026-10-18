import { describe, expect, it } from 'vitest';
import { add, formulaText, resource } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { gainResource, gainResourceOp } from './gainResource.ts';

describe('gainResource', () => {
  it('adds to the pooled resource, and preview matches', () => {
    const draft = fixtureCombat();
    draft.resources['embryo'] = 2;
    const call = gainResource('embryo', add(1, resource('embryo')));
    const ctx = { source: 'm2', owner: 'm2' };
    expect(gainResourceOp.preview(draft, call, ctx, registry)).toEqual([{ op: 'gainResource', resource: 'embryo', amount: 3 }]);
    const { events } = gainResourceOp.resolve(draft, call, ctx, registry);
    expect(draft.resources['embryo']).toBe(5);
    expect(events).toEqual([{ type: 'resourceGained', source: 'm2', owner: 'm2', resource: 'embryo', amount: 3 }]);
  });

  it('describes itself', () => {
    expect(gainResourceOp.describe(gainResource('tentacles', 2), formulaText, registry)).toBe('Gain 2 Tentacles');
  });
});
