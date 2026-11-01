import { applyStatus, damage, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Buffer: four arms sutured on, each ending in a tool.
export const fieldSurgeon = enemy({
  id: 'enemy.field-surgeon', name: 'Field Surgeon', hp: 45,
  intents: [
    { id: 'suture', name: 'Suture', effects: [heal(12, 'lowestAlly')] },
    { id: 'lancet', name: 'Lancet', effects: [damage(22, { target: 'party' }), applyStatus(bleed, 5)] },
  ],
});
