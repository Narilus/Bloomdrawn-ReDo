import type { Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import type { OpContext } from './operation.ts';
import { drawCards } from './piles.ts';
import { createResolution, drain, emit, enqueue, getOp, isOver, ROOT, type Resolution } from './resolve.ts';
import { createStreams, shuffleInPlace } from './rng.ts';
import {
  BASE_MANA,
  COMBAT_STREAMS,
  HAND_DRAW,
  isAlive,
  type CardInstance,
  type CombatState,
  type EntityId,
} from './state.ts';

export type Command = { type: 'playCard'; card: EntityId; target?: EntityId } | { type: 'endTurn' };

export type ApplyResult =
  | { ok: true; state: CombatState; events: EngineEvent[] }
  | { ok: false; reason: string; state: CombatState };

export interface CombatSetup {
  seed: number;
  /** Character IDs in slot order; slot 0 is the front. */
  party: string[];
  /** Enemy IDs in slot order. */
  enemies: string[];
  /** Relic IDs in acquisition order. */
  relics?: string[];
  /** Current party HP carried in from the run; defaults to full. */
  partyHp?: number;
}

/** Builds a combat, shuffles the deck and resolves combat start through the first draw. */
export function startCombat(setup: CombatSetup, registry: Registry): { state: CombatState; events: EngineEvent[] } {
  let uid = 0;
  const next = (prefix: string): EntityId => `${prefix}${uid++}`;
  const lookup = <T>(table: Readonly<Record<string, T>>, id: string, kind: string): T => {
    const def = table[id];
    if (!def) throw new Error(`Unknown ${kind} "${id}"`);
    return def;
  };

  const characters = setup.party.map((id) => lookup(registry.characters, id, 'character'));
  const members = setup.party.map((character, slot) => ({ id: `m${slot}`, character, statuses: [] }));
  const maxHp = characters.reduce((sum, c) => sum + c.stats.hp, 0);
  const deck: CardInstance[] = characters.flatMap((c, slot) =>
    c.cards.map((card) => {
      lookup(registry.cards, card, 'card');
      return { uid: next('c'), card, owner: `m${slot}` };
    }),
  );
  const enemies = setup.enemies.map((id) => {
    const def = lookup(registry.enemies, id, 'enemy');
    return { id: next('e'), enemy: id, hp: def.hp, maxHp: def.hp, shield: 0, statuses: [] };
  });
  const relics = (setup.relics ?? []).map((id) => {
    lookup(registry.relics, id, 'relic');
    return { id: next('r'), relic: id };
  });

  const state: CombatState = {
    turn: 0,
    phase: 'player',
    outcome: null,
    mana: 0,
    maxMana: BASE_MANA,
    party: { hp: Math.min(setup.partyHp ?? maxHp, maxHp), maxHp, shield: 0 },
    members,
    enemies,
    relics,
    piles: { draw: deck, hand: [], discard: [], graveyard: [] },
    resources: {},
    rng: createStreams(setup.seed, COMBAT_STREAMS),
    nextUid: uid,
  };
  shuffleInPlace(state.piles.draw, state.rng, 'shuffle');

  const rc = createResolution(state, registry);
  emit(rc, { type: 'combatStart' }, ROOT);
  drain(rc);
  if (!isOver(rc)) beginTurn(rc);
  return { state: rc.state, events: rc.events };
}

/**
 * Validates a complete command, then resolves it on a copy. A rejection returns the
 * original state object untouched and raises no events.
 */
export function apply(state: CombatState, command: Command, registry: Registry): ApplyResult {
  const reason = validate(state, command, registry);
  if (reason !== undefined) return { ok: false, reason, state };

  const rc = createResolution(structuredClone(state), registry);
  if (command.type === 'playCard') playCard(rc, command);
  else endTurn(rc);
  return { ok: true, state: rc.state, events: rc.events };
}

export function validate(state: CombatState, command: Command, registry: Registry): string | undefined {
  if (state.phase !== 'player') return 'It is not the player phase.';
  if (command.type === 'endTurn') return undefined;

  const card = state.piles.hand.find((c) => c.uid === command.card);
  if (!card) return 'That card is not in hand.';
  const def = registry.cards[card.card];
  if (!def) return `Unknown card "${card.card}".`;
  if (def.cost > state.mana) return 'Not enough Mana.';

  if (def.target === 'chosenEnemy') {
    const target = state.enemies.find((e) => e.id === command.target);
    if (!target || !isAlive(target)) return 'Choose a living enemy.';
  } else if (command.target !== undefined) {
    return 'This card does not take a target.';
  }

  const ctx = playContext(card, command.target);
  for (const call of def.effects) {
    const op = getOp(registry, call.op);
    if (!op) return `Unknown operation "${call.op}".`;
    const why = op.validate?.(state, call, ctx, registry);
    if (why !== undefined) return why;
  }
  return undefined;
}

function playContext(card: CardInstance, target: EntityId | undefined): OpContext {
  const ctx: OpContext = { source: card.owner, owner: card.owner };
  if (target !== undefined) ctx.target = target;
  return ctx;
}

function playCard(rc: Resolution, command: { card: EntityId; target?: EntityId }): void {
  const s = rc.state;
  const index = s.piles.hand.findIndex((c) => c.uid === command.card);
  const [card] = s.piles.hand.splice(index, 1) as [CardInstance];
  const def = rc.registry.cards[card.card];
  if (!def) throw new Error(`Unknown card "${card.card}"`);

  s.mana -= def.cost;
  const ctx = playContext(card, command.target);
  enqueue(rc, def.effects, ctx, ROOT);
  const played: EngineEvent = { type: 'cardPlayed', source: card.owner, owner: card.owner, card: card.uid };
  if (command.target !== undefined) played.target = command.target;
  emit(rc, played, ROOT);
  drain(rc);
  s.piles.discard.push(card);
}

function endTurn(rc: Resolution): void {
  const s = rc.state;
  s.piles.discard.push(...s.piles.hand);
  s.piles.hand = [];
  emit(rc, { type: 'turnEnd' }, ROOT);
  drain(rc);
  if (isOver(rc)) return;

  s.phase = 'enemy';
  emit(rc, { type: 'enemyPhaseStart' }, ROOT);
  drain(rc);
  // Enemy intents act here from M1.
  if (isOver(rc)) return;
  beginTurn(rc);
}

function beginTurn(rc: Resolution): void {
  const s = rc.state;
  s.turn += 1;
  s.phase = 'player';
  s.party.shield = 0;
  s.mana = s.maxMana;
  emit(rc, { type: 'turnStart' }, ROOT);
  drain(rc);
  if (isOver(rc)) return;
  for (const event of drawCards(s, HAND_DRAW - s.piles.hand.length)) emit(rc, event, ROOT);
  drain(rc);
}
