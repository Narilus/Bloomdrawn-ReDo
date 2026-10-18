import type { Point } from '../stage/layout.ts';

export const CARD_W = 210;
export const CARD_H = 290;
const CENTER_X = 960;
const BASE_Y = 938;

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
  const spacing = Math.min(150, 1000 / Math.max(count, 1));
  const offset = index - (count - 1) / 2;
  const pose: Pose = {
    x: CENTER_X + offset * spacing,
    y: BASE_Y + offset * offset * 5,
    rotate: offset * 3.5,
    scale: 1,
    z: index,
  };
  if (hovered === null) return pose;
  if (index === hovered) return { x: pose.x, y: BASE_Y - 105, rotate: 0, scale: 1.16, z: 100 };
  pose.x += Math.sign(index - hovered) * (Math.abs(index - hovered) === 1 ? 55 : 30);
  return pose;
}

/** Where a targeted card waits while the player aims. */
export const AIM_POSE: Pose = { x: CENTER_X, y: 760, rotate: 0, scale: 1.08, z: 200 };

/** Where the aim arrow starts: the top of the card in the aim pose. */
export const AIM_ORIGIN: Point = { x: CENTER_X, y: AIM_POSE.y - (CARD_H / 2) * AIM_POSE.scale + 12 };
