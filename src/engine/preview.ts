import { cardCost, chargeOf, countDown, playContext, ultimateEffects, validate, type Command } from './combat.ts';
import { intentOf } from './phases.ts';
import type { OpCall, Registry } from './defs.ts';
import { evaluate } from './formula.ts';
import { pipeline } from './modifiers.ts';
import type { OpContext, Preview } from './operation.ts';
import { getOp } from './ops/index.ts';
import { createResolution } from './resolve.ts';
import { PARTY, type CardInstance, type CombatState, type EntityId } from './state.ts';

/**
 * What playing a card would do, from the same code that resolves it. Runs the card's
 * operations in order on a scratch copy so later operations see earlier ones, including a
 * repeat and the card's ultimate charge. Triggers are not previewed. Returns undefined if the
 * command would be rejected.
 */
export function previewCard(
  state: CombatState,
  command: Extract<Command, { type: 'playCard' }>,
  registry: Registry,
): Preview[] | undefined {
  if (validate(state, command, registry) !== undefined) return undefined;
  const scratch = structuredClone(state);
  const index = scratch.piles.hand.findIndex((c) => c.uid === command.card);
  const card = scratch.piles.hand[index] as CardInstance;
  const def = registry.cards[card.card];
  if (!def) return undefined;
  const cost = cardCost(scratch, card, registry);
  scratch.piles.hand.splice(index, 1);
  scratch.mana -= cost;
  scratch.manaSpent += cost;
  const repeats = 1 + scratch.next.repeat;
  scratch.next = { costDelta: 0, repeat: 0 };
  const calls = [...Array.from({ length: repeats }, () => def.effects).flat(), ...chargeOf(def)];
  return previewOps(scratch, calls, playContext(card, command.target), registry);
}

/** What firing a member's ultimate would do, or undefined if it would be rejected. */
export function previewUltimate(state: CombatState, member: EntityId, registry: Registry): Preview[] | undefined {
  if (validate(state, { type: 'fireUltimate', member }, registry) !== undefined) return undefined;
  const scratch = structuredClone(state);
  const m = scratch.members.find((x) => x.id === member);
  const ultimate = m && registry.characters[m.character]?.ultimate;
  if (!m || !ultimate) return undefined;
  m.gauge = 0;
  return previewOps(scratch, ultimateEffects(m, registry), { source: m.id, owner: m.id }, registry);
}

/**
 * What an enemy's shown intent would do if it acted now: the exact numbers for its intent
 * display, from the same code that resolves it. Party Shield is counted, as it will be, and
 * turn counts that run out at the end of your turn are not.
 */
export function previewIntent(state: CombatState, enemyId: EntityId, registry: Registry): Preview[] {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  const intent = enemy && enemy.hp > 0 ? intentOf(enemy, registry) : undefined;
  if (!enemy || !intent) return [];
  // A controlled enemy will skip this action.
  if (enemy.statuses.some((s) => registry.statuses[s.status]?.skipsAction)) return [];
  const scratch = structuredClone(state);
  // Turn counts drop at the end of your turn, and the enemy's own Shield clears, before it acts.
  countDown(createResolution(scratch, registry), 'party');
  for (const e of scratch.enemies) e.shield = 0;
  return previewOps(scratch, intent.effects, { source: enemy.id, target: PARTY }, registry);
}

function previewOps(scratch: CombatState, calls: readonly OpCall[], ctx: OpContext, registry: Registry): Preview[] {
  const out: Preview[] = [];
  for (const call of calls) {
    const op = getOp(registry, call.op);
    if (!op || op.validate?.(scratch, call, ctx, registry) !== undefined) continue;
    const previews = op.preview(scratch, call, ctx, registry);
    const result = op.resolve(scratch, call, ctx, registry);
    const last = previews.at(-1);
    if (result.then?.length && last) {
      const branchCtx = result.consumed === undefined ? ctx : { ...ctx, consumed: result.consumed };
      last.branch = previewOps(scratch, result.then, branchCtx, registry);
    }
    out.push(...previews);
  }
  return out;
}

export interface DomainCounter {
  domain: string;
  label: string;
  icon?: string;
  help?: string;
  count: number;
  /** Damage per count after the Domain holder's outgoing modifiers, and the product. */
  each?: number;
  total?: number;
}

/** One HUD badge per Domain present in the party, in order of first appearance by slot. */
export function domainCounters(state: CombatState, registry: Registry): DomainCounter[] {
  const out: DomainCounter[] = [];
  for (const m of state.members) {
    const id = registry.characters[m.character]?.domain;
    const counter = id === undefined ? undefined : registry.domains[id]?.counter;
    if (id === undefined || !counter || out.some((c) => c.domain === id)) continue;
    const ctx = { source: m.id };
    const count = Math.max(0, Math.floor(evaluate(counter.count, state, ctx, registry)));
    const base: DomainCounter = { domain: id, label: counter.label, count };
    if (counter.icon !== undefined) base.icon = counter.icon;
    if (counter.help !== undefined) base.help = counter.help;
    if (counter.each === undefined) {
      out.push(base);
    } else {
      const each = pipeline('damage', counter.each, state, ctx, registry);
      out.push({ ...base, each, total: count * each });
    }
  }
  return out;
}
