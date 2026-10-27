import { expect, test } from '@playwright/test';

// The banner (M5.3; owner, 28 Oct): a Focus is chosen from the pool, Pull 1 and Pull 10 spend
// Purified Blooms, and the results and the history, with pity, losses and Blooms before and after,
// are on screen and kept. A Focus at C5 is warned of.

const backup = (data: object) =>
  JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 6, contentVersion: 1, data } } });
// A profile with 11 Blooms: one single pull and one ten-pull.
const profile = backup({ pulls: 11, runs: 0, owned: [] });

test('pulls once and ten times, and sees the history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.locator('.title-files input[type="file"]').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(profile) });
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 11');

  await page.getByRole('button', { name: 'Banner' }).click();
  // No Focus yet: no pulling.
  await expect(page.locator('.banner-focus')).toContainText('Choose a Focus');
  await expect(page.getByRole('button', { name: /Pull 1\b/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Kibane' }).click();
  await expect(page.getByRole('button', { name: 'Kibane' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.banner-focus')).toContainText('50/50s lost in a row: 0 of 2');
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
  await expect(page.getByRole('button', { name: 'Kibane' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('a Focus at C5 is warned of, and two losses show her guaranteed', async ({ page }) => {
  await page.goto('/');
  const data = { pulls: 3, runs: 0, owned: ['kibane'], dupes: { kibane: 5 }, focus: 'kibane', gacha: { stream: 1, pity: { character: 4 }, losses: { character: 2 }, history: [] } };
  await page.locator('.title-files input[type="file"]').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(backup(data)) });
  await page.getByRole('button', { name: 'Banner' }).click();
  await expect(page.locator('.banner-warning')).toHaveText('Kibane is at C5: another copy of her becomes 40 Pollen.');
  await expect(page.locator('.banner-focus')).toHaveText('Your next SSR is guaranteed to be Kibane.');
  await expect(page.locator('.banner-pity')).toContainText('SSR guaranteed within 26 pulls');
  await page.screenshot({ path: 'test-results/screenshots/banner-c5.png' });
  // Another Focus drops the warning and keeps the guarantee.
  await page.getByRole('button', { name: 'Hester' }).click();
  await expect(page.locator('.banner-warning')).toHaveCount(0);
  await expect(page.locator('.banner-focus')).toHaveText('Your next SSR is guaranteed to be Hester.');
});
