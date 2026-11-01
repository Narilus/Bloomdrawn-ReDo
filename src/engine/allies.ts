import type { Registry } from './defs.ts';
import { allIntents } from './phases.ts';
import { isAlive, type CombatState, type Enemy } from './state.ts';

// Which ally an enemy's heal (and a heal's Shield, as in Graft) goes to (owner, 1 Nov).

const missing = (e: Enemy) => (e.maxHp - e.hp) / e.maxHp;
const mostHurt = (enemies: Enemy[]) =>
  [...enemies].sort((a, b) => a.slot - b.slot).reduce<Enemy | undefined>((best, e) => (!best || missing(e) > missing(best) ? e : best), undefined);

/** An ally that leads: a Boss (it has HP bars) or a summoner. */
function leads(enemy: Enemy, registry: Registry): boolean {
  const def = registry.enemies[enemy.enemy];
  return !!def?.phases?.length || allIntents(def).some((i) => i.effects.some((c) => c.op === 'summon'));
}

/**
 * A hurt ally that leads; else the hurt ally missing the largest share of its HP; else the enemy
 * itself. Among several, the largest share missing, then the earlier slot.
 */
export function leaderFirst(state: CombatState, self: Enemy, registry: Registry): Enemy {
  const hurt = state.enemies.filter((e) => isAlive(e) && e.id !== self.id && e.hp < e.maxHp);
  return mostHurt(hurt.filter((e) => leads(e, registry))) ?? mostHurt(hurt) ?? self;
}
