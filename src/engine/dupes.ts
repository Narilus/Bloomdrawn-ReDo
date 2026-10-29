import type { CharacterDef, Registry } from './defs.ts';
import type { Member } from './state.ts';

// Dupe levels (DESIGN.md, "Character dupes"): C1 to C5 each replace parts of a character from that
// level up. Combat reads a member's character only through `characterOf`, so her level applies
// everywhere: stats, passive, ultimate and the cards dealt.

/** The character as she is at a dupe level: each level up to it applied in order. */
export function withDupes(def: CharacterDef, level = 0): CharacterDef {
  let out = def;
  for (const dupe of (def.dupes ?? []).slice(0, Math.max(0, level))) {
    out = {
      ...out,
      ...(dupe.stats && { stats: dupe.stats }),
      ...(dupe.passive && { passive: dupe.passive }),
      ...(dupe.ultimate && { ultimate: dupe.ultimate }),
      ...(dupe.cards && { cards: out.cards.map((id) => dupe.cards?.[id] ?? id) }),
    };
  }
  return out;
}

/** A party member's character at her dupe level. */
export function characterOf(member: Member, registry: Registry): CharacterDef | undefined {
  const def = registry.characters[member.character];
  return def && withDupes(def, member.dupes);
}
