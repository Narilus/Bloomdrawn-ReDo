import { expect, test } from '@playwright/test';

test('app boots into the combat spike', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /End Turn/ })).toBeVisible();
  await expect(page.locator('.hand-card')).toHaveCount(5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/screenshots/combat.png' });
  expect(errors).toEqual([]);
});
