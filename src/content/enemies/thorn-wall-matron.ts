import { applyStatus, damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';

// Elite defender: tests burst. Heavy Shield every other turn; resists control.
export const thornWallMatron = enemy({
  id: 'enemy.thorn-wall-matron', name: 'Thorn-Wall Matron', hp: 320, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'wall', name: 'Wall', effects: [gainShield(25)] },
    { id: 'thorn-lash', name: 'Thorn Lash', effects: [damage(15, { target: 'party' }), applyStatus(bleed, 2)] },
    { id: 'wall-again', name: 'Wall', effects: [gainShield(25)] },
    { id: 'crush', name: 'Crush', effects: [damage(24, { target: 'party' })] },
  ],
});
