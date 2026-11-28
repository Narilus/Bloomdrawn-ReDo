import { z } from 'zod';
import { DEPTH_MAX } from '../game/depth.ts';
import { ASCENSIONS, levelCap, MAX_LEVEL } from '../game/levels.ts';
import { PROFILE_MAX, profileLevelOf } from '../game/profileLevel.ts';
import { TRIAL_TIERS } from '../game/trials.ts';
import { MAX_STEP } from '../game/weapons.ts';
import { emptyTeam, PARTY_SIZE, SOUND_GROUPS, TEAM_NAME_LENGTH, TEAM_PRESETS, type Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const id = z.string().min(1);
const count = z.int().nonnegative();
const items = z.record(id, count);

const pullRecord = z.strictObject({
  n: z.int().positive(),
  banner: id,
  rarity: z.enum(['ssr', 'sr', 'r']),
  character: id.optional(),
  weapon: id.optional(),
  // `kept` is a v11 copy kept as a duplicate; v12 calls it a spare.
  copy: z.union([z.enum(['new', 'spare', 'kept', 'salvaged']), z.int().min(1).max(MAX_STEP)]).optional(),
  items,
  dupe: z.union([z.literal('new'), z.literal('overflow'), z.int().positive()]).optional(),
  focus: id.optional(),
  fiftyFifty: z.enum(['won', 'lost', 'guaranteed']).optional(),
  guarantee: z.enum(['pity', 'tenPull']).optional(),
  pityBefore: count,
  pityAfter: count,
  lossesBefore: count,
  lossesAfter: count,
  bloomsBefore: count,
  bloomsAfter: count,
});

const profileSchema = z.strictObject({
  pulls: z.int().nonnegative(),
  runs: z.int().nonnegative(),
  owned: z.array(id),
  dupes: z.record(id, z.int().positive()).optional(),
  levels: z.record(id, z.int().min(2).max(MAX_LEVEL)).optional(),
  ascensions: z.record(id, z.int().min(1).max(ASCENSIONS.length)).optional(),
  items: items.optional(),
  focus: id.optional(),
  weaponFocus: id.optional(),
  weapons: z.record(id, z.strictObject({ step: z.int().min(1).max(MAX_STEP).optional(), spares: z.int().positive().optional() })).optional(),
  weaponSettings: z.strictObject({ autoReinforce: z.literal(true).optional(), autoSalvage: z.literal(true).optional() }).optional(),
  gacha: z.strictObject({ stream: z.int().nonnegative(), pity: z.record(id, count), losses: z.record(id, count), history: z.array(pullRecord) }).optional(),
  teams: z
    .array(z.strictObject({ name: z.string().min(1).max(TEAM_NAME_LENGTH), members: z.array(id.nullable()).length(PARTY_SIZE), weapons: z.array(id.nullable()).length(PARTY_SIZE).optional() }))
    .min(1)
    .optional(),
  team: z.int().nonnegative().optional(),
  depth: z.int().min(1).max(DEPTH_MAX).optional(),
  deepest: z.int().min(1).max(DEPTH_MAX).optional(),
  trials: z.record(id, z.int().min(1).max(TRIAL_TIERS.length)).optional(),
  exp: count.optional(),
  claimed: z.int().min(2).max(PROFILE_MAX).optional(),
  stats: z.strictObject({ won: count, lost: count, fights: count, elites: count, bosses: count, trials: count }).partial().optional(),
  sound: z
    .strictObject({
      volume: z.int().min(0).max(100).optional(),
      muted: z.literal(true).optional(),
      off: z
        .array(z.enum(SOUND_GROUPS))
        .min(1)
        .refine((off) => new Set(off).size === off.length, 'a kind of sound is listed twice')
        .optional(),
    })
    .optional(),
  visual: z.strictObject({ plainFrames: z.literal(true).optional() }).optional(),
  run: z.strictObject({ id, elites: z.int().nonnegative(), fights: z.int().positive().optional(), depth: z.int().min(2).max(DEPTH_MAX).optional() }).optional(),
});

/**
 * The profile save (docs/notes/m4-run.md, m5-collection.md): banked pulls, a run count, the characters
 * gained and their dupes, levels and ascensions, items, the Focus and the gacha, the team presets and
 * the run in progress's tally, profile EXP, claims and stats, the Trial tiers won, weapons, and sound and visual settings.
 */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 15,
  migrations: {
    // v2 added the run in progress, which a v1 profile never has.
    1: (data) => data,
    // v3 added the characters gained (none before M5; the starters are always owned) and the last party.
    2: (data) => ({ ...(data as object), owned: [] }),
    // v4 replaced the last party with team presets: the last party becomes Team 1.
    3: (data) => {
      const { party, ...rest } = data as { party?: string[] };
      if (!party) return rest;
      const teams = Array.from({ length: TEAM_PRESETS }, (_, i) => emptyTeam(i));
      teams[0]!.members = party;
      return { ...rest, teams, team: 0 };
    },
    // v5 added dupes, items and the gacha, which a v4 profile has none of.
    4: (data) => data,
    // v6 replaced the Standard banner with the character banner and its Focus (owner, 28 Oct): pity
    // counted on the Standard banner carries over, and no 50/50 has been lost. The Standard pulls had
    // no Focus and no 50/50, so their records gain only a loss count of 0.
    5: (data) => {
      const profile = data as { gacha?: { pity: Record<string, number>; history: object[] } };
      if (!profile.gacha) return data;
      const { standard, ...pity } = profile.gacha.pity;
      return {
        ...profile,
        gacha: {
          ...profile.gacha,
          pity: { ...pity, ...(standard !== undefined && { character: standard }) },
          losses: {},
          history: profile.gacha.history.map((r) => ({ ...r, lossesBefore: 0, lossesAfter: 0 })),
        },
      };
    },
    // v7 added levels and ascensions (M5.5); every character in a v6 profile is level 1.
    6: (data) => data,
    // v8 added depths (M6.4): every v7 run was at Depth 1, and none has been won deeper.
    7: (data) => data,
    // v9 added profile EXP, claims and stats (M6.6): a v8 profile is level 1 with nothing counted.
    8: (data) => data,
    // v10 added Trials (M6.7): a v9 profile has won none.
    9: (data) => data,
    // v11 added weapons (M6.8): a v10 profile owns none, and its SR pulls gave materials, as recorded.
    10: (data) => data,
    // v12 owns each weapon once and equips weapons in presets (owner, 15 Nov). Copies of a weapon merge
    // at the highest step; the rest become spares, one for each copy reinforced into them, so nothing
    // pulled is lost. Each character's weapon goes under her in every saved preset, front first,
    // skipping one already there; locks go.
    11: (data) => {
      type Copy = { uid: string; weapon: string; step?: number };
      const { weapons: copies = [], equipped = {}, ...rest } = data as { weapons?: Copy[]; equipped?: Record<string, string>; teams?: { name: string; members: (string | null)[] }[] };
      const weapons: Record<string, { step?: number; spares?: number }> = {};
      for (const id of new Set(copies.map((c) => c.weapon))) {
        const mine = copies.filter((c) => c.weapon === id).sort((a, b) => (b.step ?? 0) - (a.step ?? 0));
        const step = mine[0]!.step ?? 0;
        const spares = mine.slice(1).reduce((n, c) => n + 1 + (c.step ?? 0), 0);
        weapons[id] = { ...(step > 0 && { step }), ...(spares > 0 && { spares }) };
      }
      const weaponOf = (character: string | null) => copies.find((c) => c.uid === equipped[character ?? ''])?.weapon ?? null;
      const teams = rest.teams?.map((t) => {
        const used = new Set<string>();
        const held = t.members.map((m) => {
          const w = weaponOf(m);
          if (!w || used.has(w)) return null;
          used.add(w);
          return w;
        });
        return held.some((w) => w !== null) ? { ...t, weapons: held } : t;
      });
      return { ...rest, ...(teams && { teams }), ...(Object.keys(weapons).length > 0 && { weapons }) };
    },
    // v13 added sound settings (M6.10): a v12 profile has the defaults.
    12: (data) => data,
    // v14 added kinds of sound turned off (owner, 27 Nov): a v13 profile has them all on.
    13: (data) => data,
    // v15 added visual settings (owner, 28 Nov): a v14 profile has full card frames.
    14: (data) => data,
  },
  parse: (data) => {
    const profile = profileSchema.parse(data) as Profile;
    if (profile.team !== undefined && profile.team >= (profile.teams?.length ?? TEAM_PRESETS)) throw new Error('the chosen team is not one of the presets');
    for (const [character, ascensions] of Object.entries(profile.ascensions ?? {})) {
      if ((profile.levels?.[character] ?? 1) < levelCap(ascensions - 1)) throw new Error(`${character} ascended below level ${levelCap(ascensions - 1)}`);
    }
    for (const team of profile.teams ?? []) {
      const held = (team.weapons ?? []).filter((w): w is string => w !== null);
      if (new Set(held).size !== held.length) throw new Error(`${team.name} holds one weapon twice`);
      if (held.some((w) => !profile.weapons?.[w])) throw new Error(`${team.name} holds a weapon that is not owned`);
      if ((team.weapons ?? []).some((w, i) => w !== null && team.members[i] === null)) throw new Error(`${team.name} has a weapon in an empty place`);
    }
    if ((profile.claimed ?? 1) > profileLevelOf(profile.exp)) throw new Error(`profile level ${profile.claimed} claimed before it was reached`);
    for (const [character, level] of Object.entries(profile.levels ?? {})) {
      if (level > levelCap(profile.ascensions?.[character] ?? 0)) throw new Error(`${character} is past level ${levelCap(profile.ascensions?.[character] ?? 0)} without ascending`);
    }
    return profile;
  },
};
