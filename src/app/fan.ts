import type { Point } from '../stage/layout.ts';

/** The card's font size in the hand: a card is 15 × 21 of it (DESIGN.md "Cards"). */
export const CARD_EM = 18;
export const CARD_W = 15 * CARD_EM;
export const CARD_H = 21 * CARD_EM;
const CENTER_X = 960;
// The resting fan's centre card ends just below the screen's bottom edge, its rules in view.
const BASE_Y = 1080 + 15 - CARD_H / 2;
// A raised card sits whole on screen.
const RAISED_SCALE = 1.16;
const RAISED_Y = 1080 - 8 - (CARD_H / 2) * RAISED_SCALE;

export interface Pose {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  z: number;
}

/**
 * Where card `index` of `count` sits in the fan, as a pure function of hand order and the
 * hovered index. Recomputed on every change, so offsets can never accumulate.
 */
export function fanPose(index: number, count: number, hovered: number | null): Pose {
  // Covered cards keep their left column (cost, owner, Domain) in view.
  const spacing = Math.min(125, 1000 / Math.max(count, 1));
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
  pose.x += Math.sign(index - hovered) * (Math.abs(index - hovered) === 1 ? 55 : 30);
  return pose;
}

/** Where a targeted card waits while the player aims. */
export const AIM_POSE: Pose = { x: CENTER_X, y: 760, rotate: 0, scale: 1.08, z: 200 };

/** Where the aim arrow starts: the top of the card in the aim pose. */
export const AIM_ORIGIN: Point = { x: CENTER_X, y: AIM_POSE.y - (CARD_H / 2) * AIM_POSE.scale + 12 };
