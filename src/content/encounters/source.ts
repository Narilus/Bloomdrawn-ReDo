import { encounter } from '../define.ts';

// Band 5, the source, Depths 41–50 (docs/notes/bestiary.md). A Boss fight that starts at Fruiting is Full Bloom instead.
// In a pair, the Devourer and the Husk come with less HP, so the fight stays within three turns.

export const blossomDevourer = encounter({ id: 'encounter.blossom-devourer', tier: 'normal', enemies: ['enemy.blossom-devourer'] });
export const huskAndPetalHorror = encounter({ id: 'encounter.husk-and-petal-horror', tier: 'normal', enemies: [{ enemy: 'enemy.garden-husk', hp: 60 }, 'enemy.petal-horror'] });
// Three slots: the Gardener anchors and the Husks flank it small, so the anchor stands tallest.
export const twoHusksAndGardener = encounter({
  id: 'encounter.two-husks-and-gardener', tier: 'normal', enemies: ['enemy.gardener', 'enemy.sown-husk', 'enemy.sown-husk'],
});
export const devourerAndPetalHorror = encounter({
  id: 'encounter.devourer-and-petal-horror', tier: 'normal', enemies: [{ enemy: 'enemy.blossom-devourer', hp: 90 }, 'enemy.petal-horror'],
});

export const graftedStag = encounter({ id: 'encounter.grafted-stag', tier: 'elite', enemies: ['enemy.grafted-stag'] });
export const seedMother = encounter({ id: 'encounter.seed-mother', tier: 'elite', enemies: ['enemy.seed-mother'] });

export const motherRoot = encounter({ id: 'encounter.mother-root', tier: 'boss', enemies: ['enemy.mother-root'], fruiting: 'encounter.mother-root-full-bloom' });
export const motherRootFullBloom = encounter({ id: 'encounter.mother-root-full-bloom', tier: 'boss', enemies: ['enemy.mother-root-full-bloom'] });
