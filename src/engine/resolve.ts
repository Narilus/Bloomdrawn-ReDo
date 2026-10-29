import type { OpCall, Registry, TriggerDef } from './defs.ts';
import { characterOf } from './dupes.ts';
import type { EngineEvent } from './events.ts';
import { hasKeyword } from './formula.ts';
import type { OpContext } from './operation.ts';
import { getOp } from './ops/index.ts';
import { isAlive, MAX_CHAIN_DEPTH, PARTY, vitalsOf, type CombatState, type EntityId, type Vitals } from './state.ts';

/** Where an operation sits in a trigger chain: its depth and the triggers that led to it. */
export interface Origin {
  depth: number;
  chain: readonly string[];
}

export const ROOT: Origin = { depth: 0, chain: [] };

interface QueueItem {
  call: OpCall;
  ctx: OpContext;
  origin: Origin;
}

/** One command's resolution: a draft state, the FIFO queue, the ordered events and the vitals after each. */
export interface Resolution {
  state: CombatState;
  registry: Registry;
  events: EngineEvent[];
  vitals: Vitals[];
  queue: QueueItem[];
}

export const createResolution = (draft: CombatState, registry: Registry): Resolution => ({
  state: draft,
  registry,
  events: [],
  vitals: [],
  queue: [],
});

function record(rc: Resolution, event: EngineEvent, vitals = vitalsOf(rc.state)): void {
  rc.events.push(event);
  rc.vitals.push(vitals);
}

export const isOver = (rc: Resolution): boolean => rc.state.phase === 'ended';

export function enqueue(rc: Resolution, calls: readonly OpCall[], ctx: OpContext, origin: Origin): void {
  for (const call of calls) rc.queue.push({ call, ctx, origin });
}

/**
 * Records an event, checks victory and defeat, then queues every matching trigger. `vitals` are
 * the HP and Shield right after the event when the operation reported them (several hits in one
 * go); otherwise the state's.
 */
export function emit(rc: Resolution, event: EngineEvent, origin: Origin, vitals = vitalsOf(rc.state)): void {
  if (isOver(rc)) return;
  record(rc, event, vitals);
  if (checkOutcome(rc, vitals)) return;

  let capped = false;
  for (const { key, holder, trigger, domain } of matchingTriggers(rc.state, rc.registry, event, origin)) {
    if (origin.chain.includes(key)) continue; // no self re-fire within a chain
    if (trigger.once === 'turn' && rc.state.usedThisTurn.includes(key)) continue;
    if (origin.depth >= MAX_CHAIN_DEPTH) {
      capped = true;
      continue;
    }
    if (trigger.once === 'turn') rc.state.usedThisTurn.push(key);
    const ctx: OpContext = { source: holder, event };
    if (!domain && rc.state.members.some((m) => m.id === holder)) ctx.owner = holder;
    enqueue(rc, trigger.do, ctx, { depth: origin.depth + 1, chain: [...origin.chain, key] });
  }
  if (capped) {
    const note: EngineEvent = { type: 'chainCapped' };
    if (event.source !== undefined) note.source = event.source;
    record(rc, note);
  }
}

/** Resolves queued operations first in, first out until the queue is empty or combat ends. */
export function drain(rc: Resolution): void {
  while (rc.queue.length > 0 && !isOver(rc)) {
    const item = rc.queue.shift() as QueueItem;
    const op = getOp(rc.registry, item.call.op);
    if (!op) throw new Error(`Unknown operation "${item.call.op}"`);
    // Triggered operations that can no longer resolve fizzle quietly.
    if (op.validate?.(rc.state, item.call, item.ctx, rc.registry) !== undefined) continue;
    const result = op.resolve(rc.state, item.call, item.ctx, rc.registry);
    if (result.then?.length) {
      const ctx = result.consumed === undefined ? item.ctx : { ...item.ctx, consumed: result.consumed };
      rc.queue.unshift(...result.then.map((call) => ({ call, ctx, origin: item.origin })));
    }
    result.events.forEach((event, i) => emit(rc, event, item.origin, result.vitals?.[i]));
  }
}

/** Judged on the vitals after the event, so a fight won partway through a volley ends on the killing hit. */
function checkOutcome(rc: Resolution, vitals: Vitals): boolean {
  const s = rc.state;
  const outcome = vitals.party.hp <= 0 ? 'defeat' : vitals.enemies.every((e) => e.hp <= 0) ? 'victory' : null;
  if (!outcome) return false;
  s.phase = 'ended';
  s.outcome = outcome;
  rc.queue.length = 0;
  record(rc, { type: 'combatEnd', outcome });
  return true;
}

interface HeldTrigger {
  key: string;
  holder: EntityId;
  trigger: TriggerDef;
  /** A Domain hook: held by the Domain's first party member, but nobody's stats or gauge. */
  domain?: true;
}

/**
 * Fixed trigger order: the event's source, then party slot order, then the party's statuses, then
 * relic acquisition order, then enemy slot order, then Domain hooks (so Tentacles attack after
 * scheduled effects).
 */
function matchingTriggers(state: CombatState, registry: Registry, event: EngineEvent, origin: Origin): HeldTrigger[] {
  const holders = [
    ...state.members.map((m) => m.id),
    PARTY,
    ...state.relics.map((r) => r.id),
    ...state.enemies.filter(isAlive).map((e) => e.id),
  ];
  const source = event.source;
  const ordered =
    source !== undefined && (holders.includes(source) || state.enemies.some((e) => e.id === source))
      ? [source, ...holders.filter((h) => h !== source)]
      : holders;
  return [...ordered.flatMap((holder) => triggersOf(state, registry, holder)), ...domainTriggers(state, registry)].filter(
    ({ holder, trigger }) => trigger.on === event.type && filterMatches(state, registry, trigger, event, holder, origin),
  );
}

/** Hooks of each Domain present in the party, in order of first appearance by slot. */
function domainTriggers(state: CombatState, registry: Registry): HeldTrigger[] {
  const seen = new Set<string>();
  const out: HeldTrigger[] = [];
  for (const m of state.members) {
    const id = registry.characters[m.character]?.domain;
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    (registry.domains[id]?.triggers ?? []).forEach((trigger, i) =>
      out.push({ key: `domain:${id}:${i}`, holder: m.id, trigger, domain: true }),
    );
  }
  return out;
}

function triggersOf(state: CombatState, registry: Registry, holder: EntityId): HeldTrigger[] {
  const sets: [string, readonly TriggerDef[] | undefined][] = [];
  const member = state.members.find((m) => m.id === holder);
  const enemy = state.enemies.find((e) => e.id === holder);
  const relic = state.relics.find((r) => r.id === holder);
  if (member) sets.push([member.character, characterOf(member, registry)?.passive?.triggers]);
  if (enemy) sets.push([enemy.enemy, registry.enemies[enemy.enemy]?.triggers]);
  if (relic) sets.push([relic.relic, registry.relics[relic.relic]?.triggers]);
  for (const s of holder === PARTY ? state.party.statuses : (enemy?.statuses ?? [])) {
    sets.push([s.status, registry.statuses[s.status]?.triggers]);
  }
  return sets.flatMap(([defId, triggers]) =>
    (triggers ?? []).map((trigger, i) => ({ key: `${holder}:${defId}:${i}`, holder, trigger })),
  );
}

function filterMatches(state: CombatState, registry: Registry, trigger: TriggerDef, event: EngineEvent, holder: EntityId, origin: Origin): boolean {
  const f = trigger.filter;
  if (!f) return true;
  if (f.direct && origin.depth > 0) return false;
  if (f.fromCard && event.card === undefined) return false;
  if (f.slots && (event.slot === undefined || !f.slots.includes(event.slot))) return false;
  if (f.keyword && !hasKeyword(registry.cards[event.def ?? '']?.keywords, f.keyword)) return false;
  if (f.source === 'self' && event.source !== holder) return false;
  if (f.source === 'other' && event.source === holder) return false;
  if (f.source === 'party' && event.source !== PARTY && !state.members.some((m) => m.id === event.source)) return false;
  if (f.status !== undefined && event.status !== f.status) return false;
  if (f.target === 'self' && event.target !== holder) return false;
  if (f.resource !== undefined && event.resource !== f.resource) return false;
  return true;
}
