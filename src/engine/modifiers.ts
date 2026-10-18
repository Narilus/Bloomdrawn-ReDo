import type { ModifierDef, Registry } from './defs.ts';
import { evaluate, type Formula } from './formula.ts';
import type { OpContext } from './operation.ts';
import { PARTY, type CombatState, type EntityId } from './state.ts';

/**
 * The one modifier pipeline. Steps: base formula, flat outgoing, outgoing multipliers,
 * incoming multipliers (damage with a target only). Rounds down at every step and never
 * goes below 0. Shield absorption is the damage operation's step 5.
 */
export function pipeline(
  value: 'damage' | 'shield',
  base: Formula,
  state: CombatState,
  ctx: OpContext,
  registry: Registry,
  target?: EntityId,
): number {
  const outgoing = modifiersOf(state, registry, ctx.source).filter((m) => m.value === value);
  const sum = (mods: ModifierDef[]) => mods.reduce((n, m) => n + evaluate(m.amount, state, ctx, registry), 0);
  const scale = (n: number, mods: ModifierDef[]) =>
    mods.reduce((x, m) => Math.floor(x * evaluate(m.amount, state, ctx, registry)), n);

  let amount = Math.floor(evaluate(base, state, ctx, registry));
  amount += Math.floor(sum(outgoing.filter((m) => m.step === 'flat')));
  amount = scale(amount, outgoing.filter((m) => m.step === 'outgoingMul'));
  if (value === 'damage' && target !== undefined) {
    const incoming = modifiersOf(state, registry, target).filter((m) => m.value === value);
    amount = scale(amount, incoming.filter((m) => m.step === 'incomingMul'));
  }
  return Math.max(0, amount);
}

/**
 * Modifiers that belong to an entity's side. A party member: her passive, her statuses and
 * every relic. The whole party: every member's and every relic's. An enemy: its own and its statuses'.
 */
function modifiersOf(state: CombatState, registry: Registry, id: EntityId): ModifierDef[] {
  const statusMods = (statuses: { status: string }[]) =>
    statuses.flatMap((s) => registry.statuses[s.status]?.modifiers ?? []);
  const relicMods = state.relics.flatMap((r) => registry.relics[r.relic]?.modifiers ?? []);
  const memberMods = (m: CombatState['members'][number]) => [
    ...(registry.characters[m.character]?.passive?.modifiers ?? []),
    ...statusMods(m.statuses),
  ];

  if (id === PARTY) return [...state.members.flatMap(memberMods), ...relicMods];
  const member = state.members.find((m) => m.id === id);
  if (member) return [...memberMods(member), ...relicMods];
  const enemy = state.enemies.find((e) => e.id === id);
  if (enemy) return [...(registry.enemies[enemy.enemy]?.modifiers ?? []), ...statusMods(enemy.statuses)];
  return [];
}
