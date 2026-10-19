import { expect, test } from '@playwright/test';

interface ActorSnapshot {
  id: string;
  x: number;
  homeX: number;
}

// A finished fight's battlefield is torn down while its animations are still running; that once
// threw inside Motion's frame loop and froze every animation, hand hovers included.
test('after winning and fighting again, nothing throws and animations still run', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?enemies=enemy.training-dummy');
  const mana = page.locator('.mana strong');
  const result = page.locator('.result');
  while (!(await result.isVisible())) {
    await expect(page.getByRole('button', { name: /End Turn|Enemy turn/ })).toBeVisible();
    const before = await mana.textContent();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    if ((await mana.textContent()) === before && !(await result.isVisible())) {
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
  }
  await page.getByRole('button', { name: 'Fight again' }).click();
  await expect(page.locator('.hand-card')).toHaveCount(5);
  await page.waitForTimeout(1500);

  // A play makes its owner lunge away from home.
  const actors = () => page.evaluate(() => (window as unknown as { __bloomdrawn: { actors: () => ActorSnapshot[] } }).__bloomdrawn.actors());
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press(String(i + 1));
    await page.keyboard.press('Enter');
    if ((await mana.textContent()) !== '6') break;
  }
  await page.waitForTimeout(120);
  expect((await actors()).some((a) => Math.abs(a.x - a.homeX) > 5)).toBe(true);
  expect(errors).toEqual([]);
});
