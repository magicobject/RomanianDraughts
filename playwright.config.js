const { defineConfig, devices } = require('@playwright/test');

// The site is served by `wrangler dev`, exactly as Cloudflare serves it: _headers (the CSP), clean URLs and the 404 page all apply.
// (PW_PORT lets a second copy of the suite run on its own port.)
const PORT = Number(process.env.PW_PORT ?? 4177);

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
