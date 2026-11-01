import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { CardDef, EnemyDef, Registry, StatusDef } from './defs.ts';
import { stacks } from './formula.ts';
import { applyStatus, damage, loseHp, volley } from './ops/index.ts';
import { previewCard } from './preview.ts';
import type { CombatState } from './state.ts';
import { fixtureRegistry, STARTERS, testGain } from './testing/fixtures.ts';

// A status that wards damage (the Cocooned Scout, docs/notes/bestiary.md): applied by the enemy's
// own action, it lasts until its next one. Damage passes it by; statuses still land and tick.

const ward: StatusDef = { id: 'test.ward', stacking: 'highest', endsAfterAction: true, wardsDamage: true };
const rot: StatusDef = {
  id: 'test.rot', stacking: 'add',
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('test.rot'))] }],
};
const cocooner: EnemyDef = {
  id: 'test.cocooner', name: 'Cocooner', hp: 30,
  intents: [
    { id: 'wrap', name: 'Wrap', effects: [applyStatus(ward, 1, 'self')] },
    { id: 'open', name: 'Open', effects: [testGain('open')] },
  ],
};
const card = (id: string, effects: CardDef['effects'], target: CardDef['target'] = 'chosenEnemy'): CardDef => ({ id, name: id, owner: 'test.a', cost: 0, target, effects });
const cards = [
  card('test.poke', [damage(5)]),
  card('test.drain', [loseHp(5, { target: 'chosen' })]),
  card('test.rot', [applyStatus(rot, 3)]),
  card('test.volley', [volley(2, 10)], 'none'),
];
const registry: Registry = {
  ...fixtureRegistry,
  cards: { ...fixtureRegistry.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) },
  enemies: { ...fixtureRegistry.enemies, 'test.cocooner': cocooner },
  statuses: { ...fixtureRegistry.statuses, 'test.ward': ward, 'test.rot': rot },
};

function play(state: CombatState, id: string, target: string | null = state.enemies[0]!.id) {
  const next = structuredClone(state);
  const uid = `c${next.nextUid++}`;
  next.piles.hand.push({ uid, card: id, owner: 'm0' });
  const command: Command = { type: 'playCard', card: uid, ...(target !== null ? { target } : {}) };
  const result = apply(next, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return { ...result, preview: previewCard(next, command, registry) };
}
const endTurn = (state: CombatState) => {
  const result = apply(state, { type: 'endTurn' }, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
};
/** The turn after the Cocooner has wrapped itself. */
const wrapped = (enemies = ['test.cocooner']) => endTurn(startCombat({ seed: 1, party: STARTERS, enemies }, registry).state).state;
const hp = (state: CombatState) => state.enemies.map((e) => e.hp);

describe('a status that wards damage', () => {
  it('lasts past the action that applied it, through the next turn', () => {
    expect(wrapped().enemies[0]!.statuses).toEqual([{ status: 'test.ward', stacks: 1 }]);
  });

  it('passes damage by, previews included; HP loss and statuses still land', () => {
    const state = wrapped();
    const poked = play(state, 'test.poke');
    expect(poked.preview).toEqual([{ op: 'damage', target: state.enemies[0]!.id, amount: 0, absorbed: 0 }]);
    expect(hp(poked.state)).toEqual([30]);
    expect(hp(play(state, 'test.drain').state)).toEqual([25]);
    expect(play(state, 'test.rot').state.enemies[0]!.statuses).toContainEqual({ status: 'test.rot', stacks: 3 });
  });

  it('lets damage over time tick through it', () => {
    const rotted = play(wrapped(), 'test.rot').state;
    expect(hp(endTurn(rotted).state)).toEqual([27]);
  });

  it('volleys pass a warded enemy by', () => {
    // The Cocooner has the lower HP, so unwarded it would take the hits.
    expect(hp(play(wrapped(['test.cocooner', 'test.dummy']), 'test.volley', null).state)).toEqual([30, 20]);
  });

  it('ends after its next action, as its own doing rather than control; then damage lands', () => {
    const { state, events } = endTurn(wrapped());
    expect(state.resources['open']).toBe(1);
    expect(state.enemies[0]!.statuses).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'statusRemoved', status: 'test.ward' }));
    expect(events.some((e) => e.type === 'controlled')).toBe(false);
    expect(hp(play(state, 'test.poke').state)).toEqual([25]);
  });
});
