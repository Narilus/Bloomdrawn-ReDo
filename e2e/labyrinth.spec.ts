import { expect, test } from '@playwright/test';

// The Labyrinth: walk to the start gate's fight, win it against training dummies, and come back to
// the map with that tile cleared. The Bloom clock starts one tick short of Fruiting, so the Boss
// marker shows and the win reaches Fruiting; the Victory panel gives Flowering's Obols and a card.
test('walks into a fight and back to the map', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training&clock=11');
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();
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
  const victory = page.getByRole('dialog', { name: 'Victory' });
  await expect(victory).toContainText('+27 Obols');
  // A normal fight offers three cards, each for the member it would go to; take the first.
  const offers = victory.locator('.card-offer');
  await expect(offers).toHaveCount(3);
  await page.screenshot({ path: 'test-results/screenshots/labyrinth-victory.png' });
  const taken = (await offers.first().locator('.card-name').textContent())!;
  await offers.first().click();
  await expect(page.locator('.map-deck')).toContainText(taken);
  await expect(page.locator('.map-obols')).toContainText('27');
  await expect(fight).toHaveAttribute('data-kind', 'path');
  await expect(page.locator('.bloom-clock')).toContainText('Fruiting');
  await page.screenshot({ path: 'test-results/screenshots/labyrinth-after-fight.png' });
  expect(errors).toEqual([]);
});
