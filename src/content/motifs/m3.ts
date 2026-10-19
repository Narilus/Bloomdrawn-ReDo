import { motif } from '../define.ts';

// The M3 motif set (docs/notes/m3-labyrinth.md). Drawn heading east, with the legend in
// src/game/motif.ts: E joint, X exit, o socket, . path, F fight, L elite, B boss, V event,
// S shop, C camp, Y Symptom, K Collapsing. Odd rows sit half a hex to the right.

// --- The main route: start, a fork, the temptation loop, the Boss ---

export const startGate = motif({
  id: 'motif.start-gate', place: 'start',
  rows: ['E o F X'],
});

/** The route splits around an elite and a fight: pick one. */
export const forkElite = motif({
  id: 'motif.fork-elite', place: 'route',
  rows: [
    'E L',
    ' F o X',
  ],
});

/** The route splits around an elite and an Event. */
export const forkEliteEvent = motif({
  id: 'motif.fork-elite-event', place: 'route',
  rows: [
    'E L',
    ' V o X',
  ],
});

/**
 * The owner's diagram: a ring from the route up to a Shop and back. In through one Collapsing tile,
 * out through the other, each gone once stepped off; any return goes through the Symptom.
 */
export const temptationLoop = motif({
  id: 'motif.temptation-loop', place: 'route',
  rows: [
    '  . . S .',
    ' K Y     .',
    '  .       K',
    '   .       .',
    '  E . o F . o X',
  ],
});

export const bossApproach = motif({
  id: 'motif.boss-approach', place: 'end',
  rows: ['E V C B'],
});

// --- Side motifs, hung off sockets ---

export const eliteBranch = motif({
  id: 'motif.elite-branch', place: 'side',
  rows: ['E . . F . . L'],
});

export const campNook = motif({
  id: 'motif.camp-nook', place: 'side',
  rows: ['E . . F . . C'],
});

export const eventAlcove = motif({
  id: 'motif.event-alcove', place: 'side',
  rows: ['E . V . . F . V'],
});

// A ring of path with something at its far side, reached either way round. The empty first row
// keeps the drawing on the even/odd row pattern.

export const groveFight = motif({
  id: 'motif.grove-fight', place: 'side',
  rows: [
    '',
    '   . .',
    'E .   F',
    '   . .',
  ],
});

export const groveStall = motif({
  id: 'motif.grove-stall', place: 'side',
  rows: [
    '',
    '   . .',
    'E .   S',
    '   . .',
  ],
});
