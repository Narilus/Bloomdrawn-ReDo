import { describe, expect, it } from 'vitest';
import { formulaText, stacks } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { PARTY } from '../state.ts';
import { loseHp, loseHpOp } from './loseHp.ts';

describe('loseHp', () => {
  it('takes HP from the source, ignoring Shield, and reads its own stacks', () => {
    const state = fixtureCombat();
    const enemy = state.enemies[0]!;
    enemy.shield = 10;
    enemy.statuses.push({ status: 'test.add', stacks: 7 });
    const call = loseHp(stacks('test.add'));
    expect(loseHpOp.preview(state, call, { source: enemy.id }, registry)).toEqual([{ op: 'loseHp', target: enemy.id, amount: 7, absorbed: 0 }]);
    const { events } = loseHpOp.resolve(state, call, { source: enemy.id }, registry);
    expect([enemy.hp, enemy.shield]).toEqual([33, 10]);
    expect(events[0]).toEqual({ type: 'damageDealt', source: enemy.id, target: enemy.id, amount: 7, absorbed: 0 });
  });

  it('with blockedByShield, Shield absorbs it first, and preview matches', () => {
    const state = fixtureCombat();
    const enemy = state.enemies[0]!;
    enemy.shield = 5;
    const call = loseHp(7, { blockedByShield: true });
    expect(loseHpOp.preview(state, call, { source: enemy.id }, registry)).toEqual([{ op: 'loseHp', target: enemy.id, amount: 7, absorbed: 5 }]);
    const { events } = loseHpOp.resolve(state, call, { source: enemy.id }, registry);
    expect([enemy.hp, enemy.shield]).toEqual([38, 0]);
    expect(events[0]).toMatchObject({ amount: 7, absorbed: 5 });
    expect(loseHpOp.describe(call, formulaText, registry)).toBe('Take 7 damage');
  });

  it('a party member loses from the shared pool', () => {
    const state = fixtureCombat();
    loseHpOp.resolve(state, loseHp(5), { source: 'm2' }, registry);
    expect(state.party.hp).toBe(75);
    expect(loseHpOp.preview(state, loseHp(5), { source: 'm2' }, registry)[0]?.target).toBe(PARTY);
  });

  it('reports a kill and fizzles on the dead', () => {
    const state = fixtureCombat(['test.frail']);
    const enemy = state.enemies[0]!;
    const { events } = loseHpOp.resolve(state, loseHp(9), { source: enemy.id }, registry);
    expect(events.at(-1)).toEqual({ type: 'enemyDefeated', source: enemy.id, target: enemy.id });
    expect(loseHpOp.validate?.(state, loseHp(1), { source: enemy.id }, registry)).toBeDefined();
  });

  it('describes itself', () => {
    expect(loseHpOp.describe(loseHp(stacks('status.poison')), formulaText, registry)).toBe('Lose Poison HP');
  });
});
