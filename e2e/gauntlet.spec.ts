import { expect, test } from '@playwright/test';

// The gauntlet carries the party from fight to fight with a relic pick between. Training dummies
// stand in for the encounters so the first win is quick.
test('the gauntlet plays into fight 2 after a relic pick', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?fights=encounter.training,encounter.training,encounter.training');
  await expect(page.locator('.turn')).toContainText('Fight 1 of 3');
  const mana = page.locator('.mana strong');
  const offers = page.locator('.relic-offer');
  while (!(await offers.first().isVisible())) {
    await expect(page.getByRole('button', { name: /End Turn|Enemy turn/ })).toBeVisible();
    const before = await mana.textContent();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    if ((await mana.textContent()) === before && !(await offers.first().isVisible())) {
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
  }
  await expect(offers).toHaveCount(3);
  const name = await offers.first().locator('h3').textContent();
  await offers.first().click();
  await expect(page.locator('.turn')).toContainText('Fight 2 of 3');
  await expect(page.locator('.relics')).toContainText(name ?? '');
  await page.screenshot({ path: 'test-results/screenshots/gauntlet-fight-2.png' });
  expect(errors).toEqual([]);
});
