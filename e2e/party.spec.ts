import { expect, test } from '@playwright/test';

// The roster and party select (M5.1): open a character's page, then choose a party in a new order
// and see the run field it, front first. Party select offers that party again next time.
test('the roster shows a kit, and a run starts with the party chosen, in its order', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training');

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile')).toHaveCount(4);
  await page.getByRole('button', { name: 'Maelia', exact: true }).click();
  await expect(page.locator('.character-info h2')).toHaveText('Maelia, Midwife of the Bloom');
  await expect(page.locator('.character-info')).toContainText('The first time each turn a card gains Embryo, gain 1 more.');
  await expect(page.locator('.character-cards .card')).toHaveCount(7);
  await page.screenshot({ path: 'test-results/screenshots/character-page.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'New run' }).click();
  const slots = page.locator('.party-slot strong');
  await expect(slots).toHaveText(['Agathe', 'Maelia', 'Anthe', 'Leonora']);
  // Take Agathe out and put her back last, then move Leonora to the front.
  await page.getByRole('button', { name: 'Agathe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start run' })).toBeDisabled();
  await expect(page.locator('.roster-hint')).toHaveText('A party is 4 characters.');
  await page.getByRole('button', { name: 'Agathe', exact: true }).click();
  await expect(slots).toHaveText(['Maelia', 'Anthe', 'Leonora', 'Agathe']);
  await page.getByRole('button', { name: 'Move Leonora forward' }).click();
  await expect(slots).toHaveText(['Maelia', 'Leonora', 'Anthe', 'Agathe']);
  await page.getByRole('button', { name: 'Move Leonora forward' }).click();
  await expect(slots).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);
  await page.screenshot({ path: 'test-results/screenshots/party-select.png' });
  await page.getByRole('button', { name: 'Start run' }).click();

  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.mana strong')).toBeVisible();
  await expect(page.locator('.portrait-name')).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);

  // Back at the title, a new run offers the same party.
  await page.reload();
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Abandon it' }).click();
  await expect(slots).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);
  expect(errors).toEqual([]);
});
