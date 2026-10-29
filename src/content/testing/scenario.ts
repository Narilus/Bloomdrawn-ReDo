import { expect, it } from 'vitest';
import {
  apply,
  previewCard,
  previewUltimate,
  startCombat,
  type CardInstance,
  type CombatState,
  type Command,
  type EngineEvent,
  type Preview,
  type Registry,
  type RunCard,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';

export const STARTER_PARTY = ['maelia', 'agathe', 'anthe', 'leonora'];

export interface ScenarioSpec {
  party?: string[];
  /** Dupe levels by character ID; others are C0. */
  dupes?: Record<string, number>;
  enemies?: string[];
  seed?: number;
  setup?: {
    /**
     * Card IDs to hold, in order. They come out of the deck when present; otherwise new copies are
     * made. A Domain's generic card names the character who owns it.
     */
    hand?: (string | Required<RunCard>)[];
    resources?: Record<string, number>;
    mana?: number;
    /** Ultimate gauges by character ID. */
    gauges?: Record<string, number>;
    partyHp?: number;
  };
  /** In order: play a card (`target` is an enemy slot index), fire a character's ultimate, or end the turn. */
  play: ({ card: string; target?: number } | { ultimate: string } | { endTurn: true })[];
  expect?: {
    resources?: Record<string, number>;
    gauges?: Record<string, number>;
    handSize?: number;
    mana?: number;
    enemyHp?: number[];
    partyHp?: number;
    partyShield?: number;
  };
  check?: (run: ScenarioRun) => void;
}

export interface ScenarioPlay {
  /** Empty for End Turn. */
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
  const party = spec.party ?? STARTER_PARTY;
  let state = startCombat(
    { seed: spec.seed ?? 1, party, enemies: spec.enemies ?? ['enemy.training-dummy'], dupes: party.map((id) => spec.dupes?.[id] ?? 0) },
    registry,
  ).state;

  if (spec.setup?.hand) {
    const pool = [...state.piles.hand, ...state.piles.draw];
    state.piles.hand = spec.setup.hand.map((id) => takeOrMake(state, pool, id, registry));
    state.piles.draw = pool;
  }
  Object.assign(state.resources, spec.setup?.resources);
  if (spec.setup?.mana !== undefined) state.mana = spec.setup.mana;
  if (spec.setup?.partyHp !== undefined) state.party.hp = spec.setup.partyHp;
  for (const [character, gauge] of Object.entries(spec.setup?.gauges ?? {})) memberOf(state, character).gauge = gauge;

  const plays: ScenarioPlay[] = [];
  for (const step of spec.play) {
    let command: Command;
    let preview: Preview[] | undefined = [];
    if ('endTurn' in step) {
      command = { type: 'endTurn' };
    } else if ('ultimate' in step) {
      command = { type: 'fireUltimate', member: memberOf(state, step.ultimate).id };
      preview = previewUltimate(state, command.member, registry);
    } else {
      const instance = state.piles.hand.find((c) => c.card === step.card);
      if (!instance) throw new Error(`Scenario: ${step.card} is not in hand`);
      const target = step.target === undefined ? undefined : state.enemies[step.target]?.id;
      const play = { type: 'playCard' as const, card: instance.uid, ...(target ? { target } : {}) };
      preview = previewCard(state, play, registry);
      command = play;
    }
    const result = apply(state, command, registry);
    if (!result.ok || !preview) throw new Error(`Scenario: ${JSON.stringify(step)} was rejected: ${result.ok ? '' : result.reason}`);
    plays.push({ preview, events: result.events, before: state, after: result.state });
    state = result.state;
  }
  return { state, plays };
}

function memberOf(state: CombatState, character: string) {
  const member = state.members.find((m) => m.character === character);
  if (!member) throw new Error(`Scenario: ${character} is not in the party`);
  return member;
}

function takeOrMake(state: CombatState, pool: CardInstance[], entry: string | Required<RunCard>, registry: Registry): CardInstance {
  const id = typeof entry === 'string' ? entry : entry.card;
  const index = pool.findIndex((c) => c.card === id);
  if (index >= 0) return pool.splice(index, 1)[0] as CardInstance;
  const def = registry.cards[id];
  // The party's own cards (Symptoms) are played by the front member.
  const character = typeof entry === 'string' ? def?.owner : entry.owner;
  const owner = character === undefined ? state.members[0] : state.members.find((m) => m.character === character);
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
    for (const [key, value] of Object.entries(want.gauges ?? {})) expect(memberOf(state, key).gauge, `${key} gauge`).toBe(value);
    if (want.handSize !== undefined) expect(state.piles.hand).toHaveLength(want.handSize);
    if (want.mana !== undefined) expect(state.mana).toBe(want.mana);
    if (want.enemyHp) expect(state.enemies.map((e) => e.hp)).toEqual(want.enemyHp);
    if (want.partyHp !== undefined) expect(state.party.hp).toBe(want.partyHp);
    if (want.partyShield !== undefined) expect(state.party.shield).toBe(want.partyShield);
    spec.check?.(run);
  });
}
