import type { Registry } from '../defs.ts';
import type { Operation } from '../operation.ts';
import { applyStatusOp } from './applyStatus.ts';
import { changeCostOp } from './changeCost.ts';
import { chargeUltimateOp } from './chargeUltimate.ts';
import { clearStatusesOp } from './clearStatuses.ts';
import { damageOp } from './damage.ts';
import { drawOp } from './draw.ts';
import { drawFewerOp } from './drawFewer.ts';
import { gainManaOp } from './gainMana.ts';
import { gainResourceOp } from './gainResource.ts';
import { gainShieldOp } from './gainShield.ts';
import { healOp } from './heal.ts';
import { ifConsumeOp } from './ifConsume.ts';
import { loseHpOp } from './loseHp.ts';
import { manaDebtOp } from './manaDebt.ts';
import { reduceStacksOp } from './reduceStacks.ts';
import { transcendOp } from './transcend.ts';
import { createCardOp } from './createCard.ts';
import { summonOp } from './summon.ts';
import { repeatNextOp } from './repeatNext.ts';
import { volleyOp } from './volley.ts';
import { whenOp } from './when.ts';

/** The shared operation library, keyed by operation name. */
export const library: Readonly<Record<string, Operation>> = {
  damage: damageOp,
  gainShield: gainShieldOp,
  draw: drawOp,
  drawFewer: drawFewerOp,
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
  heal: healOp,
  when: whenOp,
  reduceStacks: reduceStacksOp,
  transcend: transcendOp,
  createCard: createCardOp,
  summon: summonOp,
  clearStatuses: clearStatusesOp,
};

export function getOp(registry: Registry, name: string): Operation | undefined {
  return library[name] ?? registry.customOps?.[name];
}

export { applyStatus } from './applyStatus.ts';
export { damage } from './damage.ts';
export { draw } from './draw.ts';
export { drawFewer } from './drawFewer.ts';
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
export { heal } from './heal.ts';
export { gte, when } from './when.ts';
export { reduceStacks } from './reduceStacks.ts';
export { transcend } from './transcend.ts';
export { createCard } from './createCard.ts';
export { summon } from './summon.ts';
export { clearStatuses } from './clearStatuses.ts';
