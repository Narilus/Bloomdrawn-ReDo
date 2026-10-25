import { expect, test } from '@playwright/test';

test('app boots into the title screen, and New run opens party select, then the Labyrinth', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 0');
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/screenshots/title.png' });
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();
  await expect(page.locator('.labyrinth-map [data-kind="entrance"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/labyrinth.png' });
  expect(errors).toEqual([]);
});

test('a test fight boots into combat', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?enemies=enemy.bloom-rib-hound');
  await expect(page.getByRole('button', { name: /End Turn/ })).toBeVisible();
  await expect(page.locator('.hand-card')).toHaveCount(5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/screenshots/combat.png' });
  expect(errors).toEqual([]);
});

test('the M1 fight plays one full turn', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // The Hound alone, as a test fight (the default is now the Labyrinth).
  await page.goto('/?enemies=enemy.bloom-rib-hound');
  await expect(page.locator('.intent')).toContainText('Bite');
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: /End Turn/ })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('.turn')).toContainText('Turn 2');
  await expect(page.locator('.intent')).toContainText('Bristle');
  await expect(page.locator('.party-bar strong')).toHaveText('198 / 210');
  await page.screenshot({ path: 'test-results/screenshots/turn-2.png' });
  expect(errors).toEqual([]);
});
