import { createStreams, nextFloat, nextInt, type BannerDef } from '../engine/index.ts';
import { BLOOM, plural, type Profile } from './profile.ts';

// The gacha (docs/DESIGN.md, "Gacha"; docs/notes/m5-collection.md): SSR 3%, SR 15%, R 82%, a flat
// rate until hard pity at pull 30, and at least one SR in a ten-pull. One Purified Bloom per pull.
// Its randomness is its own seeded stream in the profile and never touches a run's. Pure.

export type Rarity = 'ssr' | 'sr' | 'r';

export const RATES: Record<Rarity, number> = { ssr: 0.03, sr: 0.15, r: 0.82 };
/** The pull that is always an SSR, counting from the last one. */
export const HARD_PITY = 30;
export const TEN_PULL = 10;
/** Dupe levels C1 to C5; another copy past C5 becomes Pollen (m5-collection.md). */
export const MAX_DUPES = 5;
/** Placeholders (m5-collection.md, "my call"). */
export const POLLEN_PER_PULL = 1;
export const POLLEN_PER_OVERFLOW = 40;

/** One pull, as audited (DESIGN.md, "Audit"). */
export interface PullRecord {
  /** The profile's pull number, from 1. */
  n: number;
  banner: string;
  rarity: Rarity;
  /** An SSR's character. */
  character?: string;
  /** Everything the pull gave, by item, Pollen included. */
  items: Record<string, number>;
  /** An SSR's dupe handling: a new character, the dupe level reached, or past C5 into Pollen. */
  dupe?: 'new' | 'overflow' | number;
  /** What made the rarity certain: hard pity, or the ten-pull's SR. */
  guarantee?: 'pity' | 'tenPull';
  pityBefore: number;
  pityAfter: number;
  bloomsBefore: number;
  bloomsAfter: number;
}

export interface Gacha {
  /** The gacha stream's state. */
  stream: number;
  /** Pulls since the last SSR, by pity family. */
  pity: Record<string, number>;
  /** Every pull, oldest first. */
  history: PullRecord[];
}

export type PullResult = { ok: true; profile: Profile; records: PullRecord[] } | { ok: false; reason: string };

/** Pulls since the last SSR on this banner's family. */
export const pityOf = (profile: Profile, banner: BannerDef) => profile.gacha?.pity[banner.pity] ?? 0;

/** Pulls `count` times (1 or a ten-pull), one Purified Bloom each. `seed` starts the stream on a profile's first pull. */
export function pull(profile: Profile, banner: BannerDef, count: 1 | typeof TEN_PULL, seed: number): PullResult {
  if (profile.pulls < count) return { ok: false, reason: `This needs ${plural(count, BLOOM)}.` };
  const rng = { gacha: profile.gacha?.stream ?? createStreams(seed, ['gacha']).gacha };
  const items = { ...profile.items };
  const dupes = { ...profile.dupes };
  const owned = [...profile.owned];
  const history = [...(profile.gacha?.history ?? [])];
  let pity = pityOf(profile, banner);
  let blooms = profile.pulls;
  const records: PullRecord[] = [];

  for (let i = 0; i < count; i++) {
    const before = { pityBefore: pity, bloomsBefore: blooms };
    let guarantee: PullRecord['guarantee'];
    let rarity: Rarity;
    if (pity + 1 >= HARD_PITY) {
      rarity = 'ssr';
      guarantee = 'pity';
    } else {
      const roll = nextFloat(rng, 'gacha');
      rarity = roll < RATES.ssr ? 'ssr' : roll < RATES.ssr + RATES.sr ? 'sr' : 'r';
    }
    if (rarity === 'r' && count === TEN_PULL && i === count - 1 && records.every((r) => r.rarity === 'r')) {
      rarity = 'sr';
      guarantee = 'tenPull';
    }

    const got: Record<string, number> = { pollen: POLLEN_PER_PULL };
    let character: string | undefined;
    let dupe: PullRecord['dupe'];
    if (rarity === 'ssr') {
      character = banner.ssr[nextInt(rng, 'gacha', banner.ssr.length)]!;
      if (!owned.includes(character)) {
        owned.push(character);
        dupe = 'new';
      } else if ((dupes[character] ?? 0) < MAX_DUPES) {
        dupe = dupes[character] = (dupes[character] ?? 0) + 1;
      } else {
        dupe = 'overflow';
        got.pollen = POLLEN_PER_PULL + POLLEN_PER_OVERFLOW;
      }
    } else if (rarity === 'sr') {
      got[banner.sr.one[nextInt(rng, 'gacha', banner.sr.one.length)]!] = banner.sr.amount;
    } else {
      Object.assign(got, banner.r);
    }
    for (const [item, n] of Object.entries(got)) items[item] = (items[item] ?? 0) + n;

    pity = rarity === 'ssr' ? 0 : pity + 1;
    blooms -= 1;
    const record: PullRecord = {
      n: history.length + 1,
      banner: banner.id,
      rarity,
      ...(character && { character }),
      items: got,
      ...(dupe !== undefined && { dupe }),
      ...(guarantee && { guarantee }),
      ...before,
      pityAfter: pity,
      bloomsAfter: blooms,
    };
    records.push(record);
    history.push(record);
  }

  const gacha: Gacha = { stream: rng.gacha, pity: { ...profile.gacha?.pity, [banner.pity]: pity }, history };
  return { ok: true, profile: { ...profile, pulls: blooms, owned, items, dupes, gacha }, records };
}
