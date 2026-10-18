import type { Operation } from '../operation.ts';

/** The shared operation library, keyed by operation name. Filled from M0.3. */
export const library: Readonly<Record<string, Operation>> = {};
