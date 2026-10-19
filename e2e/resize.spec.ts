import { expect, test } from '@playwright/test';

test('the stage canvas follows the frame through live window resizes', async ({ page }) => {
  // A test fight: the stage canvas lives in combat (the default screen is the Labyrinth map).
  await page.goto('/?enemies=enemy.bloom-rib-hound');
  await expect(page.locator('.hand-card')).toHaveCount(5);
  await page.waitForTimeout(1500);
  for (const [width, height] of [[1061, 963], [1723, 965], [1280, 600]] as const) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector('.stage canvas')!.getBoundingClientRect();
          const layer = document.querySelector('.stage-layer')!.getBoundingClientRect();
          return [canvas.width - layer.width, canvas.height - layer.height, canvas.left - layer.left, canvas.top - layer.top];
        }),
      )
      .toEqual([0, 0, 0, 0]);
  }
});
