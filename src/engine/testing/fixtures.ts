// Tiny fixture registry for engine tests. Uses custom operations so engine-core tests
// don't depend on the shared operation library.
import { z } from 'zod';
import { startCombat } from '../combat.ts';
import type { CardDef, CharacterDef, OpCall, Registry, RelicDef, StatusDef, TriggerDef } from '../defs.ts';
import type { EngineEvent } from '../events.ts';
import type { Operation } from '../operation.ts';
import { isAlive, type CardInstance, type CombatState } from '../state.ts';

interface GainArgs extends OpCall {
  resource: string;
  amount: number;
}
interface HitArgs extends OpCall {
  amount: number;
}

// Fixture operations skip previews and text; the library operations have their own tests.
const loose = { args: z.looseObject({ op: z.string() }), preview: () => [], describe: () => 'test' };

const gain: Operation<GainArgs> = {
  ...loose,
  resolve(draft, { resource, amount }, ctx) {
    draft.resources[resource] = (draft.resources[resource] ?? 0) + amount;
    return { events: [{ type: 'resourceGained', source: ctx.source, resource, amount }] };
  },
};

const hit: Operation<HitArgs> = {
  ...loose,
  validate(state, _args, ctx) {
    const target = state.enemies.find((e) => e.id === ctx.target);
    return target && isAlive(target) ? undefined : 'No living target.';
  },
  resolve(draft, { amount }, ctx) {
    const target = draft.enemies.find((e) => e.id === ctx.target);
    if (!target) return { events: [] };
    target.hp = Math.max(0, target.hp - amount);
    const events: EngineEvent[] = [{ type: 'damageDealt', source: ctx.source, target: target.id, amount }];
    if (!isAlive(target)) events.push({ type: 'enemyDefeated', source: ctx.source, target: target.id });
    return { events };
  },
};

const fail: Operation = {
  ...loose,
  validate: () => 'This operation can never resolve.',
  resolve: () => ({ events: [] }),
};

export const testGain = (resource: string, amount = 1): OpCall => ({ op: 'test.gain', resource, amount });
const testHit = (amount: number): OpCall => ({ op: 'test.hit', amount });

const fiveCards = (owner: string): CardDef[] => [
  { id: `${owner}.hit`, owner, cost: 1, target: 'chosenEnemy', effects: [testHit(6)] },
  { id: `${owner}.gain`, owner, cost: 1, target: 'none', effects: [testGain('essence')] },
  { id: `${owner}.fail`, owner, cost: 0, target: 'none', effects: [testGain('essence'), { op: 'test.fail' }] },
  { id: `${owner}.pricey`, owner, cost: 7, target: 'none', effects: [] },
  { id: `${owner}.big`, owner, cost: 2, target: 'chosenEnemy', effects: [testHit(30)] },
];

const character = (id: string, triggers?: TriggerDef[]): CharacterDef => ({
  id,
  domain: 'test',
  stats: { hp: 20, attack: 3, defense: 2 },
  cards: fiveCards(id).map((c) => c.id),
  ...(triggers ? { passive: { triggers } } : {}),
});

const onCardPlayedMark: TriggerDef[] = [{ on: 'cardPlayed', do: [testGain('order')] }];

const characters: CharacterDef[] = [
  ...['test.a', 'test.b', 'test.c', 'test.d'].map((id) => character(id)),
  ...['test.w0', 'test.w1', 'test.w2', 'test.w3'].map((id) => character(id, onCardPlayedMark)),
];

// Ten relics in a ring: each answers the previous one's resource and gains the next.
// A deliberately looping fixture that only the depth cap can stop.
const loopRelics: RelicDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `test.loop${i}`,
  triggers: [{ on: 'resourceGained', filter: { resource: `loop${i}` }, do: [testGain(`loop${(i + 1) % 10}`)] }],
}));

const relics: RelicDef[] = [
  ...loopRelics,
  { id: 'test.watch0', triggers: onCardPlayedMark },
  { id: 'test.watch1', triggers: onCardPlayedMark },
  // Reacts to any resource gain, including its own: only "no self re-fire" stops it.
  { id: 'test.again', triggers: [{ on: 'resourceGained', do: [testGain('again')] }] },
  { id: 'test.plus3', modifiers: [{ value: 'damage', step: 'flat', amount: 3 }] },
  { id: 'test.double-shield', modifiers: [{ value: 'shield', step: 'outgoingMul', amount: 2 }] },
];

const statuses: StatusDef[] = [
  { id: 'test.exposed', stacking: 'refresh', modifiers: [{ value: 'damage', step: 'incomingMul', amount: 1.5 }] },
  { id: 'test.add', stacking: 'add' },
  { id: 'test.refresh', stacking: 'refresh' },
  { id: 'test.highest', stacking: 'highest' },
];

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]));

export const fixtureRegistry: Registry = {
  cards: byId([
    ...characters.flatMap((c) => fiveCards(c.id)),
    { id: 'test.loop-card', owner: 'test.a', cost: 0, target: 'none', effects: [testGain('loop0')] },
  ]),
  characters: byId(characters),
  enemies: byId([
    { id: 'test.dummy', hp: 40 },
    { id: 'test.frail', hp: 5 },
    { id: 'test.watcher', hp: 40, triggers: onCardPlayedMark },
  ]),
  statuses: byId(statuses),
  relics: byId(relics),
  customOps: { 'test.gain': gain, 'test.hit': hit, 'test.fail': fail },
};

export const STARTERS = ['test.a', 'test.b', 'test.c', 'test.d'];

/** Puts a fresh copy of a card into the hand of a state copy. Tests only. */
export function withCardInHand(state: CombatState, card: string, owner = 'm0'): [CombatState, CardInstance] {
  const next = structuredClone(state);
  const instance = { uid: `c${next.nextUid++}`, card, owner };
  next.piles.hand.push(instance);
  return [next, instance];
}

/** The fixture registry plus extra cards. */
export const withCards = (...cards: CardDef[]): Registry => ({
  ...fixtureRegistry,
  cards: { ...fixtureRegistry.cards, ...byId(cards) },
});

/** Turn 1 of a fixture combat: starters (Attack 3, Defense 2) against the given enemies. */
export const fixtureCombat = (enemies: string[] = ['test.dummy'], relics: string[] = [], registry = fixtureRegistry) =>
  startCombat({ seed: 1, party: STARTERS, enemies, relics }, registry).state;
