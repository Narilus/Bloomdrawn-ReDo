import type { CardDef } from '../engine/index.ts';

// Card art (M6.11a; DESIGN.md "Cards"; owner, 28 Nov). A card's picture shows its effect, never a
// playable character. Strike and Defense share one picture per Domain (`strike-flesh.webp`,
// `defense-flesh.webp`…); every other card has its own, named after its ID without the dot
// (`maelia-bud-cutting.webp`). A card without art yet shows the placeholder.

const FILES = import.meta.glob<string>('../assets/cards/*.webp', { eager: true, query: '?url', import: 'default' });
const URLS = new Map(Object.entries(FILES).map(([path, url]) => [/([^/]+)\.webp$/.exec(path)?.[1] ?? '', url]));

/** The file a card's picture comes from: its Domain's Strike or Defense, else its own (a dupe level's version shares its card's). */
export function cardArtName(def: CardDef, domain: string | undefined): string {
  if ((def.slot === 'strike' || def.slot === 'defense') && domain) return `${def.slot}-${domain}`;
  return (def.variantOf ?? def.id).replace(/\./g, '-');
}

/** The card's picture, if it has one yet. */
export const cardArt = (def: CardDef, domain: string | undefined): string | undefined => URLS.get(cardArtName(def, domain));
