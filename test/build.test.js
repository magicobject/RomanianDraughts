const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, PAGES } = require('../build.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const csp = () => /Content-Security-Policy: (.*)/.exec(read('public/_headers'))[1];
const { files } = build();

describe('generated public/', () => {
  for (const [rel, content] of Object.entries(files)) {
    test(`public/${rel} is exactly what build.js produces (run \`npm run build\` after editing src/ or changelog.md)`, () => {
      assert.equal(read(`public/${rel}`), content);
    });
  }
  test('the engine file does not leak the Node export line', () => {
    assert.ok(!files['js/engine.js'].includes('module.exports'));
    assert.match(files['js/engine.js'], /const RD = /);
  });
  test('there is no stale index.html at the repo root', () => {
    assert.ok(!fs.existsSync(path.join(root, 'index.html')));
  });
});

describe('every page is a proper document', () => {
  for (const page of PAGES) {
    const html = files[page.file];
    test(`${page.file}: doctype, lang, viewport, title, description`, () => {
      assert.match(html, /^<!doctype html>\n<html lang="en">/);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
      assert.match(html, /<title>[^<]+<\/title>/);
      assert.match(html, /<meta name="description" content="[^"]+">/);
    });
    // Without a charset the browser guesses; it once mis-read the game script, so its CSP hash stopped matching and the page was dead.
    test(`${page.file}: <meta charset="utf-8"> comes within the first 1024 bytes`, () => {
      const i = html.indexOf('<meta charset="utf-8">');
      assert.ok(i >= 0 && i < 1024, `charset at ${i}`);
    });
    test(`${page.file}: favicon links and the MediaWright footer`, () => {
      assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
      assert.match(html, /<link rel="icon" href="\/favicon-32\.png" type="image\/png" sizes="32x32">/);
      assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
      assert.match(html, /<footer class="site">[\s\S]*A <a href="https:\/\/mediawright\.uk">MediaWright<\/a> site/);
      assert.match(html, /<a href="\/help">Help<\/a>/);
      assert.match(html, /<a href="\/updates">Site updates<\/a>/);
    });
    test(`${page.file}: no inline script, no inline event handler`, () => {
      for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        assert.match(m[1], /src="\/js\/[a-z]+\.js\?v=[0-9a-f]{10}"/);
        assert.equal(m[2], '');
      }
      assert.ok(!/\son[a-z]+="/.test(html), 'inline event handler');
    });
    test(`${page.file}: indexable pages say so, the others are noindex`, () => {
      assert.match(html, page.index ? /<meta name="robots" content="index, follow">/ : /<meta name="robots" content="noindex, nofollow">/);
    });
  }
  test('only the game page loads the game scripts', () => {
    for (const page of PAGES) assert.equal(files[page.file].includes('<script src="/js/game.js'), !!page.game, page.file);
  });
  test('the stylesheet and scripts carry a content hash that matches the file', () => {
    const crypto = require('crypto');
    const h = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 10);
    const html = files['index.html'];
    assert.ok(html.includes(`/css/style.css?v=${h(files['css/style.css'])}`));
    assert.ok(html.includes(`/js/engine.js?v=${h(files['js/engine.js'])}`));
    assert.ok(html.includes(`/js/game.js?v=${h(files['js/game.js'])}`));
    assert.ok(html.includes(`data-worker="/js/ai-worker.js?v=${h(files['js/ai-worker.js'])}"`));
  });
  test('the worker file is the engine plus its message handler, and is only in the build output once', () => {
    const w = files['js/ai-worker.js'];
    assert.ok(w.includes('const RD = (() =>') && w.includes('self.onmessage') && !w.includes('module.exports'));
    assert.ok(!files['index.html'].includes('<script src="/js/ai-worker.js'), 'the page must not load the worker as a script');
  });
});

describe('Content-Security-Policy and headers', () => {
  test('script-src is exactly \'self\': no inline scripts, hashes, unsafe-inline or unsafe-eval', () => {
    assert.equal(/script-src ([^;]*)/.exec(csp())[1], "'self'");
  });
  test('every page loads nothing from hosts the CSP does not name', () => {
    const hosts = new Set();
    // what a page loads (scripts, images, frames, stylesheets, preconnects), not the links people follow
    const loads = /<(?:script|img|iframe)[^>]*src="(https?:[/][/][^"/]+)|<link rel="(?:stylesheet|preconnect)"[^>]*href="(https?:[/][/][^"/]+)/g;
    for (const html of Object.values(files)) for (const m of html.matchAll(loads)) hosts.add(m[1] || m[2]);
    assert.ok(hosts.has('https://fonts.googleapis.com'), 'the scan should find the Google Fonts stylesheet');

    const policy = csp();
    for (const h of hosts) assert.ok(policy.includes(h), `${h} is used by a page but not in the CSP`);
  });
  test('framing, plugins and base-uri are locked down', () => {
    const p = csp();
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "frame-src 'none'", "base-uri 'self'"]) assert.ok(p.includes(d), d);
  });
  test('the other security headers are present', () => {
    const h = read('public/_headers');
    for (const n of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Referrer-Policy:', 'Strict-Transport-Security:', 'Permissions-Policy:']) assert.ok(h.includes(n), n);
  });
  test('security.txt is served as UTF-8 plain text', () => {
    assert.match(read('public/_headers'), /\/\.well-known\/security\.txt\n\s+Content-Type: text\/plain; charset=utf-8/);
  });
});

describe('wrangler.jsonc', () => {
  const config = JSON.parse(read('wrangler.jsonc'));
  test('names the worker romaniandraughts', () => assert.equal(config.name, 'romaniandraughts'));
  test('serves only public/', () => assert.equal(config.assets.directory, './public'));
  test('keeps not_found_handling "404-page" (otherwise unknown URLs get an empty 404 in production)', () => {
    assert.equal(config.assets.not_found_handling, '404-page');
  });
  test('public/404.html exists and is the styled page', () => {
    assert.match(read('public/404.html'), /<h1>Page not found<\/h1>/);
  });
});

describe('docs', () => {
  test('RULES.md exists and the README links to it', () => {
    assert.ok(fs.existsSync(path.join(root, 'docs/RULES.md')));
    assert.match(read('README.md'), /docs\/RULES\.md/);
  });
});
