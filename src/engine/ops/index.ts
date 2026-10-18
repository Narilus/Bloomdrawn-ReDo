import type { Registry } from '../defs.ts';
import type { Operation } from '../operation.ts';
import { applyStatusOp } from './applyStatus.ts';
import { changeCostOp } from './changeCost.ts';
import { chargeUltimateOp } from './chargeUltimate.ts';
import { damageOp } from './damage.ts';
import { drawOp } from './draw.ts';
import { gainManaOp } from './gainMana.ts';
import { gainResourceOp } from './gainResource.ts';
import { gainShieldOp } from './gainShield.ts';
import { ifConsumeOp } from './ifConsume.ts';
import { loseHpOp } from './loseHp.ts';
import { manaDebtOp } from './manaDebt.ts';
import { repeatNextOp } from './repeatNext.ts';
import { volleyOp } from './volley.ts';

/** The shared operation library, keyed by operation name. */
export const library: Readonly<Record<string, Operation>> = {
  damage: damageOp,
  gainShield: gainShieldOp,
  draw: drawOp,
  gainResource: gainResourceOp,
  applyStatus: applyStatusOp,
  ifConsume: ifConsumeOp,
  loseHp: loseHpOp,
  gainMana: gainManaOp,
  manaDebt: manaDebtOp,
  chargeUltimate: chargeUltimateOp,
  volley: volleyOp,
  changeCost: changeCostOp,
  repeatNext: repeatNextOp,
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
export { changeCost } from './changeCost.ts';
export { chargeUltimate } from './chargeUltimate.ts';
export { gainMana } from './gainMana.ts';
export { loseHp } from './loseHp.ts';
export { manaDebt } from './manaDebt.ts';
export { repeatNext } from './repeatNext.ts';
export { volley } from './volley.ts';
