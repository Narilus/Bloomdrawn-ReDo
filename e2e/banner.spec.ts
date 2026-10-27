import { expect, test } from '@playwright/test';

// The banner (M5.3): Pull 1 and Pull 10 spend Purified Blooms, and the results and the history,
// with pity and Blooms before and after, are on screen and kept.

// A profile with 11 Blooms: one single pull and one ten-pull.
const profile = JSON.stringify({
  format: 'bloomdrawn-backup',
  saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 5, contentVersion: 1, data: { pulls: 11, runs: 0, owned: [] } } },
});

test('pulls once and ten times, and sees the history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.locator('.title-files input[type="file"]').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(profile) });
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 11');

  await page.getByRole('button', { name: 'Banner' }).click();
  await expect(page.locator('.banner-pity')).toContainText('SSR guaranteed within 30 pulls');
  await expect(page.locator('.banner-pool-tile')).toHaveCount(4);
  await expect(page.locator('.banner-odds')).toContainText('3%');
  await expect(page.locator('.banner-empty')).toHaveText('No pulls yet.');

  await page.getByRole('button', { name: /Pull 1\b/ }).click();
  await expect(page.locator('.banner-history tbody tr')).toHaveCount(1);
  await expect(page.locator('.banner-result')).toHaveCount(1);
  await expect(page.locator('.banner-blooms strong')).toHaveText('10');
  await expect(page.locator('.banner-history tbody tr').first()).toContainText('11 → 10');

  await page.getByRole('button', { name: /Pull 10\b/ }).click();
  await expect(page.locator('.banner-history tbody tr')).toHaveCount(11);
  await expect(page.locator('.banner-result')).toHaveCount(10);
  await expect(page.locator('.banner-blooms strong')).toHaveText('0');
  // The newest pull is first.
  await expect(page.locator('.banner-history tbody tr').first()).toContainText('1 → 0');
  await expect(page.getByRole('button', { name: /Pull 1\b/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Pull 10\b/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/banner.png' });

  // The pulls are kept.
  await page.reload();
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 0');
  await page.getByRole('button', { name: 'Banner' }).click();
  await expect(page.locator('.banner-history tbody tr')).toHaveCount(11);
  expect(errors).toEqual([]);
});
