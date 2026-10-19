import { expect, test } from '@playwright/test';

// The Labyrinth: walk to the start gate's fight, win it against training dummies, and come back to
// the map with that tile cleared. The Bloom clock starts one tick short of Fruiting, so the win
// swells pods and the Boss marker shows.
test('walks into a fight and back to the map', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training&clock=11');
  await expect(page.locator('.bloom-clock')).toContainText('Flowering');
  await expect(page.locator('[data-boss-marker]')).toBeVisible();
  // The start gate is drawn "E o F X": its fight is two steps east of the entrance on every board.
  const fight = page.locator('[data-tile="2,0"]');
  await expect(fight).toHaveAttribute('data-kind', 'fight');
  await fight.hover();
  await expect(page.locator('.hex.on-route')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/screenshots/labyrinth-route.png' });
  await fight.click();

  const mana = page.locator('.mana strong');
  await expect(mana).toBeVisible();
  const map = page.locator('.labyrinth-map');
  while (!(await map.isVisible())) {
    const before = await mana.textContent();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    if ((await mana.textContent()) === before && !(await map.isVisible())) {
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
  }
  await expect(fight).toHaveAttribute('data-kind', 'path');
  await expect(page.locator('.bloom-clock')).toContainText('Fruiting');
  await expect(page.locator('.hex-pod')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/screenshots/labyrinth-after-fight.png' });
  expect(errors).toEqual([]);
});
