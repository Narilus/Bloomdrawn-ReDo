import { applyStatus, damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { cocooned } from '../statuses/cocoon.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests timing. One turn in a cycle of four, never more (bestiary-direction.md 5.1): it takes no
// damage until it Unfurls, then is Vulnerable until its next action, the turn to burst. Resists control.
export const cocoonedScout = enemy({
  id: 'enemy.cocooned-scout', name: 'The Cocooned Scout', hp: 750, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'cocoon', name: 'Cocoon', effects: [applyStatus(cocooned, 1, 'self')] },
    { id: 'unfurl', name: 'Unfurl', effects: [damage(70, { target: 'party' }), applyStatus(vulnerable, 1, 'self')] },
    { id: 'wing-cut', name: 'Wing Cut', effects: [damage(45, { target: 'party' })] },
    { id: 'moth-dust', name: 'Moth Dust', effects: [applyStatus(weak, 2)] },
  ],
});
