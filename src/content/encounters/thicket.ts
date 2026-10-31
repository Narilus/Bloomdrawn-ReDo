import { encounter } from '../define.ts';

// Band 2, the Thicket, Depths 11–20 (docs/notes/bestiary.md). A Boss fight that starts at Fruiting is Full Bloom instead.

export const heronAndMoth = encounter({ id: 'encounter.heron-and-moth', tier: 'normal', enemies: ['enemy.heron-stalk', 'enemy.moth-mantle'] });
export const boarAndHeron = encounter({ id: 'encounter.boar-and-heron', tier: 'normal', enemies: ['enemy.thornback-boar', 'enemy.heron-stalk'] });
export const litterMound = encounter({ id: 'encounter.litter-mound', tier: 'normal', enemies: ['enemy.litter-mound'] });
export const mothAndBoar = encounter({ id: 'encounter.moth-and-boar', tier: 'normal', enemies: ['enemy.moth-mantle', 'enemy.thornback-boar'] });
export const twoHerons = encounter({ id: 'encounter.two-herons', tier: 'normal', enemies: ['enemy.heron-stalk', 'enemy.heron-stalk'] });

export const threeThroatedWolf = encounter({ id: 'encounter.three-throated-wolf', tier: 'elite', enemies: ['enemy.three-throated-wolf'] });
export const hiveBear = encounter({ id: 'encounter.hive-bear', tier: 'elite', enemies: ['enemy.hive-bear', 'enemy.bloom-bee-knot', 'enemy.bloom-bee-knot'] });

export const gatheredBeast = encounter({
  id: 'encounter.gathered-beast', tier: 'boss', enemies: ['enemy.gathered-beast'], fruiting: 'encounter.gathered-beast-full-bloom',
});
export const gatheredBeastFullBloom = encounter({ id: 'encounter.gathered-beast-full-bloom', tier: 'boss', enemies: ['enemy.gathered-beast-full-bloom'] });
