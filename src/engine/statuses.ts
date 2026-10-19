import type { Registry, StatusDef } from './defs.ts';
import { isAlive, PARTY, type CombatState, type EntityId, type StatusStack } from './state.ts';

/** Who holds statuses for an entity: an enemy holds its own; the party and every member share the party's. */
export interface Bearer {
  id: EntityId;
  statuses: StatusStack[];
  resistsControl: boolean;
}

export function bearerOf(state: CombatState, id: EntityId | undefined, registry: Registry): Bearer | undefined {
  if (id === PARTY || state.members.some((m) => m.id === id)) return { id: PARTY, statuses: state.party.statuses, resistsControl: false };
  const enemy = state.enemies.find((e) => e.id === id);
  if (!enemy || !isAlive(enemy)) return undefined;
  const resistsControl = !!registry.enemies[enemy.enemy]?.traits?.includes('resistsControl');
  return { id: enemy.id, statuses: enemy.statuses, resistsControl };
}

/** The status that actually lands on a bearer: control statuses become their resisted form on those who resist. */
export function landingStatus(bearer: Bearer, status: string, registry: Registry): string {
  const def = registry.statuses[status];
  return bearer.resistsControl && def?.resistedAs ? def.resistedAs : status;
}

export function stacksOf(statuses: readonly StatusStack[], status: string): number {
  return statuses.find((s) => s.status === status)?.stacks ?? 0;
}

/** Adds stacks by the status's stacking rule. */
export function addStacks(statuses: StatusStack[], def: StatusDef, stacks: number): void {
  const existing = statuses.find((s) => s.status === def.id);
  if (!existing) statuses.push({ status: def.id, stacks });
  else if (def.stacking === 'add') existing.stacks += stacks;
  else if (def.stacking === 'refresh') existing.stacks = stacks;
  else existing.stacks = Math.max(existing.stacks, stacks);
}

/** Removes stacks; at 0 the status is gone. Returns whether it was removed. */
export function takeStacks(statuses: StatusStack[], status: string, stacks: number): boolean {
  const index = statuses.findIndex((s) => s.status === status);
  const existing = statuses[index];
  if (!existing) return false;
  existing.stacks -= stacks;
  if (existing.stacks > 0) return false;
  statuses.splice(index, 1);
  return true;
}
