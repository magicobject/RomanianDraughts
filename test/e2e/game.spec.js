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

test('the hidden attribute really hides: no chain buttons at the start, no computer options in two-player mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#chainBtns')).toBeHidden();
  await expect(page.locator('#aiOpts')).toBeVisible();
  await page.getByRole('button', { name: 'Two players' }).click();
  await expect(page.locator('#aiOpts')).toBeHidden();
});

test('New game, mode and side switches during the computer\'s move start a clean game (a stale computer move is dropped)', async ({ page }) => {
  for (const reset of [() => page.getByRole('button', { name: 'New game' }).click(), () => page.getByRole('button', { name: 'Two players' }).click()]) { // (switching side is left out: playing Light legitimately makes the computer move first)
    await page.goto('/');
    await page.getByRole('button', { name: 'Computer' }).click();
    await page.getByRole('button', { name: 'Easy' }).click();
    const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
    await page.locator(`.sq[data-i="${step[0]}"]`).click();
    await page.locator(`.sq[data-i="${step[1]}"]`).click();
    await page.waitForTimeout(450); // the computer is thinking/animating now
    await reset();
    await page.waitForTimeout(2500); // long enough for the old computer move to land if it were still queued
    await expect(page.locator('#log .n')).toHaveCount(0);
    await expect(page.locator('#status')).toContainText(/your move|dark to move/i);
  }
});

test('Escape cancels a selected piece', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  const from = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1)[0].path[0]);
  await page.locator(`.sq[data-i="${from}"]`).click();
  await expect(page.locator('.piece.sel')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.piece.sel')).toHaveCount(0);
});

test('with JavaScript off the page says the game needs it', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.content()).toContain('<noscript><div class="card"><strong>This game needs JavaScript.</strong>');
  await context.close();
});

test('small controls are at least 24px tall and wide on a phone (WCAG 2.5.8)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const el of await page.locator('button:visible, summary').all()) {
    if (await el.evaluate(e => e.closest('[aria-hidden="true"]'))) continue;
    const box = await el.boundingBox();
    expect(box.height, await el.textContent()).toBeGreaterThanOrEqual(24);
    expect(box.width, await el.textContent()).toBeGreaterThanOrEqual(24);
  }
});

test('on Hard the page stays responsive while the computer thinks, and the computer still replies', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Computer' }).click();
  await page.getByRole('button', { name: 'Hard' }).click();
  await page.evaluate(() => {
    window.__gap = 0;
    let last = performance.now();
    setInterval(() => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - last); last = n; }, 10);
  });
  const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await expect(page.locator('#status')).toContainText(/thinking/i);
  await page.locator('footer').getByRole('link', { name: 'Help' }).focus(); // a control can be focused while it thinks
  await expect(page.locator('#log li span:nth-child(3)').first()).not.toBeEmpty({ timeout: 10000 }); // the computer's reply is logged
  const gap = await page.evaluate(() => window.__gap);
  expect(gap, `the main thread was blocked for ${Math.round(gap)}ms`).toBeLessThan(150);
});

test('if Web Workers are unavailable the computer still replies (main-thread fallback)', async ({ page }) => {
  await page.addInitScript(() => { delete window.Worker; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Computer' }).click();
  await page.getByRole('button', { name: 'Easy' }).click();
  const step = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await page.locator(`.sq[data-i="${step[0]}"]`).click();
  await page.locator(`.sq[data-i="${step[1]}"]`).click();
  await expect(page.locator('#log li span:nth-child(3)').first()).not.toBeEmpty({ timeout: 10000 });
});
