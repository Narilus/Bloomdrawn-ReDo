import { expect, test } from '@playwright/test';

// Sound (M6.10): volume and mute in Options are kept with the profile; a button opens the browser's
// audio, and a fight with sound muted never does.

test('volume and mute are kept across a reload, and a Trial fight plays with sound muted', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Counts the audio contexts the game opens.
  await page.addInitScript(() => {
    const w = window as unknown as { AudioContext?: typeof AudioContext; audioContexts: number };
    w.audioContexts = 0;
    const Real = w.AudioContext;
    if (Real)
      w.AudioContext = class extends Real {
        constructor(options?: AudioContextOptions) {
          super(options);
          w.audioContexts++;
        }
      };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Options' }).click();
  const volume = page.getByRole('slider', { name: /Volume/ });
  const mute = page.getByRole('checkbox', { name: 'Mute' });
  await expect(volume).toHaveValue('70');
  await expect(mute).not.toBeChecked();
  // Unmuted, the menu's clicks have opened the audio.
  expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBeGreaterThan(0);
  await volume.fill('40');
  await mute.check();
  await expect(volume).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/options-sound.png' });
  // Kept a moment after the last change.
  await page.waitForTimeout(800);

  await page.reload();
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(volume).toHaveValue('40');
  await expect(mute).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Trials' }).click();
  await page.getByRole('region', { name: 'Flesh Trial' }).getByRole('button', { name: 'Choose party' }).click();
  await page.getByRole('button', { name: 'Start Tier 1' }).click();
  await expect(page.locator('.hand-card')).toHaveCount(5);
  const mana = page.locator('.mana strong');
  for (let plays = 0; plays < 6; ) {
    await expect(page.getByRole('button', { name: /End Turn/ })).toBeEnabled({ timeout: 15_000 });
    const before = Number(await mana.textContent());
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    if (Number(await mana.textContent()) < before) plays++;
    else await page.keyboard.press('e');
  }
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { audioContexts: number }).audioContexts)).toBe(0);
  expect(errors).toEqual([]);
});
