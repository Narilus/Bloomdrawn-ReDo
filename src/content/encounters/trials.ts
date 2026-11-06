import { encounter } from '../define.ts';

// Trials (docs/notes/trials.md): one boss per Domain, fought straight at the tier's level, never
// drawn on the map (the labyrinth's pools name their encounters). The Hierophant stands in the
// middle, so her Limbs rise in front of her rather than behind (owner, 6 Nov).
export const grandAnatomist = encounter({ id: 'encounter.grand-anatomist', tier: 'boss', enemies: ['enemy.grand-anatomist'] });
export const veiledHierophant = encounter({ id: 'encounter.veiled-hierophant', tier: 'boss', enemies: [{ enemy: 'enemy.veiled-hierophant', slot: 1 }] });
export const kirinOracle = encounter({ id: 'encounter.kirin-oracle', tier: 'boss', enemies: ['enemy.kirin-oracle'] });
export const ringmaster = encounter({ id: 'encounter.ringmaster', tier: 'boss', enemies: ['enemy.ringmaster'] });
