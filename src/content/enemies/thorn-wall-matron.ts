import { applyStatus, damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Elite defender: tests burst. Heavy Shield every other turn; resists control.
export const thornWallMatron = enemy({
  id: 'enemy.thorn-wall-matron', name: 'Thorn-Wall Matron', hp: 930, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'wall', name: 'Wall', effects: [gainShield(75)] },
    { id: 'thorn-lash', name: 'Thorn Lash', effects: [damage(63, { target: 'party' }), applyStatus(bleed, 8)] },
    { id: 'wall-again', name: 'Wall', effects: [gainShield(75)] },
    { id: 'crush', name: 'Crush', effects: [damage(100, { target: 'party' })] },
  ],
});
