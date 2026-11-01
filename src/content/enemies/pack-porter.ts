import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Defender: a porter swallowed from behind by the seed pod his pack became.
export const packPorter = enemy({
  id: 'enemy.pack-porter', name: 'Pack Porter', hp: 80, size: 'large',
  intents: [
    { id: 'brace', name: 'Brace', effects: [gainShield(15)] },
    { id: 'shoulder-the-load', name: 'Shoulder the Load', effects: [gainShield(8, 'allies')] },
    { id: 'pack-swing', name: 'Pack Swing', effects: [damage(40, { target: 'party' })] },
  ],
});
