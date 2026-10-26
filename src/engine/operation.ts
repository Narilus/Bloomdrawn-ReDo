import type { z } from 'zod';
import type { OpCall, Registry } from './defs.ts';
import type { EngineEvent } from './events.ts';
import type { Formula } from './formula.ts';
import type { CombatState, EntityId, Vitals } from './state.ts';

export interface OpContext {
  /** The entity whose card, trigger or intent is resolving. */
  source: EntityId;
  /** The party member whose stats apply and whose ultimate charges, if any. */
  owner?: EntityId;
  /** The chosen target, if the command named one. */
  target?: EntityId;
  /** For triggered operations: the event that woke the trigger. */
  event?: EngineEvent;
  /** Inside an ifConsume branch: the amount just spent. */
  consumed?: number;
  /** The card being played, if a card is resolving (not a trigger or an ultimate). */
  card?: EntityId;
}

export interface OpResult {
  events: EngineEvent[];
  /** Nested operations to resolve next, ahead of anything already queued (control flow). */
  then?: OpCall[];
  /** Passed to the `then` operations as `ctx.consumed`. */
  consumed?: number;
  /** HP and Shield right after each of `events`, from an operation that lands several hits in one go. */
  vitals?: Vitals[];
}

/** What an operation would do, computed by the same code that resolves it. */
export interface Preview {
  op: string;
  target?: EntityId;
  /** Final amount after the modifier pipeline (for damage: before Shield). */
  amount?: number;
  /** Damage that Shield would absorb. */
  absorbed?: number;
  resource?: string;
  status?: string;
  /** Control flow: whether the branch would resolve, and what it would do. */
  resolves?: boolean;
  branch?: Preview[];
}

/** Renders a formula in card text: as `6 + Attack`, or as the live number for this owner. */
export type ShowAmount = (f: Formula, value?: 'damage' | 'shield') => string;

/**
 * The only place game behaviour lives. Methods (not function properties) so an operation
 * typed with its own argument shape is still assignable to `Operation`.
 */
export interface Operation<A extends OpCall = OpCall> {
  /** Arguments schema, used by registry validation. */
  args: z.ZodType;
  /** Returns a reason if the operation cannot resolve right now. */
  validate?(state: CombatState, args: A, ctx: OpContext, registry: Registry): string | undefined;
  /** Mutates the draft state it is given and returns the events it raised, in order. */
  resolve(draft: CombatState, args: A, ctx: OpContext, registry: Registry): OpResult;
  /** The same calculation as resolve, without changing state. */
  preview(state: CombatState, args: A, ctx: OpContext, registry: Registry): Preview[];
  /** Generated rules text, e.g. `Deal 6 + Attack damage`. */
  describe(args: A, show: ShowAmount, registry: Registry): string;
  /** Nested operation calls held by control-flow operations. */
  children?(args: A): OpCall[];
}
