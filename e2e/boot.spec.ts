import { expect, test } from '@playwright/test';
import { blooms } from './menu.ts';

test('app boots into the main menu, and Expedition opens party select, then the Labyrinth', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  // A new profile starts with 10 (owner, 25 Oct).
  await expect(blooms(page)).toHaveText('10');
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/screenshots/title.png' });
  await page.getByRole('button', { name: 'Expedition' }).click();
  await page.getByRole('button', { name: 'Start expedition' }).click();
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

test('enemies show their level, and a level 40 Hound has its HP at that level (M6.3)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?enemies=enemy.bloom-rib-hound,enemy.pod-thrower&enemyLevel=40');
  await expect(page.locator('.enemy-level')).toHaveText(['Lv 40', 'Lv 40']);
  // 225 HP at level 40: × 1.125.
  await expect(page.locator('.enemy-plate').first().locator('.bar-label strong')).toHaveText('253 / 253');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshots/combat-level-40.png' });
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
