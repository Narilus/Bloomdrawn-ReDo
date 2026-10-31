import { describe, expect, it } from 'vitest';
import { apply, startCombat } from './combat.ts';
import type { CardDef, Registry } from './defs.ts';
import { stacks } from './formula.ts';
import { damage } from './ops/damage.ts';
import { gainShield } from './ops/gainShield.ts';
import { heal } from './ops/heal.ts';
import { loseHp } from './ops/loseHp.ts';
import { repeat } from './ops/repeat.ts';
import { volley } from './ops/volley.ts';
import { previewCard } from './preview.ts';
import type { CombatState } from './state.ts';
import { STARTERS, withCardInHand, withCards } from './testing/fixtures.ts';

// Crit (docs/notes/m6-scaling.md, 4.6; owner, 31 Oct): only the party's `damage` hits crit, each hit
// rolled on its own from the `crit` stream, after the incoming multipliers. Status ticks, `loseHp`,
// heals, Shields and enemies never crit. Rolling never shifts another stream, and previews never roll.

const card = (id: string, effects: CardDef['effects'], target: CardDef['target'] = 'chosenEnemy'): CardDef => ({ id, name: id, owner: 'test.a', cost: 0, target, effects });
const cards = [
  card('test.hit', [damage(10)]),
  card('test.flurry', [repeat(20, [damage(10)])]),
  card('test.volley', [volley(20, 10)], 'none'),
  card('test.drain', [loseHp(10, { target: 'chosen' })]),
  card('test.mend', [heal(10)], 'none'),
  card('test.guard', [gainShield(10)], 'self'),
];
/** The fixture party at a crit rate: 50% crit damage, so a crit is × 1.5. */
function at(rate: number): Registry {
  const base = withCards(...cards);
  const characters = Object.fromEntries(Object.entries(base.characters).map(([id, c]) => [id, { ...c, stats: { ...c.stats, critRate: rate } }]));
  return {
    ...base,
    characters,
    statuses: { ...base.statuses, 'test.burn': { id: 'test.burn', stacking: 'add', triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('test.burn'), { status: 'test.burn' })] }] } },
    enemies: { ...base.enemies, 'test.big': { id: 'test.big', name: 'Big', hp: 9999 }, 'test.biter': { id: 'test.biter', name: 'Biter', hp: 9999, intents: [{ id: 'bite', name: 'Bite', effects: [damage(10, { target: 'party' })] }] } },
  };
}
const fight = (registry: Registry, enemies = ['test.big']) => startCombat({ seed: 3, party: STARTERS, enemies }, registry).state;
function play(state: CombatState, id: string, registry: Registry) {
  const [ready, instance] = withCardInHand(state, id);
  const target = registry.cards[id]!.target === 'chosenEnemy' ? { target: ready.enemies[0]!.id } : {};
  const result = apply(ready, { type: 'playCard', card: instance.uid, ...target }, registry);
  if (!result.ok) throw new Error(result.reason);
  return { ready, instance, ...result };
}
const hits = (events: { type: string; amount?: number; crit?: boolean }[]) => events.filter((e) => e.type === 'damageDealt');

describe('crit', () => {
  it('a party damage hit that crits deals × (1 + crit damage), marked on its event', () => {
    const registry = at(100);
    const { events, state } = play(fight(registry), 'test.hit', registry);
    expect(hits(events).map((e) => [e.amount, e.crit])).toEqual([[15, true]]);
    expect(state.enemies[0]!.hp).toBe(9999 - 15);
  });

  it('every hit rolls on its own: repeats and volley hits each crit or not', () => {
    const registry = at(50);
    for (const id of ['test.flurry', 'test.volley']) {
      const amounts = hits(play(fight(registry), id, registry).events).map((e) => e.amount);
      expect(amounts).toHaveLength(20);
      expect(new Set(amounts)).toEqual(new Set([10, 15]));
    }
  });

  it('never on loseHp, status ticks, heals, Shields or anything an enemy does', () => {
    const registry = at(100);
    const drained = play(fight(registry), 'test.drain', registry);
    expect(hits(drained.events).some((e) => e.crit)).toBe(false);
    expect(drained.state.enemies[0]!.hp).toBe(9999 - 10);
    const hurt = { ...fight(registry), party: { ...fight(registry).party, hp: 30 } };
    expect(play(hurt, 'test.mend', registry).state.party.hp).toBe(40);
    expect(play(fight(registry), 'test.guard', registry).state.party.shield).toBe(10);
    const burning = fight(registry);
    burning.enemies[0]!.statuses.push({ status: 'test.burn', stacks: 7 });
    const ticked = apply(burning, { type: 'endTurn' }, registry);
    if (!ticked.ok) throw new Error(ticked.reason);
    expect(ticked.state.enemies[0]!.hp).toBe(9999 - 7);
    const bitten = apply(fight(registry, ['test.biter']), { type: 'endTurn' }, registry);
    if (!bitten.ok) throw new Error(bitten.reason);
    expect(hits(bitten.events).map((e) => [e.amount, e.crit])).toEqual([[10, undefined]]);
  });

  it('rolling crit moves only the crit stream, never the shuffle, targeting or intents', () => {
    const crits = play(fight(at(100)), 'test.flurry', at(100)).state.rng;
    const none = play(fight(at(0)), 'test.flurry', at(0)).state.rng;
    expect([crits.shuffle, crits.targeting, crits.intents]).toEqual([none.shuffle, none.targeting, none.intents]);
    expect(crits.crit).not.toBe(none.crit);
  });

  it('a preview shows the normal number with the crit number and chance beside it, and never rolls', () => {
    const registry = at(30);
    const [state, instance] = withCardInHand(fight(registry), 'test.hit');
    const before = structuredClone(state.rng);
    const preview = previewCard(state, { type: 'playCard', card: instance.uid, target: state.enemies[0]!.id }, registry);
    expect(preview?.find((p) => p.op === 'damage')).toMatchObject({ amount: 10, crit: { amount: 15, rate: 30 } });
    expect(state.rng).toEqual(before);
  });

  it('at no crit chance, no hit crits and the stream never moves', () => {
    const registry = at(0);
    const start = fight(registry);
    const { events, state } = play(start, 'test.flurry', registry);
    expect(hits(events).every((e) => e.amount === 10 && !e.crit)).toBe(true);
    expect(state.rng.crit).toBe(start.rng.crit);
  });
});
