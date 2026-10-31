import { applyStatus, damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests kill order. The bee knots Shield the Bear, the ally with the most max HP; the Bear resists control.
export const bloomBeeKnot = enemy({
  id: 'enemy.bloom-bee-knot', name: 'Bloom-Bee Knot', hp: 70, size: 'small',
  intents: [
    { id: 'sting', name: 'Sting', effects: [damage(12, { target: 'party' }), applyStatus(poison, 2)] },
    { id: 'feed-the-hive', name: 'Feed the Hive', effects: [gainShield(25, 'largestAlly')] },
  ],
});

export const hiveBear = enemy({
  id: 'enemy.hive-bear', name: 'Hive-Bear', hp: 600, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'maul', name: 'Maul', effects: [damage(60, { target: 'party' })] },
    { id: 'rear-up', name: 'Rear Up', effects: [gainShield(30)] },
    { id: 'swipe', name: 'Swipe', effects: [damage(45, { target: 'party' })] },
  ],
});
