import type { Registry } from '../defs.ts';
import type { Operation } from '../operation.ts';
import { applyStatusOp } from './applyStatus.ts';
import { damageOp } from './damage.ts';
import { drawOp } from './draw.ts';
import { gainResourceOp } from './gainResource.ts';
import { gainShieldOp } from './gainShield.ts';
import { ifConsumeOp } from './ifConsume.ts';

/** The shared operation library, keyed by operation name. */
export const library: Readonly<Record<string, Operation>> = {
  damage: damageOp,
  gainShield: gainShieldOp,
  draw: drawOp,
  gainResource: gainResourceOp,
  applyStatus: applyStatusOp,
  ifConsume: ifConsumeOp,
};

export function getOp(registry: Registry, name: string): Operation | undefined {
  return library[name] ?? registry.customOps?.[name];
}

export { applyStatus } from './applyStatus.ts';
export { damage } from './damage.ts';
export { draw } from './draw.ts';
export { gainResource } from './gainResource.ts';
export { gainShield } from './gainShield.ts';
export { ifConsume } from './ifConsume.ts';
