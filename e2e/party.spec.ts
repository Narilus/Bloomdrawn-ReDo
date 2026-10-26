import { expect, test, type Page } from '@playwright/test';

// The roster and party select (M5.1; owner, 26 Oct): every character's art stands the same height,
// a character's page shows her kit, and party select keeps team presets: a place swaps, quick select
// fills four in click order, a preset can be renamed, and the run fields the chosen team, front first.

const artHeight = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())?.height ?? 0;

test('the roster shows a kit, and a run starts with the team chosen, in its order', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training');

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile')).toHaveCount(4);
  // Anthe is wider than she is tall, but stands as tall as the rest.
  const tile = (name: string) => `.roster-tile[aria-label="${name}"] img`;
  await expect(page.locator(tile('Anthe'))).toBeVisible();
  expect(await artHeight(page, tile('Anthe'))).toBeCloseTo(await artHeight(page, tile('Maelia')), 0);
  await page.screenshot({ path: 'test-results/screenshots/roster.png' });
  await page.getByRole('button', { name: 'Anthe', exact: true }).click();
  await expect(page.locator('.character-info h2')).toHaveText("Anthe, the Sphinx's Vigil");
  const antheHeight = await artHeight(page, '.character-art img');
  await page.screenshot({ path: 'test-results/screenshots/character-page-wide.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Maelia', exact: true }).click();
  await expect(page.locator('.character-info h2')).toHaveText('Maelia, Midwife of the Bloom');
  await expect(page.locator('.character-info')).toContainText('The first time each turn a card gains Embryo, gain 1 more.');
  await expect(page.locator('.character-cards .card')).toHaveCount(7);
  expect(await artHeight(page, '.character-art img')).toBeCloseTo(antheHeight, 0);
  await page.screenshot({ path: 'test-results/screenshots/character-page.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'New run' }).click();
  const slots = page.locator('.team-slot');
  const names = page.locator('.team-slot strong');
  await expect(page.getByRole('button', { name: 'Team 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(names).toHaveText(['Agathe', 'Maelia', 'Anthe', 'Leonora']);
  // Picking Leonora for the front swaps her with Agathe.
  await page.getByRole('button', { name: 'Front: Agathe' }).click();
  await page.getByRole('dialog', { name: 'Choose for Front' }).getByRole('button', { name: 'Leonora', exact: true }).click();
  await expect(names).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);

  // Team 2 starts empty; quick select fills it in click order, and it can be renamed.
  await page.getByRole('button', { name: 'Team 2' }).click();
  await expect(slots).toHaveText(['Front+', '2+', '3+', '4+']);
  await expect(page.getByRole('button', { name: 'Start run' })).toBeDisabled();
  await expect(page.locator('.roster-hint')).toHaveText('A party is 4 characters.');
  await page.getByRole('button', { name: 'Quick select' }).click();
  const quick = page.getByRole('dialog', { name: 'Quick select' });
  for (const name of ['Anthe', 'Agathe', 'Leonora', 'Agathe', 'Maelia', 'Agathe']) await quick.getByRole('button', { name, exact: true }).click();
  await page.screenshot({ path: 'test-results/screenshots/party-quick.png' });
  await quick.getByRole('button', { name: 'Done' }).click();
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.getByRole('textbox', { name: 'Team name' }).fill('Sphinx first');
  await page.getByRole('textbox', { name: 'Team name' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Sphinx first' })).toBeVisible();
  // A place can be emptied and filled again.
  await page.getByRole('button', { name: '3: Maelia' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: '3: empty' })).toBeVisible();
  await page.getByRole('button', { name: '3: empty' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '3: empty' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Maelia', exact: true }).click();
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.screenshot({ path: 'test-results/screenshots/party-select.png' });
  await page.getByRole('button', { name: 'Start run' }).click();

  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.mana strong')).toBeVisible();
  await expect(page.locator('.portrait-name')).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);

  // Back at the title, party select opens on the same team, and Team 1 kept its swap.
  await page.reload();
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('button', { name: 'Abandon it' }).click();
  await expect(page.getByRole('button', { name: 'Sphinx first' })).toHaveAttribute('aria-pressed', 'true');
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.getByRole('button', { name: 'Team 1' }).click();
  await expect(names).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);
  expect(errors).toEqual([]);
});
