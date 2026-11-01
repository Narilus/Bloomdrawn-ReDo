import { applyStatus, damage, drawFewer } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Debuffer: her skin has become the map; her legs, a survey tripod.
export const cartographer = enemy({
  id: 'enemy.cartographer', name: 'Cartographer', hp: 50,
  intents: [
    { id: 'survey', name: 'Survey', effects: [applyStatus(vulnerable, 2)] },
    { id: 'compass-point', name: 'Compass Point', effects: [damage(30, { target: 'party' })] },
    { id: 'wrong-turn', name: 'Wrong Turn', effects: [drawFewer(1)] },
  ],
});
