import type { ModifierDef, Registry } from './defs.ts';
import { characterOf } from './dupes.ts';
import { evaluate, type Formula } from './formula.ts';
import { enemyLevelScale } from './levels.ts';
import type { OpContext } from './operation.ts';
import { isImmune } from './phases.ts';
import { PARTY, type CombatState, type EntityId, type StatusStack } from './state.ts';

/** The numbers modifiers change through the pipeline (`volleys` counts passes instead). */
export type PipelineValue = 'damage' | 'shield' | 'stacks' | 'stackLoss';

/**
 * Rounds an exact amount down once, at the end (docs/notes/m6-scaling.md, 4.7). The small allowance
 * keeps a product that is whole on paper (12 × 1.25 × 2) whole after floating-point error.
 */
export const floorAmount = (x: number): number => Math.max(0, Math.floor(x + 1e-9));

/**
 * The one modifier pipeline. Steps: base formula, flat outgoing, outgoing multipliers (an enemy's
 * damage includes the fight's enemy scale, and its damage and Shield its level), incoming
 * multipliers (damage with a target only). Every step is exact; the amount is rounded down once at
 * the end and never goes below 0, so a % effect is never lost to rounding (owner, 31 Oct). Shield
 * absorption is the damage operation's step 5. `status` picks out the modifiers for one status's stacks.
 */
export function pipeline(
  value: PipelineValue,
  base: Formula,
  state: CombatState,
  ctx: OpContext,
  registry: Registry,
  target?: EntityId,
  status?: string,
  /** A crit's multiplier for a party damage hit, after the incoming multipliers and before Shield. */
  crit = 1,
): number {
  const applies = (m: ModifierDef) => m.value === value && (m.status === undefined || m.status === status);
  const outgoing = modifiersOf(state, registry, ctx.source).filter(applies);
  const sum = (mods: ModifierDef[]) => mods.reduce((n, m) => n + evaluate(m.amount, state, ctx, registry), 0);
  const scale = (n: number, mods: ModifierDef[]) => mods.reduce((x, m) => x * evaluate(m.amount, state, ctx, registry), n);

  let amount = evaluate(base, state, ctx, registry);
  amount += sum(outgoing.filter((m) => m.step === 'flat'));
  amount = scale(amount, outgoing.filter((m) => m.step === 'outgoingMul'));
  const fromEnemy = state.enemies.some((e) => e.id === ctx.source);
  if (value === 'damage' && state.enemyScale && fromEnemy) amount *= (100 + state.enemyScale) / 100;
  if (fromEnemy && state.enemyLevel) {
    const level = enemyLevelScale(state.enemyLevel);
    if (value === 'damage') amount *= level.damage / 1000;
    if (value === 'shield') amount *= level.hp / 1000;
  }
  // A rousing enemy takes no damage (DESIGN.md "Bosses").
  if (value === 'damage' && isImmune(state, target)) return 0;
  if (value === 'damage' && target !== undefined) {
    const incoming = modifiersOf(state, registry, target).filter(applies);
    amount = scale(amount, incoming.filter((m) => m.step === 'incomingMul'));
  }
  return floorAmount(amount * crit);
}

/** How many times each volley fires: once, plus any `volleys` modifiers on the source's side (Dance of Bells). */
export function volleyPasses(state: CombatState, ctx: OpContext, registry: Registry): number {
  const extra = modifiersOf(state, registry, ctx.source).filter((m) => m.value === 'volleys');
  return 1 + Math.max(0, Math.floor(extra.reduce((n, m) => n + evaluate(m.amount, state, ctx, registry), 0)));
}

/**
 * Modifiers that belong to an entity's side. A party member: her passive, the party's statuses and
 * every relic. The whole party: every member's passive, its statuses and every relic. An enemy: its
 * own and its statuses', and the party's that act `on` enemies.
 */
function modifiersOf(state: CombatState, registry: Registry, id: EntityId): ModifierDef[] {
  // Stacks an enemy applied during the enemy turn take hold once that turn is over.
  const holds = (s: StatusStack) => s.stacks - (s.pending ?? 0) > 0;
  const statusMods = (statuses: StatusStack[]) =>
    statuses.filter(holds).flatMap((s) => registry.statuses[s.status]?.modifiers ?? []);
  const relicMods = state.relics.flatMap((r) => registry.relics[r.relic]?.modifiers ?? []);
  const passive = (m: CombatState['members'][number]) => characterOf(m, registry)?.passive?.modifiers ?? [];
  const partyStatuses = statusMods(state.party.statuses);
  const own = (mods: ModifierDef[]) => mods.filter((m) => m.on === undefined);

  if (id === PARTY) return own([...state.members.flatMap(passive), ...partyStatuses, ...relicMods]);
  const member = state.members.find((m) => m.id === id);
  if (member) return own([...passive(member), ...partyStatuses, ...relicMods]);
  const enemy = state.enemies.find((e) => e.id === id);
  if (enemy) {
    const fromParty = [...state.members.flatMap(passive), ...partyStatuses, ...relicMods].filter((m) => m.on === 'enemies');
    return [...(registry.enemies[enemy.enemy]?.modifiers ?? []), ...statusMods(enemy.statuses), ...fromParty];
  }
  return [];
}
