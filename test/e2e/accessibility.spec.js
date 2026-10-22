const { test, expect } = require('./fixtures');
const { AxeBuilder } = require('@axe-core/playwright');
const { PAGES, NOT_FOUND } = require('./pages');

// axe fetches the cross-origin Google Fonts stylesheet to read its rules, which the CSP's connect-src (rightly) refuses; the page itself never does this.
test.use({ allowedConsole: ["Connecting to 'https://fonts.googleapis.com"] });

const ALL = [...PAGES.map(p => p.path), NOT_FOUND];
const format = v => v.map(x => `[${x.impact}] ${x.id}: ${x.description}\n` + x.nodes.map(n => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' ')}`).join('\n')).join('\n\n');

for (const scheme of ['light', 'dark']) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const path of ALL) {
      test(`axe: ${path} has no violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations, format(results.violations)).toEqual([]);
      });
    }
  });
}

test('axe: the game has no violations with a piece selected (open state)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  const from = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1)[0].path[0]);
  await page.locator(`.sq[data-i="${from}"]`).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, format(results.violations)).toEqual([]);
});

// axe does not check heading order by default, so check it here: a heading may not jump more than one level deeper than the deepest so far.
for (const path of ALL) {
  test(`heading outline: ${path} has no skipped levels, and exactly one h1`, async ({ page }) => {
    await page.goto(path);
    const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', els => els.map(e => Number(e.tagName[1])));
    expect(levels.filter(l => l === 1).length, `h1 count in [${levels}]`).toBe(1);
    let max = 0;
    for (const l of levels) { expect(l, `[${levels}]`).toBeLessThanOrEqual(max + 1); max = Math.max(max, l); }
  });
}

for (const p of PAGES) {
  test(`${p.path} has a title, an h1 and a MediaWright footer`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page).toHaveTitle(new RegExp(p.titleContains));
    await expect(page.locator('h1')).toHaveText(p.heading);
    await expect(page.locator('footer.site')).toContainText('MediaWright');
  });
}

test('the 404 page is the styled one, with the right status', async ({ page }) => {
  const response = await page.goto(NOT_FOUND);
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.locator('footer.site')).toContainText('MediaWright');
});
