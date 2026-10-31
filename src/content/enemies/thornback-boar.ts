import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Defender: a boar's front half sutured to a badger's, its split spine a row of tulip cups.
export const thornbackBoar = enemy({
  id: 'enemy.thornback-boar', name: 'Thornback Boar', hp: 70,
  intents: [
    { id: 'root-down', name: 'Root Down', effects: [gainShield(10, 'allies')] },
    { id: 'gore', name: 'Gore', effects: [damage(40, { target: 'party' })] },
  ],
});
