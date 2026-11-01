import { applyStatus, damage, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Debuffer: a great bell flower carried on jointed stalk legs. Grown by the Mother Root, it stands small beside her.

const intents: IntentDef[] = [
  { id: 'pollen-veil', name: 'Pollen Veil', effects: [applyStatus(weak, 2), applyStatus(poison, 5)] },
  { id: 'tendril-lash', name: 'Tendril Lash', effects: [damage(30, { target: 'party' })] },
  { id: 'spore-fall', name: 'Spore-Fall', effects: [applyStatus(vulnerable, 2)] },
];

export const petalHorror = enemy({ id: 'enemy.petal-horror', name: 'Petal Horror', hp: 60, size: 'large', intents });

export const grownPetalHorror = enemy({ id: 'enemy.grown-petal-horror', name: 'Petal Horror', hp: 60, size: 'small', intents });
