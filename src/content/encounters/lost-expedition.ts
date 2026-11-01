import { encounter } from '../define.ts';

// Band 3, the Lost Expedition, Depths 21–30 (docs/notes/bestiary.md). A Boss fight that starts at Fruiting is Full Bloom instead.
// Content warnings: body horror, surgical imagery.

export const porterAndSurgeon = encounter({ id: 'encounter.porter-and-surgeon', tier: 'normal', enemies: ['enemy.pack-porter', 'enemy.field-surgeon'] });
export const cartographerAndSurgeon = encounter({ id: 'encounter.cartographer-and-surgeon', tier: 'normal', enemies: ['enemy.cartographer', 'enemy.field-surgeon'] });
export const tentWalker = encounter({ id: 'encounter.tent-walker', tier: 'normal', enemies: ['enemy.tent-walker'] });
export const porterAndCartographer = encounter({ id: 'encounter.porter-and-cartographer', tier: 'normal', enemies: ['enemy.pack-porter', 'enemy.cartographer'] });
export const tentWalkerAndSurgeon = encounter({ id: 'encounter.tent-walker-and-surgeon', tier: 'normal', enemies: ['enemy.tent-walker', 'enemy.field-surgeon'] });

export const quartermaster = encounter({ id: 'encounter.quartermaster', tier: 'elite', enemies: ['enemy.quartermaster'] });
export const cocoonedScout = encounter({ id: 'encounter.cocooned-scout', tier: 'elite', enemies: ['enemy.cocooned-scout'] });

export const expeditionLeader = encounter({
  id: 'encounter.expedition-leader', tier: 'boss', enemies: ['enemy.expedition-leader'], fruiting: 'encounter.expedition-leader-full-bloom',
});
export const expeditionLeaderFullBloom = encounter({ id: 'encounter.expedition-leader-full-bloom', tier: 'boss', enemies: ['enemy.expedition-leader-full-bloom'] });
