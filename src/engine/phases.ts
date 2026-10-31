import type { EnemyDef, IntentDef, Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import { byLevel, enemyLevelScale } from './levels.ts';
import type { CombatState, Enemy, EntityId } from './state.ts';

// Enemies with several HP bars (DESIGN.md "Bosses"). Each later bar is a phase with its own
// intents. When a bar empties, the next comes up full and the rest of the hit is lost; the enemy
// takes no damage until it has acted, and that action is the phase's Rouse.

/** An enemy's max HP for a bar, raised by the fight's enemy scale. */
export const scaledHp = (hp: number, scale: number): number => Math.floor((hp * (100 + scale)) / 100);

/** An enemy's max HP for a bar at the fight's enemy level, then raised by its enemy scale. */
export const enemyMaxHp = (hp: number, state: Pick<CombatState, 'enemyScale' | 'enemyLevel'>): number =>
  scaledHp(byLevel(hp, enemyLevelScale(state.enemyLevel).hp), state.enemyScale ?? 0);

/** The intents an enemy cycles through in its current phase. */
export function intentsOf(enemy: Enemy, registry: Registry): readonly IntentDef[] {
  const def = registry.enemies[enemy.enemy];
  const phase = enemy.phase ?? 0;
  return (phase === 0 ? def?.intents : def?.phases?.[phase - 1]?.intents) ?? [];
}

/** Every intent an enemy can show, in any phase, Rouses included. */
export const allIntents = (def: EnemyDef | undefined): IntentDef[] => [
  ...(def?.intents ?? []),
  ...(def?.phases ?? []).flatMap((p) => [p.rouse, ...p.intents]),
];

/** The intent an enemy is showing now: its Rouse while rousing, else its place in the phase's cycle. */
export function intentOf(enemy: Enemy, registry: Registry): IntentDef | undefined {
  if (enemy.rousing) return registry.enemies[enemy.enemy]?.phases?.[(enemy.phase ?? 1) - 1]?.rouse;
  return enemy.intent === undefined ? undefined : intentsOf(enemy, registry)[enemy.intent];
}

/** Whether damage and HP loss pass this target by: a rousing enemy. */
export const isImmune = (state: CombatState, target: EntityId | undefined): boolean =>
  state.enemies.some((e) => e.id === target && e.rousing);

/**
 * An enemy whose HP just reached 0: it is defeated, unless it has a bar to come. Then that bar
 * comes up full (its Shield goes with the old one) and it rouses.
 */
export function fall(draft: CombatState, enemy: Enemy, source: EntityId | undefined, registry: Registry): EngineEvent {
  const next = registry.enemies[enemy.enemy]?.phases?.[enemy.phase ?? 0];
  const event: EngineEvent = { type: next ? 'barBroken' : 'enemyDefeated', target: enemy.id };
  if (source !== undefined) event.source = source;
  if (!next) return event;
  enemy.phase = (enemy.phase ?? 0) + 1;
  enemy.hp = enemy.maxHp = enemyMaxHp(next.hp, draft);
  enemy.shield = 0;
  enemy.rousing = true;
  return event;
}
