const base = require('@playwright/test');

// Every test fails if the page logs a console error (this is how a CSP block shows up), throws, or a same-site request fails.
// `allowedConsole` lists console messages (substrings) a spec accepts: the accessibility spec allows the one axe itself causes by fetching Google Fonts' stylesheet.
const test = base.test.extend({
  allowedConsole: [[], { option: true }],
  page: async ({ page, baseURL, allowedConsole }, use) => {
    const problems = [];
    page.on('console', m => { if (m.type() === 'error' && !allowedConsole.some(a => m.text().includes(a)) && !(page.url().includes('/no-such-page') && /404/.test(m.text()))) problems.push(`console: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`exception: ${e.message}`));
    page.on('requestfailed', r => { if (r.url().startsWith(baseURL)) problems.push(`request failed: ${r.url()}`); });
    page.on('response', r => { if (r.url().startsWith(baseURL) && r.status() >= 400 && !r.url().includes('/no-such-page')) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    await use(page);
    base.expect(problems, problems.join('\n')).toEqual([]);
  },
});

module.exports = { test, expect: base.expect };
