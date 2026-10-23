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

/**
 * Enemy feet positions by slot, for a fight laid out with 1–4 slots. A lone enemy stands
 * centre-right, clear of the party's back slot; with three, slot 0 is the centre anchor and
 * the others flank it (an elite and its summons). Bodies, plates and intents never overlap.
 */
const ENEMY_LAYOUTS: Readonly<Record<number, readonly Point[]>> = {
  1: [{ x: 1440, y: 690 }],
  2: [{ x: 1290, y: 690 }, { x: 1640, y: 640 }],
  3: [{ x: 1480, y: 700 }, { x: 1150, y: 630 }, { x: 1790, y: 630 }],
  4: [{ x: 1220, y: 700 }, { x: 1420, y: 590 }, { x: 1610, y: 700 }, { x: 1790, y: 590 }],
};

/** An enemy's feet position, given its slot and how many slots the fight lays out. */
export const enemyHome = (slot: number, slots: number): Point | undefined => ENEMY_LAYOUTS[Math.min(4, Math.max(1, slots))]?.[slot];

/** On-screen height of an enemy body by its size; a Boss stands huge, as the anchor of its fight. */
export const enemyHeight = (size?: 'small' | 'normal' | 'large' | 'huge'): number =>
  size === 'small' ? 190 : size === 'large' ? 400 : size === 'huge' ? 480 : ENEMY_HEIGHT;

/** Party sprites are drawn at this height before their slot scale. */
export const PARTY_HEIGHT = 400;
export const ENEMY_HEIGHT = 320;

/** A card dragged above this line is armed. */
export const PLAY_LINE = 630;

/** The clickable / aimable body area of an enemy. */
export function enemyBox(home: Point, height: number): { x: number; y: number; w: number; h: number } {
  const w = Math.min(280, height * 0.9);
  return { x: home.x - w / 2, y: home.y - height - 20, w, h: height + 40 };
}
