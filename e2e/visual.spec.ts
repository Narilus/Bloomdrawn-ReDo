import { expect, test } from '@playwright/test';

// Options > Visual (owner, 28 Nov): "Disable card frames" is kept with the profile, and cards then
// keep their coloured border without the ornament pieces or the Transcend crest.

test('plain card frames are kept across a reload and drop the ornament from cards', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Roster' }).click();
  await page.getByRole('button', { name: 'Maelia' }).click();
  await page.getByRole('tab', { name: 'Kit' }).click();
  const womb = page.locator('.card.transcend', { hasText: 'Ripened Womb' });
  await expect(womb.locator('.frame-transcend')).toBeVisible();
  await expect(womb.locator('.frame-corner').first()).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('tab', { name: 'Visual' }).click();
  const plain = page.getByRole('checkbox', { name: /Disable card frames/ });
  await expect(plain).not.toBeChecked();
  await plain.check();
  await page.screenshot({ path: 'test-results/screenshots/options-visual.png' });

  await page.reload();
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('tab', { name: 'Visual' }).click();
  await expect(plain).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Roster' }).click();
  await page.getByRole('button', { name: 'Maelia' }).click();
  await page.getByRole('tab', { name: 'Kit' }).click();
  await expect(womb.locator('.frame-rim')).toBeVisible();
  await expect(womb.locator('.frame-transcend')).toBeHidden();
  await expect(womb.locator('.frame-corner').first()).toBeHidden();
  await expect(womb.locator('.frame-side').first()).toBeHidden();
  await page.screenshot({ path: 'test-results/screenshots/roster-plain-frames.png' });
  expect(errors).toEqual([]);
});
