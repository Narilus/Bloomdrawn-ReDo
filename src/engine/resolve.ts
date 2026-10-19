import type { OpCall, Registry, TriggerDef } from './defs.ts';
import type { EngineEvent } from './events.ts';
import type { OpContext } from './operation.ts';
import { getOp } from './ops/index.ts';
import { isAlive, MAX_CHAIN_DEPTH, PARTY, type CombatState, type EntityId } from './state.ts';

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

/** HP and Shield right after an event, so presentation can move bars as each hit lands. */
export interface Vitals {
  party: { hp: number; shield: number };
  enemies: { id: string; hp: number; shield: number }[];
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

function record(rc: Resolution, event: EngineEvent): void {
  const { party, enemies } = rc.state;
  rc.events.push(event);
  rc.vitals.push({
    party: { hp: party.hp, shield: party.shield },
    enemies: enemies.map((e) => ({ id: e.id, hp: e.hp, shield: e.shield })),
  });
}

export const isOver = (rc: Resolution): boolean => rc.state.phase === 'ended';

export function enqueue(rc: Resolution, calls: readonly OpCall[], ctx: OpContext, origin: Origin): void {
  for (const call of calls) rc.queue.push({ call, ctx, origin });
}

/** Records an event, checks victory and defeat, then queues every matching trigger. */
export function emit(rc: Resolution, event: EngineEvent, origin: Origin): void {
  if (isOver(rc)) return;
  record(rc, event);
  if (checkOutcome(rc)) return;

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
    for (const event of result.events) emit(rc, event, item.origin);
  }
}

function checkOutcome(rc: Resolution): boolean {
  const s = rc.state;
  const outcome = s.party.hp <= 0 ? 'defeat' : s.enemies.every((e) => !isAlive(e)) ? 'victory' : null;
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
    ({ holder, trigger }) => trigger.on === event.type && filterMatches(trigger, event, holder, origin),
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
  if (member) sets.push([member.character, registry.characters[member.character]?.passive?.triggers]);
  if (enemy) sets.push([enemy.enemy, registry.enemies[enemy.enemy]?.triggers]);
  if (relic) sets.push([relic.relic, registry.relics[relic.relic]?.triggers]);
  for (const s of holder === PARTY ? state.party.statuses : (enemy?.statuses ?? [])) {
    sets.push([s.status, registry.statuses[s.status]?.triggers]);
  }
  return sets.flatMap(([defId, triggers]) =>
    (triggers ?? []).map((trigger, i) => ({ key: `${holder}:${defId}:${i}`, holder, trigger })),
  );
}

function filterMatches(trigger: TriggerDef, event: EngineEvent, holder: EntityId, origin: Origin): boolean {
  const f = trigger.filter;
  if (!f) return true;
  if (f.direct && origin.depth > 0) return false;
  if (f.slots && (event.slot === undefined || !f.slots.includes(event.slot))) return false;
  if (f.source === 'self' && event.source !== holder) return false;
  if (f.source === 'other' && event.source === holder) return false;
  if (f.target === 'self' && event.target !== holder) return false;
  if (f.resource !== undefined && event.resource !== f.resource) return false;
  return true;
}
