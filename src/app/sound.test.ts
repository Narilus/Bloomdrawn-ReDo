import { describe, expect, it } from 'vitest';
import { PARTY, type EngineEvent } from '../engine/index.ts';
import { cuesOf, gainOf } from './sound.ts';

// Sound cues (M6.10): which events sound, and when, from the battlefield's beat starts and landings.

describe('cuesOf', () => {
  it('a card sounds as its lunge starts, its hit as it lands', () => {
    const events: EngineEvent[] = [
      { type: 'cardPlayed', source: 'm0', target: 'e0' },
      { type: 'damageDealt', target: 'e0', amount: 12 },
    ];
    expect(cuesOf(events, [0, 0.3], [0.3, 0.3])).toEqual([
      { cue: 'card', at: 0 },
      { cue: 'hit', at: 0.3 },
    ]);
  });

  it('tells a crit, a Tentacle hit, a tick, the party hit and a hit all on Shield apart', () => {
    const events: EngineEvent[] = [
      { type: 'damageDealt', target: 'e0', amount: 30, crit: true },
      { type: 'damageDealt', target: 'e0', amount: 9, via: 'volley' },
      { type: 'damageDealt', target: 'e0', amount: 4, status: 'status.bleed' },
      { type: 'damageDealt', target: PARTY, amount: 10, absorbed: 4 },
      { type: 'damageDealt', target: PARTY, amount: 10, absorbed: 10 },
    ];
    const at = [1, 2, 3, 4, 5];
    expect(cuesOf(events, at, at).map((c) => c.cue)).toEqual(['crit', 'tentacle', 'tick', 'hurt', 'block']);
  });

  it('one cue sounds once at a moment: a hit on three enemies, five cards drawn', () => {
    const events: EngineEvent[] = [
      ...['e0', 'e1', 'e2'].map((target): EngineEvent => ({ type: 'damageDealt', target, amount: 5 })),
      ...Array.from({ length: 5 }, (): EngineEvent => ({ type: 'cardDrawn' })),
    ];
    const at = events.map(() => 0.5);
    expect(cuesOf(events, at, at)).toEqual([
      { cue: 'hit', at: 0.5 },
      { cue: 'draw', at: 0.5 },
    ]);
  });

  it('Tentacle hits landing one after another each sound', () => {
    const events: EngineEvent[] = [1, 2, 3].map(() => ({ type: 'damageDealt', target: 'e0', amount: 9, via: 'volley' }));
    expect(cuesOf(events, [0.1, 0.2, 0.3], [0.1, 0.2, 0.3]).map((c) => c.at)).toEqual([0.1, 0.2, 0.3]);
  });

  it('an enemy sounds as it starts to act; a fall, a win and a loss as they land; a heal of nothing is silent', () => {
    const events: EngineEvent[] = [
      { type: 'enemyActed', source: 'e0' },
      { type: 'enemyDefeated', target: 'e1' },
      { type: 'healed', target: PARTY, amount: 0 },
      { type: 'combatEnd', outcome: 'victory' },
      { type: 'combatEnd', outcome: 'defeat' },
    ];
    expect(cuesOf(events, [1, 2, 2, 3, 4], [1.4, 2, 2, 3, 4])).toEqual([
      { cue: 'enemy', at: 1 },
      { cue: 'fall', at: 2 },
      { cue: 'victory', at: 3 },
      { cue: 'loss', at: 4 },
    ]);
  });

  it('bookkeeping is silent', () => {
    const events: EngineEvent[] = [{ type: 'turnStart' }, { type: 'resourceGained', resource: 'tentacles', amount: 1 }, { type: 'deckShuffled' }];
    expect(cuesOf(events, [0, 0, 0], [0, 0, 0])).toEqual([]);
  });
});

describe('gainOf', () => {
  it('is silent muted, full at 100, and a quarter at 50 (a square curve)', () => {
    expect(gainOf({ volume: 100, muted: true })).toBe(0);
    expect(gainOf({ volume: 100, muted: false })).toBe(1);
    expect(gainOf({ volume: 50, muted: false })).toBe(0.25);
    expect(gainOf({ volume: 0, muted: false })).toBe(0);
  });
});
