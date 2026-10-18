// Logical screen layout shared by the battlefield and the React HUD. Everything is in the
// 1920×1080 logical frame; the frame is scaled to fit the window.

export const WIDTH = 1920;
export const HEIGHT = 1080;

export interface Point {
  x: number;
  y: number;
}

/** Where the logical frame lands on screen, in CSS pixels that fall on whole device pixels. */
export interface Fit {
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
  dpr: number;
}

/** Party feet positions, slot 0 (front, bottom-left) to slot 3 (back, top-right). */
export const PARTY_HOMES: readonly (Point & { scale: number })[] = [
  { x: 330, y: 770, scale: 1 },
  { x: 535, y: 700, scale: 0.92 },
  { x: 740, y: 632, scale: 0.85 },
  { x: 935, y: 568, scale: 0.78 },
];

/** Enemy feet positions by slot; bodies never overlap. */
export const ENEMY_HOMES: readonly Point[] = [
  { x: 1230, y: 680 },
  { x: 1480, y: 640 },
  { x: 1720, y: 690 },
];

/** A lone enemy stands centre-right, clear of the party's back slot. */
const LONE_HOME: Point = { x: 1440, y: 690 };

/** An enemy's feet position, given how many enemies the fight has. */
export const enemyHome = (slot: number, count: number): Point | undefined => (count === 1 && slot === 0 ? LONE_HOME : ENEMY_HOMES[slot]);

/** Party sprites are drawn at this height before their slot scale. */
export const PARTY_HEIGHT = 400;
export const ENEMY_HEIGHT = 320;

/** A card dragged above this line is armed. */
export const PLAY_LINE = 630;

/** The clickable / aimable body area of an enemy. */
export function enemyBox(slot: number, count: number): { x: number; y: number; w: number; h: number } {
  const home = enemyHome(slot, count) ?? { x: 0, y: 0 };
  return { x: home.x - 140, y: home.y - ENEMY_HEIGHT - 20, w: 280, h: ENEMY_HEIGHT + 40 };
}
