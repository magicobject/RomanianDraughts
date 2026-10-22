const { test, expect } = require('@playwright/test');

// Production serves these headers from public/_headers; wrangler dev applies the same file, so this checks what visitors get.
test('every page carries the security headers and a CSP with no inline script allowance', async ({ request }) => {
  for (const path of ['/', '/help', '/updates', '/no-such-page']) {
    const h = (await request.get(path)).headers();
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('DENY');
    expect(h['strict-transport-security'], path).toContain('max-age=');
    expect(h['referrer-policy'], path).toBeTruthy();
    expect(h['permissions-policy'], path).toBeTruthy();
    const scriptSrc = /script-src ([^;]*)/.exec(h['content-security-policy'])[1];
    expect(scriptSrc, path).toBe("'self'");
  }
});

test('robots.txt, sitemap.xml and security.txt are served', async ({ request }) => {
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://romaniandraughts.mediawright.uk/sitemap.xml');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('<loc>https://romaniandraughts.mediawright.uk/help</loc>');
  const sec = await request.get('/.well-known/security.txt');
  expect(sec.status()).toBe(200);
  expect(sec.headers()['content-type']).toContain('text/plain');
  expect(await sec.text()).toContain('Contact:');
});

test('an unknown address gets a real 404 page, not an empty one', async ({ request }) => {
  const r = await request.get('/no-such-page');
  expect(r.status()).toBe(404);
  expect(await r.text()).toContain('Page not found');
});
