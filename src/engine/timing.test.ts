import { describe, expect, it } from 'vitest';
import { apply, startCombat } from './combat.ts';
import type { EnemyDef, Registry, StatusDef } from './defs.ts';
import { applyStatus, applyStatusOp } from './ops/applyStatus.ts';
import { damage } from './ops/damage.ts';
import { PARTY, type CombatState } from './state.ts';
import { fixtureRegistry, STARTERS } from './testing/fixtures.ts';

// When a status takes hold (owner, 20 Oct). The enemies' turn plays as one moment, so what an
// enemy applies during it takes hold once it is over: shown numbers never change against you
// mid-turn. Everything else takes hold at once: your statuses (even when a relic reacts during
// the enemy turn) and an enemy's own reactions during your turn.

const statuses: StatusDef[] = [
  // A lasting enemy buff with no turn count.
  { id: 'test.mighty', stacking: 'add', modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 2 }] },
  { id: 'test.feeble', stacking: 'add', lasts: 'ownTurns', modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 0.5 }] },
];
const enemies: EnemyDef[] = [
  { id: 'test.biter', name: 'Biter', hp: 40, intents: [{ id: 'bite', name: 'Bite', effects: [damage(10, { target: 'party' })] }] },
  { id: 'test.rallier', name: 'Rallier', hp: 40, intents: [{ id: 'rally', name: 'Rally', effects: [applyStatus({ id: 'test.mighty' }, 1, 'allEnemies')] }] },
];
const registry: Registry = {
  ...fixtureRegistry,
  statuses: { ...fixtureRegistry.statuses, ...Object.fromEntries(statuses.map((s) => [s.id, s])) },
  enemies: { ...fixtureRegistry.enemies, ...Object.fromEntries(enemies.map((e) => [e.id, e])) },
  // Whenever damage is taken (in the enemy turn: the party's), every enemy becomes Feeble.
  relics: {
    ...fixtureRegistry.relics,
    'test.spite': { id: 'test.spite', triggers: [{ on: 'damageTaken', do: [applyStatus({ id: 'test.feeble' }, 1, 'allEnemies')] }] },
  },
};
const start = (enemies: string[], relics: string[] = []) => startCombat({ seed: 1, party: STARTERS, enemies, relics }, registry).state;
const endTurn = (state: CombatState) => {
  const result = apply(state, { type: 'endTurn' }, registry);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

describe('when a status takes hold', () => {
  it("an enemy's buff in the enemy turn waits for the turn to end, even without a turn count", () => {
    const state = start(['test.rallier', 'test.biter']);
    const first = endTurn(state);
    expect(state.party.hp - first.party.hp).toBe(10); // Rally came first, but the Bite is unchanged
    const second = endTurn(first);
    expect(first.party.hp - second.party.hp).toBe(20); // from the next enemy turn it holds
  });

  it('a status the party applies during the enemy turn holds at once', () => {
    const state = start(['test.biter', 'test.biter'], ['test.spite']);
    const after = endTurn(state);
    // The first Bite makes both Biters Feeble; the second Bite is already halved.
    expect(state.party.hp - after.party.hp).toBe(10 + 5);
  });

  it("an enemy's status outside the enemy turn holds at once", () => {
    const draft = structuredClone(start(['test.biter']));
    const biter = draft.enemies[0]!.id;
    applyStatusOp.resolve(draft, applyStatus({ id: 'test.feeble' }, 1), { source: biter, target: PARTY }, registry);
    expect(draft.party.statuses).toEqual([{ status: 'test.feeble', stacks: 1, fresh: 1 }]);
  });
});
