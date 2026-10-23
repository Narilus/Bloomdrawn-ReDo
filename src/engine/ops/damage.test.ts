import { describe, expect, it } from 'vitest';
import { add, formulaText, stat } from '../formula.ts';
import type { OpContext } from '../operation.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { damage, damageOp } from './damage.ts';

const strike = damage(add(6, stat('attack')));
const fromM0 = (target?: string): OpContext => ({ source: 'm0', owner: 'm0', ...(target ? { target } : {}) });

function hit(state = fixtureCombat(), call = strike, ctx = fromM0('e20')) {
  const preview = damageOp.preview(state, call, ctx, registry);
  const draft = structuredClone(state);
  const { events } = damageOp.resolve(draft, call, ctx, registry);
  return { preview, draft, events };
}

describe('damage', () => {
  it('deals base + owner Attack to the chosen enemy, and preview matches', () => {
    const { preview, draft, events } = hit();
    expect(preview).toEqual([{ op: 'damage', target: 'e20', amount: 9, absorbed: 0 }]);
    expect(draft.enemies[0]?.hp).toBe(40 - 9);
    expect(events.map((e) => e.type)).toEqual(['damageDealt', 'damageTaken']);
    expect(events[0]).toMatchObject({ source: 'm0', owner: 'm0', target: 'e20', amount: 9, absorbed: 0 });
  });

  it('adds flat outgoing modifiers, then floors incoming multipliers', () => {
    const state = fixtureCombat(['test.dummy'], ['test.plus3']);
    state.enemies[0]?.statuses.push({ status: 'test.exposed', stacks: 1 });
    // Base 1 + 3 Attack = 4; + 3 flat = 7; × 1.5 = 10.5, floored to 10.
    const { preview, draft } = hit(state, damage(add(1, stat('attack'))));
    expect(preview[0]?.amount).toBe(10);
    expect(draft.enemies[0]?.hp).toBe(30);
  });

  it('Shield absorbs first, unless the hit ignores Shield', () => {
    const state = fixtureCombat();
    (state.enemies[0] as { shield: number }).shield = 5;
    const blocked = hit(state);
    expect(blocked.preview[0]).toMatchObject({ amount: 9, absorbed: 5 });
    expect(blocked.draft.enemies[0]).toMatchObject({ hp: 36, shield: 0 });

    const piercing = hit(state, damage(add(6, stat('attack')), { ignoresShield: true }));
    expect(piercing.draft.enemies[0]).toMatchObject({ hp: 31, shield: 5 });
  });

  it('can hit the shared party pool', () => {
    const state = fixtureCombat();
    state.party.shield = 4;
    const { draft, preview } = hit(state, damage(10, { target: 'party' }), { source: 'e20' });
    expect(preview).toEqual([{ op: 'damage', target: 'party', amount: 10, absorbed: 4 }]);
    expect(draft.party).toMatchObject({ hp: 74, shield: 0 });
  });

  it('defeats an enemy at 0 HP and cannot target a dead or missing one', () => {
    const state = fixtureCombat(['test.frail', 'test.dummy']);
    const { draft, events } = hit(state, damage(99));
    expect(draft.enemies[0]?.hp).toBe(0);
    expect(events.at(-1)).toMatchObject({ type: 'enemyDefeated', target: 'e20' });
    expect(damageOp.validate?.(draft, strike, fromM0('e20'), registry)).toBeDefined();
    expect(damageOp.validate?.(draft, strike, fromM0(), registry)).toBeDefined();
    expect(damageOp.validate?.(draft, strike, fromM0('e21'), registry)).toBeUndefined();
  });

  it('can hit every living enemy, each with its own Shield and modifiers, with vitals after each hit', () => {
    const state = fixtureCombat(['test.dummy', 'test.frail', 'test.dummy']);
    (state.enemies[0] as { shield: number }).shield = 4;
    state.enemies[2]?.statuses.push({ status: 'test.exposed', stacks: 1 });
    const call = damage(add(6, stat('attack')), { target: 'allEnemies' });
    const { preview, draft, events } = hit(state, call, fromM0());
    // 6 + 3 Attack = 9; × 1.5 on the exposed one = 13.
    expect(preview).toEqual([
      { op: 'damage', target: 'e20', amount: 9, absorbed: 4 },
      { op: 'damage', target: 'e21', amount: 9, absorbed: 0 },
      { op: 'damage', target: 'e22', amount: 13, absorbed: 0 },
    ]);
    expect(draft.enemies.map((e) => e.hp)).toEqual([40 - 5, 0, 40 - 13]);
    expect(events.map((e) => `${e.type}:${e.target}`)).toEqual([
      'damageDealt:e20', 'damageTaken:e20',
      'damageDealt:e21', 'damageTaken:e21', 'enemyDefeated:e21',
      'damageDealt:e22', 'damageTaken:e22',
    ]);
    const { vitals } = damageOp.resolve(structuredClone(state), call, fromM0(), registry);
    expect(vitals?.map((v) => v.enemies.map((e) => e.hp))).toEqual([
      [35, 5, 40], [35, 5, 40],
      [35, 0, 40], [35, 0, 40], [35, 0, 40],
      [35, 0, 27], [35, 0, 27],
    ]);
    expect(damageOp.validate?.(draft, call, fromM0(), registry)).toBeUndefined();
    draft.enemies.forEach((e) => (e.hp = 0));
    expect(damageOp.validate?.(draft, call, fromM0(), registry)).toBeDefined();
  });

  it('describes itself', () => {
    expect(damageOp.describe(strike, formulaText, registry)).toBe('Deal 6 + Attack damage');
    expect(damageOp.describe(damage(5, { target: 'party' }), formulaText, registry)).toBe('Deal 5 damage to the party');
    expect(damageOp.describe(damage(5, { target: 'allEnemies' }), formulaText, registry)).toBe('Deal 5 damage to all enemies');
  });
});
