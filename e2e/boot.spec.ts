import { expect, test } from '@playwright/test';

test('app boots and renders', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bloomdrawn' })).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/boot.png' });
  expect(errors).toEqual([]);
});
