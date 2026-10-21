const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { build } = require('../build.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const csp = () => /Content-Security-Policy: (.*)/.exec(read('public/_headers'))[1];

describe('generated public/', () => {
  const { html, headers } = build();

  test('index.html is exactly what build.js produces (run `npm run build` after editing src/)', () => {
    assert.equal(read('public/index.html'), html);
  });
  test('_headers is exactly what build.js produces', () => {
    assert.equal(read('public/_headers'), headers);
  });
  test('the template still has its engine placeholder', () => {
    assert.ok(read('src/page.template.html').includes('/*@ENGINE@*/'));
  });
  test('the built page does not leak the Node export line', () => {
    assert.ok(!read('public/index.html').includes('module.exports'));
  });
  test('the built page defines RD', () => {
    assert.match(read('public/index.html'), /const RD = /);
  });
  test('there is no stale index.html at the repo root', () => {
    assert.ok(!fs.existsSync(path.join(root, 'index.html')));
  });
});

describe('Content-Security-Policy', () => {
  test('every inline script has its hash in script-src, and no script is unhashed', () => {
    const scripts = [...read('public/index.html').matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length > 0);
    const policy = csp();
    for (const [, attrs, body] of scripts) {
      assert.equal(attrs.trim(), '', 'external or typed scripts need CSP review');
      const h = `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;
      assert.ok(policy.includes(h), `missing hash ${h}`);
    }
  });
  test('script-src never allows unsafe-inline or unsafe-eval', () => {
    const scriptSrc = /script-src ([^;]*)/.exec(csp())[1];
    assert.ok(!/unsafe-/.test(scriptSrc));
  });
  test('the page loads nothing from hosts the CSP does not name', () => {
    const html = read('public/index.html');
    const hosts = new Set([...html.matchAll(/(?:src|href)="(https?:\/\/[^"/]+)/g)].map(m => m[1]));
    const policy = csp();
    for (const h of hosts) assert.ok(policy.includes(h), `${h} is used by the page but not in the CSP`);
  });
  test('framing, plugins and base-uri are locked down', () => {
    const p = csp();
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'"]) assert.ok(p.includes(d), d);
  });
  test('the other security headers are present', () => {
    const h = read('public/_headers');
    for (const n of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Referrer-Policy:', 'Strict-Transport-Security:', 'Permissions-Policy:']) assert.ok(h.includes(n), n);
  });
});

describe('wrangler.jsonc', () => {
  const config = JSON.parse(read('wrangler.jsonc'));
  test('names the worker romaniandraughts', () => assert.equal(config.name, 'romaniandraughts'));
  test('serves only public/', () => assert.equal(config.assets.directory, './public'));
  test('keeps not_found_handling "404-page" (otherwise unknown URLs get an empty 404 in production)', () => {
    assert.equal(config.assets.not_found_handling, '404-page');
  });
  test('public/404.html exists', () => assert.ok(fs.existsSync(path.join(root, 'public/404.html'))));
});

describe('docs', () => {
  test('RULES.md exists and the README links to it', () => {
    assert.ok(fs.existsSync(path.join(root, 'docs/RULES.md')));
    assert.match(read('README.md'), /docs\/RULES\.md/);
  });
});
