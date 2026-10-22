const { test, expect } = require('./fixtures');

// Keyboard play: the board is one Tab stop (roving tabindex), arrows move between the 32 playable squares, and focus stays on the
// board across moves, including the computer's.

const inBoard = page => page.evaluate(() => !!document.activeElement?.closest('#board'));
const focusedI = page => page.evaluate(() => Number(document.activeElement.dataset.i));

async function focusBoard(page) {
  await page.locator('.skip-link').focus(); // the first control on the page
  let presses = 0;
  while (!(await inBoard(page)) && presses < 40) { await page.keyboard.press('Tab'); presses++; }
  return presses;
}

test('the board is a single Tab stop and is reached in a few presses', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('.sq[tabindex="0"]').count()).toBe(1);
  await page.locator('.sq.dark[tabindex="-1"]').first().waitFor();
  expect(await page.locator('.sq.dark[tabindex="-1"]').count()).toBe(31);
  const presses = await focusBoard(page);
  expect(presses).toBeLessThanOrEqual(6);
  // one more Tab leaves the board for the controls; it does not walk the squares
  await page.keyboard.press('Tab');
  expect(await inBoard(page)).toBe(false);
  await page.keyboard.press('Shift+Tab');
  expect(await inBoard(page)).toBe(true);
});

test('arrow keys move focus between playable squares, in screen terms', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  await focusBoard(page);
  const pos = () => page.evaluate(() => { const k = [...document.querySelectorAll('#board .sq')].indexOf(document.activeElement); return [k >> 3, k & 7]; });
  const [r0, c0] = await pos();
  await page.keyboard.press('ArrowUp');
  const [r1, c1] = await pos();
  expect(r1).toBe(r0 - 1);
  expect(Math.abs(c1 - c0)).toBe(1);
  await page.keyboard.press('ArrowDown');
  expect(await pos()).toEqual([r0, c0]);          // Up then Down returns to the same square
  await page.keyboard.press('Home');
  const [r2, c2] = await pos();
  expect([r2, c2 <= 1].join()).toBe([r0, true].join());
  await page.keyboard.press('ArrowRight');
  expect(await pos()).toEqual([r0, c2 + 2]);
  await page.keyboard.press('End');
  expect((await pos())[1]).toBeGreaterThanOrEqual(6);
  expect(await page.locator('.sq[tabindex="0"]').count()).toBe(1);
});

test('a whole move can be made with the keyboard alone (two players)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  const [from, to] = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await focusBoard(page);
  const goTo = async target => {
    for (let n = 0; n < 40 && (await focusedI(page)) !== target; n++) {
      const cur = await focusedI(page);
      const dr = (target >> 3) - (cur >> 3);
      if (dr !== 0) await page.keyboard.press(dr < 0 ? 'ArrowUp' : 'ArrowDown');
      else await page.keyboard.press((target & 7) < (cur & 7) ? 'ArrowLeft' : 'ArrowRight');
    }
    expect(await focusedI(page)).toBe(target);
  };
  await goTo(from);
  await page.keyboard.press('Enter');
  await expect(page.locator('.piece.sel')).toHaveCount(1);
  await goTo(to);
  await page.keyboard.press('Space');
  await expect(page.locator('#log .n')).toHaveCount(1);
  expect(await inBoard(page)).toBe(true);
});

test('Escape cancels a selection made with the keyboard and focus stays on the board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two players' }).click();
  await focusBoard(page);
  await page.keyboard.press('Enter');
  if (await page.locator('.piece.sel').count() === 0) { // focus began on a square without a piece to move: pick the first piece instead
    const from = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1)[0].path[0]);
    await page.locator(`.sq[data-i="${from}"]`).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.piece.sel')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.piece.sel')).toHaveCount(0);
  expect(await inBoard(page)).toBe(true);
});

test('against the computer, focus stays on the board through its move, and the squares ignore input meanwhile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Computer' }).click();
  await page.getByRole('button', { name: 'Easy' }).click();
  const [from, to] = await page.evaluate(() => RD.allMoves(RD.initialBoard(), 1).find(m => m.path.length === 2 && m.caps.length === 0).path);
  await page.locator(`.sq[data-i="${from}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator(`.sq[data-i="${to}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#status')).toContainText(/thinking/i);
  expect(await inBoard(page)).toBe(true);
  expect(await page.locator('.sq.dark[aria-disabled="true"]').count()).toBe(32);
  expect(await page.locator('.sq.dark:disabled').count()).toBe(0);
  const piecesBefore = await page.locator('#log li').count();
  await page.keyboard.press('Enter'); // ignored: not the player's turn
  await expect(page.locator('#log li').first().locator('span').nth(2)).not.toBeEmpty({ timeout: 15_000 });
  await expect(page.locator('#status')).toContainText(/your move/i);
  expect(await inBoard(page)).toBe(true);
  expect(await page.locator('.sq[aria-disabled="true"]').count()).toBe(0);
  expect(piecesBefore).toBe(1);
});

test('when playing Light the board is flipped and arrows still follow the screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Computer' }).click();
  await page.getByRole('button', { name: 'Easy' }).click();
  await page.getByRole('button', { name: /^Light/ }).click();
  await expect(page.locator('#status')).toContainText(/your move/i, { timeout: 15_000 });
  await focusBoard(page);
  expect(await inBoard(page)).toBe(true);
  const pos = () => page.evaluate(() => [...document.querySelectorAll('#board .sq')].indexOf(document.activeElement));
  const k0 = await pos();
  await page.keyboard.press((k0 >> 3) > 0 ? 'ArrowUp' : 'ArrowDown');
  const k1 = await pos();
  expect(Math.abs((k1 >> 3) - (k0 >> 3))).toBe(1);
  expect(await page.locator('.sq[tabindex="0"]').count()).toBe(1);
});
