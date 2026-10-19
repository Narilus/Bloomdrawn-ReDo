import type { CardDef, EnemyEntry, IntentDef, OpCall, Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import { hasKeyword } from './formula.ts';
import type { OpContext } from './operation.ts';
import { drawCards } from './piles.ts';
import { getOp } from './ops/index.ts';
import { createResolution, drain, emit, enqueue, isOver, ROOT, vitalsOf, type Resolution, type Vitals } from './resolve.ts';
import { takeStacks } from './statuses.ts';
import { createStreams, shuffleInPlace } from './rng.ts';
import {
  BASE_MANA,
  COMBAT_STREAMS,
  ENEMY_SLOTS_MAX,
  GAUGE_MAX,
  HAND_DRAW,
  isAlive,
  PARTY,
  type CardInstance,
  type Enemy,
  type CombatState,
  type EntityId,
  type Member,
} from './state.ts';

export type Command =
  | { type: 'playCard'; card: EntityId; target?: EntityId }
  | { type: 'fireUltimate'; member: EntityId }
  | { type: 'endTurn' };

export type ApplyResult =
  /** `vitals[i]` is HP and Shield right after `events[i]`. */
  | { ok: true; state: CombatState; events: EngineEvent[]; vitals: Vitals[] }
  | { ok: false; reason: string; state: CombatState };

export interface CombatSetup {
  seed: number;
  /** Character IDs in slot order; slot 0 is the front. */
  party: string[];
  /** Enemy IDs in slot order, each optionally with an HP override. */
  enemies: EnemyEntry[];
  /** Relic IDs in acquisition order. */
  relics?: string[];
  /** Current party HP carried in from the run; defaults to full. */
  partyHp?: number;
  /** Ultimate gauges carried in from the run, in slot order; default 0. */
  gauges?: number[];
}

/** What combat start resolved, for presentation to play like any command (a Choir Bell volley). */
export interface CombatStart {
  state: CombatState;
  events: EngineEvent[];
  vitals: Vitals[];
  /** HP and Shield before combat start resolved. */
  before: Vitals;
}

/** Builds a combat, shuffles the deck and resolves combat start through the first draw. */
export function startCombat(setup: CombatSetup, registry: Registry): CombatStart {
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
    gauge: Math.min(GAUGE_MAX, Math.max(0, setup.gauges?.[slot] ?? 0)),
  }));
  const maxHp = characters.reduce((sum, c) => sum + c.stats.hp, 0);
  const deck: CardInstance[] = characters.flatMap((c, slot) =>
    c.cards.map((card) => {
      lookup(registry.cards, card, 'card');
      return { uid: next('c'), card, owner: `m${slot}` };
    }),
  );
  const enemies = setup.enemies.map((entry, slot) => {
    const id = typeof entry === 'string' ? entry : entry.enemy;
    lookup(registry.enemies, id, 'enemy');
    return newEnemy(registry, id, next('e'), slot, typeof entry === 'string' ? undefined : entry.hp);
  });
  const summons = enemies.reduce((n, e) => n + summonCapacity(registry, e.enemy), 0);
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
    party: { hp: Math.min(setup.partyHp ?? maxHp, maxHp), maxHp, shield: 0, statuses: [] },
    members,
    enemies,
    enemySlots: Math.min(ENEMY_SLOTS_MAX, Math.max(enemies.length, enemies.length + summons)),
    relics,
    piles: { draw: deck, hand: [], discard: [], graveyard: [] },
    resources: startingResources(characters.map((c) => c.domain), registry),
    rng: createStreams(setup.seed, COMBAT_STREAMS),
    nextUid: uid,
  };
  shuffleInPlace(state.piles.draw, state.rng, 'shuffle');

  const before = vitalsOf(state);
  const rc = createResolution(state, registry);
  emit(rc, { type: 'combatStart' }, ROOT);
  drain(rc);
  if (!isOver(rc)) beginTurn(rc);
  return { state: rc.state, events: rc.events, vitals: rc.vitals, before };
}

/** A fresh enemy at full HP (or an encounter's HP), showing its first intent. */
export function newEnemy(registry: Registry, enemy: string, id: EntityId, slot: number, hp?: number): Enemy {
  const def = registry.enemies[enemy];
  const max = hp ?? def?.hp ?? 1;
  return { id, enemy, slot, hp: max, maxHp: max, shield: 0, statuses: [], ...(def?.intents?.length ? { intent: 0 } : {}) };
}

/** How many enemies one enemy can summon at most, from the `max` of its summon intents. */
function summonCapacity(registry: Registry, enemy: string): number {
  const calls = registry.enemies[enemy]?.intents?.flatMap((i) => i.effects) ?? [];
  return Math.max(0, ...calls.filter((c) => c.op === 'summon').map((c) => Number(c.max ?? 0)));
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
  return { ok: true, state: rc.state, events: rc.events, vitals: rc.vitals };
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
  return validateCalls(state, ultimateEffects(member, registry), { source: member.id, owner: member.id }, registry);
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
  if (def.slot) played.slot = def.slot;
  if (command.target !== undefined) played.target = command.target;
  emit(rc, played, ROOT);
  drain(rc);
  if (hasKeyword(def.keywords, 'exhaust')) {
    s.piles.graveyard.push(card);
    emit(rc, { type: 'cardExhausted', source: card.owner, owner: card.owner, card: card.uid }, ROOT);
    drain(rc);
  } else {
    s.piles.discard.push(card);
  }
}

/** Empties the gauge and resolves the ultimate. Costs no Mana. */
function fireUltimate(rc: Resolution, memberId: EntityId): void {
  const member = rc.state.members.find((m) => m.id === memberId);
  const ultimate = member && rc.registry.characters[member.character]?.ultimate;
  if (!member || !ultimate) throw new Error(`No ultimate for "${memberId}"`);
  member.gauge = 0;
  enqueue(rc, ultimateEffects(member, rc.registry), { source: member.id, owner: member.id }, ROOT);
  emit(rc, { type: 'ultimateFired', source: member.id, owner: member.id }, ROOT);
  drain(rc);
}

/** A member's ultimate operations: the Transcended ones once she has Transcended this combat. */
export function ultimateEffects(member: Member, registry: Registry): OpCall[] {
  const ultimate = registry.characters[member.character]?.ultimate;
  if (!ultimate) return [];
  return member.transcended && ultimate.transcended ? ultimate.transcended.effects : ultimate.effects;
}

/** A card's ultimate charge, as an operation call so it shows in previews and text. */
export const chargeOf = (def: CardDef) => (def.charge ? [{ op: 'chargeUltimate', amount: def.charge }] : []);

function leaveHand(card: CardInstance): void {
  delete card.costDelta;
  delete card.held;
}

/** Cleanup, then end of turn: scheduled effects and Domain hooks (Tentacles), then damage over time, then the party's turn counts. */
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
  for (const lifecycle of ['cleanup', 'turnEnd'] as const) {
    emit(rc, { type: lifecycle }, ROOT);
    drain(rc);
    if (isOver(rc)) return;
  }
  // Damage over time on the enemies lands at the end of the party's turn, one enemy at a time.
  for (const enemy of [...s.enemies]) {
    if (!isAlive(enemy)) continue;
    tick(rc, enemy.id);
    if (isOver(rc)) return;
  }
  // The party's turn is over: Weak on the party and Vulnerable on the enemies count down.
  countDown(rc, 'party');
  if (isOver(rc)) return;

  s.phase = 'enemy';
  // An enemy's Shield lasts until its own next turn, as the party's lasts until theirs.
  for (const enemy of s.enemies) enemy.shield = 0;
  emit(rc, { type: 'enemyPhaseStart' }, ROOT);
  drain(rc);
  if (isOver(rc)) return;
  // Enemies summoned during this phase join the turn order next round.
  for (const enemy of [...s.enemies]) {
    if (!isAlive(enemy)) continue;
    actIntent(rc, enemy);
    if (isOver(rc)) return;
  }
  // The enemies' turn is over: Weak on them and Vulnerable on the party count down. Then damage over time on the party lands.
  countDown(rc, 'enemies');
  if (isOver(rc)) return;
  tick(rc, PARTY);
  if (isOver(rc)) return;
  beginTurn(rc);
}

/** One bearer's damage over time (status triggers on `statusTick` filter for themselves). */
function tick(rc: Resolution, bearer: EntityId): void {
  emit(rc, { type: 'statusTick', target: bearer }, ROOT);
  drain(rc);
}

/**
 * A side's turn has ended: every turn-count status that matters on that side's turns loses a
 * stack (Weak on that side, Vulnerable on the other), except stacks that landed this turn. Then
 * nothing is fresh any more.
 */
export function countDown(rc: Resolution, ended: 'party' | 'enemies'): void {
  const s = rc.state;
  const bearers = [
    { id: PARTY as EntityId, side: 'party', statuses: s.party.statuses },
    ...s.enemies.filter(isAlive).map((e) => ({ id: e.id, side: 'enemies', statuses: e.statuses })),
  ];
  for (const bearer of bearers) {
    for (const stack of [...bearer.statuses]) {
      const lasts = rc.registry.statuses[stack.status]?.lasts;
      if (!lasts || (lasts === 'ownTurns') !== (bearer.side === ended)) continue;
      if (stack.stacks - (stack.fresh ?? 0) <= 0) continue;
      if (takeStacks(bearer.statuses, stack.status, 1)) emit(rc, { type: 'statusRemoved', target: bearer.id, status: stack.status }, ROOT);
    }
  }
  for (const bearer of bearers) for (const stack of bearer.statuses) delete stack.fresh;
  drain(rc);
}

/**
 * The enemy does exactly what its intent showed, then reveals its next intent. A control status
 * makes it skip instead: Stun loses that intent, Delay keeps it shown for next turn. A status that
 * ends after an action (Falter) goes once it has acted.
 */
function actIntent(rc: Resolution, enemy: Enemy): void {
  const intent = intentOf(enemy, rc.registry);
  if (!intent) return;
  const count = rc.registry.enemies[enemy.enemy]?.intents?.length ?? 1;
  const control = enemy.statuses.find((s) => rc.registry.statuses[s.status]?.skipsAction);
  if (control) {
    const mode = rc.registry.statuses[control.status]?.skipsAction;
    enemy.statuses.splice(enemy.statuses.indexOf(control), 1);
    emit(rc, { type: 'statusRemoved', source: enemy.id, target: enemy.id, status: control.status, via: 'skip' }, ROOT);
    drain(rc);
    if (mode === 'advance') enemy.intent = ((enemy.intent ?? 0) + 1) % count;
    return;
  }
  enqueue(rc, intent.effects, { source: enemy.id, target: PARTY }, ROOT);
  emit(rc, { type: 'enemyActed', source: enemy.id, target: PARTY }, ROOT);
  drain(rc);
  if (isOver(rc)) return;
  for (const s of enemy.statuses.filter((x) => rc.registry.statuses[x.status]?.endsAfterAction)) {
    enemy.statuses.splice(enemy.statuses.indexOf(s), 1);
    emit(rc, { type: 'statusRemoved', source: enemy.id, target: enemy.id, status: s.status }, ROOT);
  }
  drain(rc);
  enemy.intent = ((enemy.intent ?? 0) + 1) % count;
}

/** The intent an enemy is showing now. */
export function intentOf(enemy: Enemy, registry: Registry): IntentDef | undefined {
  return enemy.intent === undefined ? undefined : registry.enemies[enemy.enemy]?.intents?.[enemy.intent];
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
  if (isOver(rc)) return;
  emit(rc, { type: 'handDrawn' }, ROOT);
  drain(rc);
  // After the draw, so "when a turn starts with Mana debt, draw" adds a card instead of being topped up to 5.
  if (debt > 0 && !isOver(rc)) {
    emit(rc, { type: 'manaDebtPaid', amount: debt }, ROOT);
    drain(rc);
  }
}
