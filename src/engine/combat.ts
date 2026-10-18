import type { CardDef, OpCall, Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import { hasKeyword } from './formula.ts';
import type { OpContext } from './operation.ts';
import { drawCards } from './piles.ts';
import { getOp } from './ops/index.ts';
import { createResolution, drain, emit, enqueue, isOver, ROOT, type Resolution } from './resolve.ts';
import { createStreams, shuffleInPlace } from './rng.ts';
import {
  BASE_MANA,
  COMBAT_STREAMS,
  GAUGE_MAX,
  HAND_DRAW,
  isAlive,
  type CardInstance,
  type CombatState,
  type EntityId,
} from './state.ts';

export type Command =
  | { type: 'playCard'; card: EntityId; target?: EntityId }
  | { type: 'fireUltimate'; member: EntityId }
  | { type: 'endTurn' };

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
  /** Ultimate gauges carried in from the run, in slot order; default 0. */
  gauges?: number[];
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
  const members = setup.party.map((character, slot) => ({
    id: `m${slot}`,
    character,
    statuses: [],
    gauge: Math.min(GAUGE_MAX, Math.max(0, setup.gauges?.[slot] ?? 0)),
  }));
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
    manaDebt: 0,
    manaSpent: 0,
    usedThisTurn: [],
    next: { costDelta: 0, repeat: 0 },
    party: { hp: Math.min(setup.partyHp ?? maxHp, maxHp), maxHp, shield: 0 },
    members,
    enemies,
    relics,
    piles: { draw: deck, hand: [], discard: [], graveyard: [] },
    resources: startingResources(characters.map((c) => c.domain), registry),
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

/** Pooled resources of the Domains present, at their starting values. */
function startingResources(domains: string[], registry: Registry): Record<string, number> {
  const resources: Record<string, number> = {};
  for (const id of new Set(domains)) {
    for (const r of registry.domains[id]?.resources ?? []) resources[r.id] = r.start ?? 0;
  }
  return resources;
}

/** What a card in hand costs right now: printed cost, its own changes and any next-card discount, never below 0. */
export function cardCost(state: CombatState, card: CardInstance, registry: Registry): number {
  const def = registry.cards[card.card];
  if (!def) return 0;
  return Math.max(0, def.cost + (card.costDelta ?? 0) + state.next.costDelta);
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
  else if (command.type === 'fireUltimate') fireUltimate(rc, command.member);
  else endTurn(rc);
  return { ok: true, state: rc.state, events: rc.events };
}

export function validate(state: CombatState, command: Command, registry: Registry): string | undefined {
  if (state.phase !== 'player') return 'It is not the player phase.';
  if (command.type === 'endTurn') return undefined;
  if (command.type === 'fireUltimate') return validateUltimate(state, command.member, registry);

  const card = state.piles.hand.find((c) => c.uid === command.card);
  if (!card) return 'That card is not in hand.';
  const def = registry.cards[card.card];
  if (!def) return `Unknown card "${card.card}".`;
  if (cardCost(state, card, registry) > state.mana) return 'Not enough Mana.';

  if (def.target === 'chosenEnemy') {
    const target = state.enemies.find((e) => e.id === command.target);
    if (!target || !isAlive(target)) return 'Choose a living enemy.';
  } else if (command.target !== undefined) {
    return 'This card does not take a target.';
  }

  return validateCalls(state, def.effects, playContext(card, command.target), registry);
}

function validateUltimate(state: CombatState, memberId: EntityId, registry: Registry): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  const ultimate = member && registry.characters[member.character]?.ultimate;
  if (!member || !ultimate) return 'No such ultimate.';
  if (member.gauge < GAUGE_MAX) return 'That ultimate is not charged.';
  return validateCalls(state, ultimate.effects, { source: member.id, owner: member.id }, registry);
}

function validateCalls(state: CombatState, calls: readonly OpCall[], ctx: OpContext, registry: Registry): string | undefined {
  for (const call of calls) {
    const op = getOp(registry, call.op);
    if (!op) return `Unknown operation "${call.op}".`;
    const why = op.validate?.(state, call, ctx, registry);
    if (why !== undefined) return why;
  }
  return undefined;
}

export function playContext(card: CardInstance, target: EntityId | undefined): OpContext {
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

  const cost = cardCost(s, card, rc.registry);
  s.mana -= cost;
  s.manaSpent += cost;
  const repeats = 1 + s.next.repeat;
  s.next = { costDelta: 0, repeat: 0 };
  leaveHand(card);

  const ctx = playContext(card, command.target);
  for (let i = 0; i < repeats; i++) enqueue(rc, def.effects, ctx, ROOT);
  enqueue(rc, chargeOf(def), ctx, ROOT);
  const played: EngineEvent = { type: 'cardPlayed', source: card.owner, owner: card.owner, card: card.uid };
  if (command.target !== undefined) played.target = command.target;
  emit(rc, played, ROOT);
  drain(rc);
  s.piles.discard.push(card);
}

/** Empties the gauge and resolves the ultimate. Costs no Mana. */
function fireUltimate(rc: Resolution, memberId: EntityId): void {
  const member = rc.state.members.find((m) => m.id === memberId);
  const ultimate = member && rc.registry.characters[member.character]?.ultimate;
  if (!member || !ultimate) throw new Error(`No ultimate for "${memberId}"`);
  member.gauge = 0;
  enqueue(rc, ultimate.effects, { source: member.id, owner: member.id }, ROOT);
  emit(rc, { type: 'ultimateFired', source: member.id, owner: member.id }, ROOT);
  drain(rc);
}

/** A card's ultimate charge, as an operation call so it shows in previews and text. */
export const chargeOf = (def: CardDef) => (def.charge ? [{ op: 'chargeUltimate', amount: def.charge }] : []);

function leaveHand(card: CardInstance): void {
  delete card.costDelta;
  delete card.held;
}

/** Cleanup, then end of turn: scheduled effects and Domain hooks (Tentacles), then damage over time. */
function endTurn(rc: Resolution): void {
  const s = rc.state;
  const kept: CardInstance[] = [];
  for (const card of s.piles.hand) {
    if (hasKeyword(rc.registry.cards[card.card]?.keywords, 'retain')) {
      card.held = (card.held ?? 0) + 1;
      kept.push(card);
    } else {
      leaveHand(card);
      s.piles.discard.push(card);
    }
  }
  s.piles.hand = kept;
  s.next = { costDelta: 0, repeat: 0 };
  for (const lifecycle of ['cleanup', 'turnEnd', 'statusTick'] as const) {
    emit(rc, { type: lifecycle }, ROOT);
    drain(rc);
    if (isOver(rc)) return;
  }

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
  const debt = Math.min(s.manaDebt, s.maxMana);
  s.mana = s.maxMana - debt;
  s.manaDebt = 0;
  s.manaSpent = 0;
  s.usedThisTurn = [];
  emit(rc, { type: 'turnStart' }, ROOT);
  drain(rc);
  if (isOver(rc)) return;
  for (const event of drawCards(s, HAND_DRAW - s.piles.hand.length)) emit(rc, event, ROOT);
  drain(rc);
  // After the draw, so "when a turn starts with Mana debt, draw" adds a card instead of being topped up to 5.
  if (debt > 0 && !isOver(rc)) {
    emit(rc, { type: 'manaDebtPaid', amount: debt }, ROOT);
    drain(rc);
  }
}
