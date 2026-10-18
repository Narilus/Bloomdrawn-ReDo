import { describe, expect, it } from 'vitest';
import { apply, intentOf, previewIntent, startCombat, type CombatState, type Command } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

const HOUND = 'enemy.bloom-rib-hound';
const begin = (enemies = [HOUND]) => startCombat({ seed: 5, party: STARTER_PARTY, enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const endTurn: Command = { type: 'endTurn' };
const shownName = (state: CombatState, i = 0) => intentOf(state.enemies[i]!, registry)?.name;

describe('Bloom-Rib Hound', () => {
  it('shows Bite first, then cycles Bite, Bristle, Maul', () => {
    let state = begin();
    const names = [shownName(state)];
    for (let turn = 0; turn < 4; turn++) {
      state = run(state, endTurn).state;
      names.push(shownName(state));
    }
    expect(names).toEqual(['Bite', 'Bristle', 'Maul', 'Bite', 'Bristle']);
  });

  it('the shown intent number always equals the damage dealt, with and without party Shield', () => {
    let state = begin();
    for (let turn = 0; turn < 6; turn++) {
      // Every other turn, give the party some Shield before ending the turn.
      if (turn % 2 === 1) state.party.shield = 7;
      const shown = previewIntent(state, state.enemies[0]!.id, registry).filter((p) => p.op === 'damage');
      const { state: next, events } = run(state, endTurn);
      const dealt = events.filter((e) => e.type === 'damageDealt' && e.source === state.enemies[0]!.id);
      expect(dealt.map((e) => [e.amount, e.absorbed])).toEqual(shown.map((p) => [p.amount, p.absorbed]));
      state = next;
    }
  });

  it('the party takes Bite 12, Bristle 6, Maul 18', () => {
    let state = begin();
    const hp: number[] = [];
    for (let turn = 0; turn < 3; turn++) {
      state = run(state, endTurn).state;
      hp.push(state.party.hp);
    }
    expect(hp).toEqual([210 - 12, 210 - 18, 210 - 36]);
  });

  it("Bristle's Shield lasts through the party's turn and clears when the Hound next acts", () => {
    let state = run(begin(), endTurn).state;
    state = run(state, endTurn).state; // Bristle
    expect(state.enemies[0]!.shield).toBe(10);
    const before = state.enemies[0]!.hp;
    // Agathe's end-of-turn Tentacle (3) hits the Shield first.
    const after = run(state, endTurn).state;
    expect(after.enemies[0]!.hp).toBe(before);
    expect(after.enemies[0]!.shield).toBe(0);
  });

  it('acts in slot order, and a dead Hound neither acts nor shows an intent', () => {
    const state = begin([HOUND, HOUND]);
    state.enemies[0]!.hp = 0;
    const { events } = run(state, endTurn);
    expect(events.filter((e) => e.type === 'enemyActed').map((e) => e.source)).toEqual([state.enemies[1]!.id]);
    expect(previewIntent(state, state.enemies[0]!.id, registry)).toEqual([]);
  });

  it('a Hound attack that empties the party HP ends the fight in defeat', () => {
    const state = begin();
    state.party.hp = 12;
    const { state: after, events } = run(state, endTurn);
    expect(after.outcome).toBe('defeat');
    expect(events.at(-1)).toEqual({ type: 'combatEnd', outcome: 'defeat' });
    expect(events.some((e) => e.type === 'turnStart')).toBe(false);
  });

  it('killing the Hound wins', () => {
    const state = begin();
    state.enemies[0]!.hp = 3;
    expect(run(state, endTurn).state.outcome).toBe('victory');
  });
});
