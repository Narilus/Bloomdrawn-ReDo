import { expect, test, type Page } from '@playwright/test';

// The banner (M5.3; owner, 28 and 29 Oct): the Focus is chosen with Switch, Pull 1 and Pull 10
// spend Purified Blooms and show their results, and History holds every pull, with pity, losses
// and Blooms before and after, under the 50/50 status. Rules hold the odds. A Focus at C5 is warned of.

const backup = (data: object) =>
  JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 6, contentVersion: 1, data } } });
// A profile with 11 Blooms: one single pull and one ten-pull.
const profile = backup({ pulls: 11, runs: 0, owned: [] });

const load = (page: Page, text: string) => page.locator('.title-files input[type="file"]').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name });
const close = (page: Page, name: string) => dialog(page, name).getByRole('button', { name: 'Close' }).click();

test('chooses a Focus, pulls once and ten times, and sees the results and the history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await load(page, profile);
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 11');

  await page.getByRole('button', { name: 'Banner' }).click();
  // No Focus yet: no pulling.
  await expect(page.locator('.banner-no-focus')).toContainText('Choose a Focus');
  await expect(page.getByRole('button', { name: /Pull 1\b/ })).toBeDisabled();
  await expect(page.locator('.banner-blooms strong')).toHaveText('11');
  await expect(page.locator('.banner-pity')).toContainText('SSR guaranteed within 30 pulls');

  await page.getByRole('button', { name: 'Switch' }).click();
  await expect(dialog(page, 'Choose a Focus').locator('.roster-tile')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/screenshots/banner-switch.png' });
  await page.getByRole('button', { name: 'Kibane' }).click();
  await expect(dialog(page, 'Choose a Focus')).toHaveCount(0);
  await expect(page.locator('.banner-focus-info h3')).toHaveText('Kibane');
  await page.screenshot({ path: 'test-results/screenshots/banner.png' });

  await page.getByRole('button', { name: 'Rules' }).click();
  await expect(dialog(page, 'Rules').locator('.banner-odds')).toContainText('3%');
  await page.screenshot({ path: 'test-results/screenshots/banner-rules.png' });
  await close(page, 'Rules');

  await page.getByRole('button', { name: 'History' }).click();
  await expect(dialog(page, 'History').locator('.banner-focus')).toContainText('50/50s lost in a row: 0 of 2');
  await expect(dialog(page, 'History').locator('.banner-empty')).toHaveText('No pulls yet.');
  await close(page, 'History');

  await page.getByRole('button', { name: /Pull 1\b/ }).click();
  await expect(dialog(page, 'Results').locator('.banner-result')).toHaveCount(1);
  await close(page, 'Results');
  await expect(page.locator('.banner-blooms strong')).toHaveText('10');

  await page.getByRole('button', { name: /Pull 10\b/ }).click();
  await expect(dialog(page, 'Results').locator('.banner-result')).toHaveCount(10);
  await page.screenshot({ path: 'test-results/screenshots/banner-results.png' });
  await close(page, 'Results');
  await expect(page.locator('.banner-blooms strong')).toHaveText('0');
  await expect(page.getByRole('button', { name: /Pull 1\b/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Pull 10\b/ })).toBeDisabled();

  await page.getByRole('button', { name: 'History' }).click();
  const rows = dialog(page, 'History').locator('.banner-history tbody tr');
  await expect(rows).toHaveCount(11);
  // The newest pull is first.
  await expect(rows.first()).toContainText('1 → 0');
  await expect(rows.last()).toContainText('11 → 10');
  await page.screenshot({ path: 'test-results/screenshots/banner-history.png' });

  // The pulls and the Focus are kept.
  await page.reload();
  await expect(page.locator('.title-pulls')).toContainText('Purified Blooms 0');
  await page.getByRole('button', { name: 'Banner' }).click();
  await expect(page.locator('.banner-focus-info h3')).toHaveText('Kibane');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(rows).toHaveCount(11);
  expect(errors).toEqual([]);
});

test('a Focus at C5 is warned of, and two losses show the guarantee, kept through a Switch', async ({ page }) => {
  await page.goto('/');
  const data = { pulls: 3, runs: 0, owned: ['kibane'], dupes: { kibane: 5 }, focus: 'kibane', gacha: { stream: 1, pity: { character: 4 }, losses: { character: 2 }, history: [] } };
  await load(page, backup(data));
  await page.getByRole('button', { name: 'Banner' }).click();
  await expect(page.locator('.banner-warning')).toHaveText('Kibane is at C5: any further copy becomes 40 Pollen.');
  await expect(page.locator('.banner-pity')).toContainText('SSR guaranteed within 26 pulls');
  await page.screenshot({ path: 'test-results/screenshots/banner-c5.png' });
  await page.getByRole('button', { name: 'History' }).click();
  await expect(dialog(page, 'History').locator('.banner-focus')).toHaveText('Your next SSR is guaranteed to be Kibane.');
  await close(page, 'History');
  // Another Focus drops the warning and keeps the guarantee.
  await page.getByRole('button', { name: 'Switch' }).click();
  await page.getByRole('button', { name: 'Hester' }).click();
  await expect(page.locator('.banner-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(dialog(page, 'History').locator('.banner-focus')).toHaveText('Your next SSR is guaranteed to be Hester.');
});
