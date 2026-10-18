import { expect, it } from 'vitest';
import {
  apply,
  previewCard,
  startCombat,
  type CardInstance,
  type CombatState,
  type EngineEvent,
  type Preview,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';

export const STARTER_PARTY = ['maelia', 'agathe', 'anthe', 'leonora'];

export interface ScenarioSpec {
  party?: string[];
  enemies?: string[];
  seed?: number;
  setup?: {
    /** Card IDs to hold, in order. They come out of the deck when present; otherwise new copies are made. */
    hand?: string[];
    resources?: Record<string, number>;
    mana?: number;
  };
  /** `target` is an enemy slot index. */
  play: { card: string; target?: number }[];
  expect?: {
    resources?: Record<string, number>;
    handSize?: number;
    mana?: number;
    enemyHp?: number[];
    partyHp?: number;
    partyShield?: number;
  };
  check?: (run: ScenarioRun) => void;
}

export interface ScenarioPlay {
  preview: Preview[];
  events: EngineEvent[];
  before: CombatState;
  after: CombatState;
}

export interface ScenarioRun {
  state: CombatState;
  plays: ScenarioPlay[];
}

/** Sets up a combat as described, plays the cards in order and records each preview and result. */
export function runScenario(spec: ScenarioSpec, registry: Registry = gameRegistry): ScenarioRun {
  let state = startCombat(
    { seed: spec.seed ?? 1, party: spec.party ?? STARTER_PARTY, enemies: spec.enemies ?? ['enemy.training-dummy'] },
    registry,
  ).state;

  if (spec.setup?.hand) {
    const pool = [...state.piles.hand, ...state.piles.draw];
    state.piles.hand = spec.setup.hand.map((id) => takeOrMake(state, pool, id, registry));
    state.piles.draw = pool;
  }
  Object.assign(state.resources, spec.setup?.resources);
  if (spec.setup?.mana !== undefined) state.mana = spec.setup.mana;

  const plays: ScenarioPlay[] = [];
  for (const step of spec.play) {
    const instance = state.piles.hand.find((c) => c.card === step.card);
    if (!instance) throw new Error(`Scenario: ${step.card} is not in hand`);
    const target = step.target === undefined ? undefined : state.enemies[step.target]?.id;
    const command = { type: 'playCard' as const, card: instance.uid, ...(target ? { target } : {}) };
    const preview = previewCard(state, command, registry);
    const result = apply(state, command, registry);
    if (!result.ok || !preview) throw new Error(`Scenario: ${step.card} was rejected: ${result.ok ? '' : result.reason}`);
    plays.push({ preview, events: result.events, before: state, after: result.state });
    state = result.state;
  }
  return { state, plays };
}

function takeOrMake(state: CombatState, pool: CardInstance[], id: string, registry: Registry): CardInstance {
  const index = pool.findIndex((c) => c.card === id);
  if (index >= 0) return pool.splice(index, 1)[0] as CardInstance;
  const owner = state.members.find((m) => m.character === registry.cards[id]?.owner);
  if (!owner) throw new Error(`Scenario: no party member owns ${id}`);
  return { uid: `c${state.nextUid++}`, card: id, owner: owner.id };
}

/** A kit scenario test in the short format from docs/ARCHITECTURE.md. */
export function scenario(name: string, spec: ScenarioSpec, registry?: Registry): void {
  it(name, () => {
    const run = runScenario(spec, registry);
    const { state } = run;
    const want = spec.expect ?? {};
    for (const [key, value] of Object.entries(want.resources ?? {})) expect(state.resources[key] ?? 0, key).toBe(value);
    if (want.handSize !== undefined) expect(state.piles.hand).toHaveLength(want.handSize);
    if (want.mana !== undefined) expect(state.mana).toBe(want.mana);
    if (want.enemyHp) expect(state.enemies.map((e) => e.hp)).toEqual(want.enemyHp);
    if (want.partyHp !== undefined) expect(state.party.hp).toBe(want.partyHp);
    if (want.partyShield !== undefined) expect(state.party.shield).toBe(want.partyShield);
    spec.check?.(run);
  });
}
