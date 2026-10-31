import { encounter } from '../define.ts';

// The first encounters (docs/notes/m2-content.md): 1–3 enemies, mixing roles.

export const houndAlone = encounter({ id: 'encounter.hound', tier: 'normal', enemies: ['enemy.bloom-rib-hound'] });

export const rootsAndSmoke = encounter({
  id: 'encounter.roots-and-smoke', tier: 'normal', enemies: ['enemy.root-mat', 'enemy.censer-acolyte'],
});

export const podsAndLantern = encounter({
  id: 'encounter.pods-and-lantern', tier: 'normal', enemies: ['enemy.pod-thrower', 'enemy.lantern-surveyor'],
});

export const twoHounds = encounter({
  id: 'encounter.two-hounds', tier: 'normal',
  enemies: [{ enemy: 'enemy.bloom-rib-hound', hp: 75 }, { enemy: 'enemy.bloom-rib-hound', hp: 75 }],
});

export const thornWall = encounter({ id: 'encounter.thorn-wall', tier: 'elite', enemies: ['enemy.thorn-wall-matron'] });

export const houndMother = encounter({ id: 'encounter.hound-mother', tier: 'elite', enemies: ['enemy.hound-mother'] });

// For the lab and tests: one training dummy that never attacks. In no gauntlet pool.
export const training = encounter({ id: 'encounter.training', tier: 'normal', enemies: ['enemy.training-dummy'] });
