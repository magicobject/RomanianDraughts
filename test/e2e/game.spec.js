const { test, expect } = require('./fixtures');

// These click the real page under the production CSP. The game once shipped with no <meta charset>: the browser mis-read the
// script, its CSP hash stopped matching, the script was blocked, and the board stayed empty and dead to every click.

test('the board is drawn: 64 squares and 16 pieces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sq')).toHaveCount(64);
  await expect(page.locator('.sq .piece')).toHaveCount(16);
});

test('a visitor can move a piece with the mouse (two players)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  const status = page.locator('#status');
  const before = await status.textContent();
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await expect(page.locator('#log .n')).toHaveCount(1);
  await expect(status).not.toHaveText(before);
});

test('the computer replies after the visitor moves', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Computer' }).click();
  await page.getByRole('button', { name: 'Easy' }).click();
  const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await expect(page.locator('#log li').first().locator('span').nth(2)).not.toBeEmpty({ timeout: 15_000 }); // the second column of row 1 is the computer's move
});

test('Undo and New game work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await expect(page.locator('#log .n')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#log .n')).toHaveCount(0);
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('#log .n')).toHaveCount(0);
});

test('the footer marks the site as a MediaWright site and links help and updates', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer.site');
  await expect(footer.getByRole('link', { name: 'MediaWright' })).toHaveAttribute('href', 'https://mediawright.uk');
  await expect(footer.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  await expect(footer.getByRole('link', { name: 'Site updates' })).toHaveAttribute('href', '/updates');
});

test('the favicon files are served', async ({ request }) => {
  for (const [url, type] of [['/favicon.svg', 'image/svg+xml'], ['/favicon-32.png', 'image/png'], ['/apple-touch-icon.png', 'image/png'], ['/favicon.ico', 'image']]) {
    const r = await request.get(url);
    expect(r.status(), url).toBe(200);
    expect(r.headers()['content-type'], url).toContain(type);
  }
});

test('/updates shows the current build and /help renders', async ({ page }) => {
  await page.goto('/updates');
  await expect(page.locator('.build-number')).toHaveText(/Current build: \d{4}\.\d{2}\.\d{2}\.\d{3}/);
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
});
