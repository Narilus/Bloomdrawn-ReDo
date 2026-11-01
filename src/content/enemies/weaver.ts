import { damage, drawFewer } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests a thin hand. Bind twice in four leaves the party a card short; resists control.
export const weaver = enemy({
  id: 'enemy.weaver', name: 'The Weaver', hp: 850, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'bind', name: 'Bind', effects: [drawFewer(1)] },
    { id: 'lash', name: 'Lash', effects: [damage(50, { target: 'party' })] },
    { id: 'bind-again', name: 'Bind', effects: [drawFewer(1)] },
    { id: 'reel-in', name: 'Reel In', effects: [damage(95, { target: 'party' })] },
  ],
});
