import { damage, gainShield, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests racing heals. A man grown into his supply wagon, cleavers for hands; resists control.
export const quartermaster = enemy({
  id: 'enemy.quartermaster', name: 'The Quartermaster', hp: 900, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'ration', name: 'Ration', effects: [heal(60)] },
    { id: 'cleaver', name: 'Cleaver', effects: [damage(55, { target: 'party' })] },
    { id: 'ration-again', name: 'Ration', effects: [heal(60)] },
    { id: 'strongbox', name: 'Strongbox', effects: [gainShield(40)] },
  ],
});
