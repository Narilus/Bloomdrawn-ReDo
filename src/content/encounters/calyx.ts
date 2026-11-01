import { encounter } from '../define.ts';

// Band 4, the Calyx, Depths 31–40 (docs/notes/bestiary.md). A Boss fight that starts at Fruiting is Full Bloom instead.

export const stiltGrazer = encounter({ id: 'encounter.stilt-grazer', tier: 'normal', enemies: ['enemy.stilt-grazer'] });
export const pollinatorAndGardener = encounter({ id: 'encounter.pollinator-and-gardener', tier: 'normal', enemies: ['enemy.pollinator', 'enemy.gardener'] });
export const bladderAndPollinator = encounter({ id: 'encounter.bladder-and-pollinator', tier: 'normal', enemies: ['enemy.seed-bladder', 'enemy.pollinator'] });
export const grazerAndGardener = encounter({ id: 'encounter.grazer-and-gardener', tier: 'normal', enemies: ['enemy.stilt-grazer', 'enemy.gardener'] });
export const twoPollinators = encounter({ id: 'encounter.two-pollinators', tier: 'normal', enemies: ['enemy.pollinator', 'enemy.pollinator'] });

export const weaver = encounter({ id: 'encounter.weaver', tier: 'elite', enemies: ['enemy.weaver'] });
export const pollenQueen = encounter({
  id: 'encounter.pollen-queen', tier: 'elite', enemies: ['enemy.pollen-queen', 'enemy.attending-pollinator', 'enemy.attending-pollinator'],
});

export const crownedPistil = encounter({
  id: 'encounter.crowned-pistil', tier: 'boss', enemies: ['enemy.crowned-pistil'], fruiting: 'encounter.crowned-pistil-full-bloom',
});
export const crownedPistilFullBloom = encounter({ id: 'encounter.crowned-pistil-full-bloom', tier: 'boss', enemies: ['enemy.crowned-pistil-full-bloom'] });
