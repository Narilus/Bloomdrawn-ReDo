import { expect, test } from '@playwright/test';
import { importSave, saveFile } from './menu.ts';

// The Profile Shop (M6.9; owner, 31 Oct): character dupes for 100 Pollen, the starters' included,
// each purchase confirmed first.

test('the shop sells a dupe for 100 Pollen after a confirm, and refuses past what the Pollen buys (M6.9)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const data = { pulls: 0, runs: 1, owned: ['virelle'], items: { pollen: 150 } };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 12, contentVersion: 1, data } } });
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Shop' }).click();
  // The four starters and Virelle.
  await expect(page.locator('.shop-tile')).toHaveCount(5);
  const purse = page.locator('.currency-pollen strong');
  await expect(page.locator('.currency-pollen')).toHaveAttribute('data-tip', 'Pollen');
  await expect(purse).toHaveText('150');

  await page.getByRole('button', { name: 'Virelle, P0' }).click();
  const detail = page.getByRole('complementary', { name: 'Character dupe' });
  await expect(detail.locator('h3')).toHaveText('Virelle');
  await expect(detail).toContainText('P1 for 100 Pollen');
  await page.screenshot({ path: 'test-results/screenshots/shop.png' });
  await detail.getByRole('button', { name: 'Buy' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Confirm purchase' });
  await expect(confirm).toContainText("Buy Virelle's P1 for 100 Pollen?");
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(purse).toHaveText('150');
  await detail.getByRole('button', { name: 'Buy' }).first().click();
  await confirm.getByRole('button', { name: 'Buy' }).click();
  await expect(detail.getByRole('status')).toHaveText('Virelle is now P1.');
  await expect(purse).toHaveText('50');
  await expect(page.getByRole('button', { name: 'Virelle, P1' })).toBeVisible();
  // 50 Pollen left buys nothing.
  await expect(detail.getByRole('button', { name: 'Buy' })).toBeDisabled();

  // Kept: the roster shows her at P1.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.getByRole('button', { name: 'Virelle' })).toContainText('P1');
  expect(errors).toEqual([]);
});
