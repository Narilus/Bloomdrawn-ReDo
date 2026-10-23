import { encounter } from '../define.ts';

// The M4 Boss (docs/notes/m4-run.md). A Boss fight that starts at Fruiting is Full Bloom instead.
export const hollowAbbess = encounter({
  id: 'encounter.hollow-abbess', tier: 'boss', enemies: ['enemy.hollow-abbess'], fruiting: 'encounter.hollow-abbess-full-bloom',
});

export const hollowAbbessFullBloom = encounter({ id: 'encounter.hollow-abbess-full-bloom', tier: 'boss', enemies: ['enemy.hollow-abbess-full-bloom'] });
