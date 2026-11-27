import type { Point } from '../stage/layout.ts';

/** The card's font size in the hand: a card is 15 × 21 of it (DESIGN.md "Cards"). */
export const CARD_EM = 15;
export const CARD_W = 15 * CARD_EM;
export const CARD_H = 21 * CARD_EM;
/** The width of a card's left column (cost, owner, Domain), which a covered card keeps in view. */
export const CARD_COLUMN = 4.2 * CARD_EM;
const CENTER_X = 960;
// The resting fan's centre card ends just below the screen's bottom edge, its rules in view.
const BASE_Y = 1080 + 15 - CARD_H / 2;
// A raised card is large enough to read, and sits whole on screen.
export const RAISED_SCALE = 1.3;
const RAISED_Y = 1080 - 8 - (CARD_H / 2) * RAISED_SCALE;
// Room left between the raised card and the cards it pushes aside.
const GAP = 6;

export interface Pose {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  z: number;
}

/** The distance between neighbours at rest, never less than the left column. */
export const fanSpacing = (count: number) => Math.min(115, 1000 / Math.max(count, 1));

/**
 * Where card `index` of `count` sits in the fan, as a pure function of hand order and the
 * hovered index. Recomputed on every change, so offsets can never accumulate.
 */
export function fanPose(index: number, count: number, hovered: number | null): Pose {
  const spacing = fanSpacing(count);
  const offset = index - (count - 1) / 2;
  const pose: Pose = {
    x: CENTER_X + offset * spacing,
    y: BASE_Y + offset * offset * 5,
    rotate: offset * 3.5,
    scale: 1,
    z: index,
  };
  if (hovered === null) return pose;
  if (index === hovered) return { x: pose.x, y: RAISED_Y, rotate: 0, scale: RAISED_SCALE, z: 100 };
  // The raised card covers nothing that can be pointed at: the cards to its right move clear
  // of it, so the next one is whole, and the cards to its left keep their column in view.
  const raised = (CARD_W / 2) * RAISED_SCALE;
  const right = Math.max(0, raised + CARD_W / 2 - spacing + GAP);
  const left = Math.max(0, raised - CARD_W / 2 + CARD_COLUMN - spacing + GAP);
  pose.x += index > hovered ? right : -left;
  return pose;
}

/** Where a targeted card waits while the player aims. */
export const AIM_POSE: Pose = { x: CENTER_X, y: 760, rotate: 0, scale: 1.08, z: 200 };

/** Where the aim arrow starts: the top of the card in the aim pose. */
export const AIM_ORIGIN: Point = { x: CENTER_X, y: AIM_POSE.y - (CARD_H / 2) * AIM_POSE.scale + 12 };
