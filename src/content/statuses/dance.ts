import { status } from '../define.ts';

// Isadora's ultimate (docs/notes/banner-kits.md): every volley fires twice this turn, the end-of-turn
// attack included, each pass choosing its targets from the HP the last left.
export const danceOfBells = status({
  id: 'status.dance-of-bells', stacking: 'highest', endsWithTurn: true,
  help: 'This turn, every volley hits twice, the end-of-turn attack included.',
  modifiers: [{ value: 'volleys', step: 'flat', amount: 1 }],
});
