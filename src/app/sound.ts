import { PARTY, type EngineEvent } from '../engine/index.ts';
import { SOUND_VOLUME } from '../game/profile.ts';

// Sound (M6.10; docs/notes/audio.md): CC0 effects for cards, hits and the UI. Each cue is a file in
// `src/assets/sound/` named after it (`hit.ogg`, or `hit-1.ogg`, `hit-2.ogg` to take turns); a cue
// with no file is silent. The battlefield says when each event's beat starts and lands, and the
// cues play then, so a sound never runs ahead of the hit it belongs to.

export const CUES = [
  // The UI: any button.
  'click',
  // Cards and actions: a card played or drawn, an ultimate, a Transcend, an enemy acting.
  'card', 'draw', 'ultimate', 'transcend', 'enemy',
  // Outcomes: a hit, a crit, a Tentacle's hit, a damage-over-time tick, the party hit, a hit all on Shield.
  'hit', 'crit', 'tentacle', 'tick', 'hurt', 'block',
  'shield', 'heal', 'status',
  // An enemy falls, a Boss's bar breaks, the fight is won or lost.
  'fall', 'phase', 'victory', 'loss',
  // Banners: the results come up, with an SSR among them.
  'pull', 'ssr',
] as const;

export type Cue = (typeof CUES)[number];

export interface Scheduled {
  cue: Cue;
  /** Seconds from now. */
  at: number;
}

function cueOf(event: EngineEvent): { cue: Cue; start?: true } | undefined {
  switch (event.type) {
    case 'cardPlayed':
      return { cue: 'card', start: true };
    case 'cardDrawn':
      return { cue: 'draw' };
    case 'ultimateFired':
      return { cue: 'ultimate', start: true };
    case 'transcended':
      return { cue: 'transcend' };
    case 'enemyActed':
      return { cue: 'enemy', start: true };
    case 'damageDealt': {
      if (event.status) return { cue: 'tick' };
      if ((event.amount ?? 0) > 0 && event.absorbed === event.amount) return { cue: 'block' };
      if (event.target === PARTY) return { cue: 'hurt' };
      if (event.crit) return { cue: 'crit' };
      return { cue: event.via === 'volley' ? 'tentacle' : 'hit' };
    }
    case 'shieldGained':
      return { cue: 'shield' };
    case 'healed':
      return event.amount ? { cue: 'heal' } : undefined;
    case 'statusApplied':
      return { cue: 'status' };
    case 'enemyDefeated':
      return { cue: 'fall' };
    case 'barBroken':
      return { cue: 'phase' };
    case 'combatEnd':
      return { cue: event.outcome === 'defeat' ? 'loss' : 'victory' };
    default:
      return undefined;
  }
}

/** Cues a status yields to: a status a hit applies lands with the hit, and the hit is heard alone (owner, 21 Nov). */
const HITS: ReadonlySet<Cue> = new Set(['hit', 'crit', 'tentacle', 'tick', 'hurt', 'block']);

/**
 * The cues for a sequence of events, given when each event's beat starts and when it lands (the
 * battlefield's `play`). A card, an ultimate and an enemy's action sound as the lunge begins; the
 * rest as they land. One cue sounds once at a moment, however many events share it, and a status
 * is silent at a moment a hit sounds.
 */
export function cuesOf(events: readonly EngineEvent[], starts: readonly number[], lands: readonly number[]): Scheduled[] {
  const out: Scheduled[] = [];
  const seen = new Set<string>();
  events.forEach((event, i) => {
    const found = cueOf(event);
    if (!found) return;
    const at = (found.start ? starts[i] : lands[i]) ?? 0;
    const key = `${found.cue}@${Math.round(at * 1000)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ cue: found.cue, at });
  });
  const struck = new Set(out.filter((c) => HITS.has(c.cue)).map((c) => Math.round(c.at * 1000)));
  return out.filter((c) => c.cue !== 'status' || !struck.has(Math.round(c.at * 1000)));
}

/** Volume out of 100 to gain, on a square curve so the slider's middle sounds like the middle. */
export const gainOf = ({ volume, muted }: { volume: number; muted: boolean }) => (muted ? 0 : Math.min(1, Math.max(0, volume / 100)) ** 2);

const FILES = import.meta.glob<string>('../assets/sound/*.{ogg,mp3,wav}', { eager: true, query: '?url', import: 'default' });
/** Each cue's files, from their names. */
const BY_CUE = new Map<string, string[]>();
for (const [path, url] of Object.entries(FILES)) {
  const cue = /([a-z]+)(?:-\d+)?\.\w+$/.exec(path)?.[1];
  if (cue) BY_CUE.set(cue, [...(BY_CUE.get(cue) ?? []), url]);
}

let settings = { volume: SOUND_VOLUME, muted: false };
let context: AudioContext | undefined;
let master: GainNode | undefined;
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
const turn = new Map<string, number>();

/** Applies volume and mute from now on. */
export function configureSound(next: { volume: number; muted: boolean }) {
  settings = next;
  if (master) master.gain.value = gainOf(settings);
}

function audio(): { context: AudioContext; master: GainNode } | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  if (!context || !master) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = gainOf(settings);
    master.connect(context.destination);
  }
  // Browsers start audio suspended until the player has clicked or pressed a key.
  if (context.state === 'suspended') void context.resume();
  return { context, master };
}

function load(ctx: AudioContext, url: string): Promise<AudioBuffer | undefined> {
  let buffer = buffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes))
      .catch(() => undefined);
    buffers.set(url, buffer);
  }
  return buffer;
}

/** Plays cues at their times from now. Nothing happens while muted or for a cue with no file. */
export function playCues(cues: readonly Scheduled[]) {
  if (gainOf(settings) === 0) return;
  const heard = cues.filter((c) => BY_CUE.has(c.cue));
  if (heard.length === 0) return;
  const out = audio();
  if (!out) return;
  const base = out.context.currentTime;
  for (const { cue, at } of heard) {
    const files = BY_CUE.get(cue)!;
    const n = turn.get(cue) ?? 0;
    turn.set(cue, n + 1);
    void load(out.context, files[n % files.length]!).then((buffer) => {
      if (!buffer) return;
      const source = out.context.createBufferSource();
      source.buffer = buffer;
      source.connect(out.master);
      source.start(Math.max(out.context.currentTime, base + at));
    });
  }
}

export const playCue = (cue: Cue) => playCues([{ cue, at: 0 }]);

/** Every button in the game clicks. Cards in the hand aren't buttons; they sound as they're played. */
export function listenForClicks(root: Document = document) {
  const onClick = (e: MouseEvent) => {
    const button = (e.target as Element | null)?.closest?.('button');
    if (button && !button.disabled) playCue('click');
  };
  root.addEventListener('click', onClick, true);
  return () => root.removeEventListener('click', onClick, true);
}
