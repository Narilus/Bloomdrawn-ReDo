import { status } from '../define.ts';

// The Open-Hearted Queen's Vines (owner, 1 Nov): a count that only grows. The Vines hits once for
// each, so the count on her badge is the number of hits. Her Rouse clears it.
export const vines = status({
  id: 'status.vines', stacking: 'add', icon: 'tentacle',
  help: 'The Vines hits once for each Vine. They never wear off; a Rouse clears them.',
});
