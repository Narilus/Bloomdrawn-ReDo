import { applyStatus, damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';
import { poison } from '../statuses/poison.ts';
import { weak } from '../statuses/weak.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests racing statuses. A red stag grafted with blooming rose branches; resists control.
export const graftedStag = enemy({
  id: 'enemy.grafted-stag', name: 'The Grafted Stag', hp: 850, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'antler-gore', name: 'Antler Gore', effects: [damage(55, { target: 'party' }), applyStatus(bleed, 10)] },
    { id: 'shed-petals', name: 'Shed Petals', effects: [applyStatus(poison, 8)] },
    { id: 'bellow', name: 'Bellow', effects: [applyStatus(weak, 2)] },
  ],
});
