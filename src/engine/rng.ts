// Small seeded PRNG (mulberry32) with named streams. Each stream is one uint32 stored in
// state, so drawing from one stream never shifts another. Functions mutate the streams
// object they are given; the engine only ever passes a draft copy.

export type Streams<K extends string> = Record<K, number>;

const fnv1a = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// murmur3 finaliser: spreads nearby seeds so streams start far apart.
const mix = (x: number): number => {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
};

export function createStreams<K extends string>(seed: number, names: readonly K[]): Streams<K> {
  const streams = {} as Streams<K>;
  for (const name of names) streams[name] = mix((seed >>> 0) ^ fnv1a(name));
  return streams;
}

/** A float in [0, 1). */
export function nextFloat<K extends string>(streams: Streams<K>, name: K): number {
  const state = (streams[name] + 0x6d2b79f5) >>> 0;
  streams[name] = state;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [0, maxExclusive). */
export function nextInt<K extends string>(streams: Streams<K>, name: K, maxExclusive: number): number {
  return Math.floor(nextFloat(streams, name) * maxExclusive);
}

/** Fisher–Yates shuffle in place. */
export function shuffleInPlace<T, K extends string>(items: T[], streams: Streams<K>, name: K): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(streams, name, i + 1);
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
}
