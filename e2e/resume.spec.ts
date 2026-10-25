import { expect, test, type Page } from '@playwright/test';

// Save and resume (M4.4): closing the page mid-walk or mid-fight and choosing Continue picks the
// run up exactly where it was. Training dummies keep the fight simple.

/** What the fight shows: turn, Mana, piles, party and enemy plates, and the hand in order. */
const fightView = (page: Page) =>
  page.evaluate(() => {
    const text = (selector: string) => [...document.querySelectorAll(selector)].map((e) => (e as HTMLElement).innerText);
    return { turn: text('.turn'), mana: text('.mana strong'), piles: text('.piles'), party: text('.party-bar'), enemies: text('.enemy-plate'), hand: text('.hand-card .card-name') };
  });

async function reopen(page: Page) {
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('closing the page mid-walk and mid-fight resumes on the same state', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training');
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();

  // Mid-walk: the start gate's fight is two steps away; close before the party gets there.
  await page.locator('[data-tile="2,0"]').click();
  await page.waitForTimeout(150);
  await expect(page.locator('.mana strong')).toHaveCount(0);
  await reopen(page);
  const mana = page.locator('.mana strong');
  await expect(mana).toBeVisible();
  await expect(page.locator('.turn')).toContainText('Turn 1');

  // Mid-fight: play a card and end a turn, let it settle, then close and come back.
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('e');
  await expect(page.locator('.turn')).toContainText('Turn 2');
  await expect(page.getByRole('button', { name: /End Turn/ })).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const before = await fightView(page);
  expect(before.hand.length).toBeGreaterThan(0);
  await reopen(page);
  await expect(mana).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await fightView(page)).toEqual(before);
  await page.screenshot({ path: 'test-results/screenshots/resumed-fight.png' });
  expect(errors).toEqual([]);
});

test('Abandon in the map menu banks the run and the title screen then has nothing to continue', async ({ page }) => {
  await page.goto('/?encounters=encounter.training');
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Abandon run' }).click();
  await expect(page.getByRole('dialog', { name: 'Abandon run' })).toContainText('No elites beaten: nothing banked');
  await page.screenshot({ path: 'test-results/screenshots/abandon.png' });
  await page.getByRole('button', { name: 'Abandon', exact: true }).click();
  await expect(page.locator('.result h2')).toHaveText('Run abandoned');
  await page.getByRole('button', { name: 'Title screen' }).click();
  await expect(page.locator('.title-pulls')).toContainText('1 run');
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
});

test('an exported save imported into an empty browser continues the same run', async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.goto('/?encounters=encounter.training');
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Start run' }).click();
  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.mana strong')).toBeVisible();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const before = await fightView(page);
  await page.reload();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const file = await (await download).path();

  const empty = await browser.newPage();
  await empty.goto('/?encounters=encounter.training');
  await expect(empty.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await empty.locator('.title-files input[type="file"]').setInputFiles(file);
  await empty.getByRole('button', { name: 'Continue' }).click();
  await expect(empty.locator('.mana strong')).toBeVisible();
  await empty.waitForTimeout(1500);
  expect(await fightView(empty)).toEqual(before);

  // A file that isn't a save changes nothing.
  await empty.reload();
  await empty.locator('.title-files input[type="file"]').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(empty.getByRole('alert')).toContainText('This is not a Bloomdrawn save file. Nothing was changed.');
  await expect(empty.getByRole('button', { name: 'Continue' })).toBeVisible();
  await empty.close();
});
