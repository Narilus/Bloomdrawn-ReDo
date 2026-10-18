import type { OpCall, Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import type { CombatState, EntityId } from './state.ts';

export interface OpContext {
  /** The entity whose card, trigger or intent is resolving. */
  source: EntityId;
  /** The party member whose stats apply and whose ultimate charges, if any. */
  owner?: EntityId;
  /** The chosen target, if the command named one. */
  target?: EntityId;
  /** For triggered operations: the event that woke the trigger. */
  event?: EngineEvent;
}

export interface OpResult {
  events: EngineEvent[];
  /** Nested operations to resolve next, ahead of anything already queued (control flow). */
  then?: OpCall[];
}

/**
 * The only place game behaviour lives. Methods (not function properties) so an operation
 * typed with its own argument shape is still assignable to `Operation`.
 */
export interface Operation<A extends OpCall = OpCall> {
  /** Returns a reason if the operation cannot resolve right now. */
  validate?(state: CombatState, args: A, ctx: OpContext, registry: Registry): string | undefined;
  /** Mutates the draft state it is given and returns the events it raised, in order. */
  resolve(draft: CombatState, args: A, ctx: OpContext, registry: Registry): OpResult;
}
