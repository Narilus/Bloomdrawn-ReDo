import { describe, expect, it } from 'vitest';
import { CARD_COLUMN, CARD_W, fanPose, fanSpacing } from './fan.ts';

const left = (x: number, scale = 1) => x - (CARD_W / 2) * scale;
const right = (x: number, scale = 1) => x + (CARD_W / 2) * scale;

describe('the hand fan', () => {
  it('at rest, every covered card keeps its left column in view', () => {
    for (let count = 1; count <= 12; count++) expect(fanSpacing(count)).toBeGreaterThanOrEqual(CARD_COLUMN);
  });

  it('a raised card never covers the next card, nor the column of the card before it', () => {
    for (let count = 2; count <= 12; count++) {
      for (let hovered = 0; hovered < count; hovered++) {
        const raised = fanPose(hovered, count, hovered);
        const next = hovered + 1 < count ? fanPose(hovered + 1, count, hovered) : undefined;
        const before = hovered > 0 ? fanPose(hovered - 1, count, hovered) : undefined;
        if (next) expect(left(next.x)).toBeGreaterThanOrEqual(right(raised.x, raised.scale));
        if (before) expect(left(before.x) + CARD_COLUMN).toBeLessThanOrEqual(left(raised.x, raised.scale));
      }
    }
  });

  it('cards pushed aside keep their order and their columns in view', () => {
    for (let count = 2; count <= 12; count++) {
      for (let hovered = 0; hovered < count; hovered++) {
        for (let i = 1; i < count; i++) {
          if (i === hovered || i - 1 === hovered) continue;
          expect(fanPose(i, count, hovered).x - fanPose(i - 1, count, hovered).x).toBeGreaterThanOrEqual(CARD_COLUMN);
        }
      }
    }
  });
});
