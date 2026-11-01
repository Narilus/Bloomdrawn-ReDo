import { createStreams, nextFloat, nextInt, type BannerDef } from '../engine/index.ts';
import { BLOOM, plural, type Profile } from './profile.ts';
import { gainExp, SSR_SELECTOR } from './profileLevel.ts';

// The gacha (docs/DESIGN.md, "Gacha"; docs/notes/m5-collection.md): SSR 3%, SR 15%, R 82%, a flat
// rate until hard pity at pull 30, and at least one SR in a ten-pull. One Purified Bloom per pull.
// One character banner with a Focus the player picks from its pool (owner, 28 Oct): each SSR is a
// 50/50 between the Focus and another pool character, and after two losses the next is the Focus.
// Pity and the loss count belong to the profile, by family, and survive a change of Focus. Its
// randomness is its own seeded stream in the profile and never touches a run's. Pure.

export type Rarity = 'ssr' | 'sr' | 'r';

export const RATES: Record<Rarity, number> = { ssr: 0.03, sr: 0.15, r: 0.82 };
/** The pull that is always an SSR, counting from the last one. */
export const HARD_PITY = 30;
export const TEN_PULL = 10;
/** Dupe levels C1 to C5; another copy past C5 becomes Pollen (m5-collection.md). */
export const MAX_DUPES = 5;
/** The chance an SSR is the Focus, and the losses after which the next SSR is. */
export const FOCUS_CHANCE = 0.5;
export const LOSSES_TO_GUARANTEE = 2;
/** Placeholders (m5-collection.md, "my call"). */
export const POLLEN_PER_PULL = 1;
export const POLLEN_PER_OVERFLOW = 40;
export const POLLEN_PER_LOSS = 10;

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
  /** The Focus when pulled; none on the old Standard banner's pulls. */
  focus?: string;
  /** An SSR's 50/50: won, lost, or the Focus guaranteed by two losses. */
  fiftyFifty?: 'won' | 'lost' | 'guaranteed';
  /** What made the rarity certain: hard pity, or the ten-pull's SR. */
  guarantee?: 'pity' | 'tenPull';
  pityBefore: number;
  pityAfter: number;
  /** 50/50s lost in a row, before and after. */
  lossesBefore: number;
  lossesAfter: number;
  bloomsBefore: number;
  bloomsAfter: number;
}

export interface Gacha {
  /** The gacha stream's state. */
  stream: number;
  /** Pulls since the last SSR, by pity family. */
  pity: Record<string, number>;
  /** 50/50s lost since the Focus last came, by pity family. */
  losses: Record<string, number>;
  /** Every pull, oldest first. */
  history: PullRecord[];
}

export type PullResult = { ok: true; profile: Profile; records: PullRecord[] } | { ok: false; reason: string };

/** Pulls since the last SSR on this banner's family. */
export const pityOf = (profile: Profile, banner: BannerDef) => profile.gacha?.pity[banner.pity] ?? 0;
/** 50/50s lost in a row on this banner's family. */
export const lossesOf = (profile: Profile, banner: BannerDef) => profile.gacha?.losses[banner.pity] ?? 0;

/** The profile with a new Focus, which must be in the banner's pool. Pity and losses are untouched. */
export function chooseFocus(profile: Profile, banner: BannerDef, character: string): Profile {
  if (!banner.pool.includes(character)) throw new Error(`${character} is not in the ${banner.name} pool`);
  return { ...profile, focus: character };
}

/** Pulls `count` times (1 or a ten-pull), one Purified Bloom each. `seed` starts the stream on a profile's first pull. */
export function pull(profile: Profile, banner: BannerDef, count: 1 | typeof TEN_PULL, seed: number): PullResult {
  const focus = profile.focus;
  if (!focus || !banner.pool.includes(focus)) return { ok: false, reason: 'Choose a Focus first.' };
  if (profile.pulls < count) return { ok: false, reason: `This needs ${plural(count, BLOOM)}.` };
  const others = banner.pool.filter((id) => id !== focus);
  const rng = { gacha: profile.gacha?.stream ?? createStreams(seed, ['gacha']).gacha };
  const items = { ...profile.items };
  const dupes = { ...profile.dupes };
  const owned = [...profile.owned];
  const history = [...(profile.gacha?.history ?? [])];
  let pity = pityOf(profile, banner);
  let losses = lossesOf(profile, banner);
  let blooms = profile.pulls;
  const records: PullRecord[] = [];

  for (let i = 0; i < count; i++) {
    const before = { pityBefore: pity, lossesBefore: losses, bloomsBefore: blooms };
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
    let fiftyFifty: PullRecord['fiftyFifty'];
    if (rarity === 'ssr') {
      if (losses >= LOSSES_TO_GUARANTEE) fiftyFifty = 'guaranteed';
      // A pool of the Focus alone has no one to lose to.
      else fiftyFifty = others.length === 0 || nextFloat(rng, 'gacha') < FOCUS_CHANCE ? 'won' : 'lost';
      if (fiftyFifty === 'lost') {
        character = others[nextInt(rng, 'gacha', others.length)]!;
        losses += 1;
        got.pollen! += POLLEN_PER_LOSS;
      } else {
        character = focus;
        losses = 0;
      }
      dupe = gainCopy(character, owned, dupes, got);
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
      focus,
      ...(fiftyFifty && { fiftyFifty }),
      ...(guarantee && { guarantee }),
      ...before,
      pityAfter: pity,
      lossesAfter: losses,
      bloomsAfter: blooms,
    };
    records.push(record);
    history.push(record);
  }

  const gacha: Gacha = {
    stream: rng.gacha,
    pity: { ...profile.gacha?.pity, [banner.pity]: pity },
    losses: { ...profile.gacha?.losses, [banner.pity]: losses },
    history,
  };
  // Each SSR pulled gives profile EXP (owner, 31 Oct).
  const after = gainExp({ ...profile, pulls: blooms, owned, items, dupes, gacha }, 'ssr', records.filter((r) => r.rarity === 'ssr').length);
  return { ok: true, profile: after, records };
}

/**
 * A copy of an SSR character joins the profile: new, a dupe level up to C5, or past C5 Pollen into
 * `items`. Changes the tables it is given and says which.
 */
export function gainCopy(character: string, owned: string[], dupes: Record<string, number>, items: Record<string, number>): 'new' | 'overflow' | number {
  if (!owned.includes(character)) {
    owned.push(character);
    return 'new';
  }
  if ((dupes[character] ?? 0) < MAX_DUPES) return (dupes[character] = (dupes[character] ?? 0) + 1);
  items.pollen = (items.pollen ?? 0) + POLLEN_PER_OVERFLOW;
  return 'overflow';
}

export type SelectResult = { ok: true; profile: Profile; dupe: 'new' | 'overflow' | number; pollen: number } | { ok: false; reason: string };

/**
 * Spends an SSR selector (profile levels 25 and 50) on a character from the banner's pool, gained as
 * a pulled copy would be: new, a dupe level, or Pollen past C5. Pity, 50/50 losses and pull history
 * are untouched (owner, 31 Oct), and it is no pull, so it gives no profile EXP.
 */
export function useSelector(profile: Profile, banner: BannerDef, character: string): SelectResult {
  const held = profile.items?.[SSR_SELECTOR] ?? 0;
  if (held === 0) return { ok: false, reason: 'No SSR selector to use.' };
  if (!banner.pool.includes(character)) return { ok: false, reason: 'Choose a character from the banner.' };
  const { [SSR_SELECTOR]: _spent, ...rest } = profile.items ?? {};
  const items: Record<string, number> = held > 1 ? { ...rest, [SSR_SELECTOR]: held - 1 } : rest;
  const owned = [...profile.owned];
  const dupes = { ...profile.dupes };
  const dupe = gainCopy(character, owned, dupes, items);
  return { ok: true, profile: { ...profile, owned, dupes, items }, dupe, pollen: dupe === 'overflow' ? POLLEN_PER_OVERFLOW : 0 };
}
