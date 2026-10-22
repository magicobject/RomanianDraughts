const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, parseChangelog, inline, PAGES, SITE } = require('../build.js');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const { files } = build();

describe('sitemap.xml, robots.txt, security.txt', () => {
  test('the sitemap lists exactly the indexable pages, with absolute URLs', () => {
    const urls = [...files['sitemap.xml'].matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    assert.deepEqual(urls, PAGES.filter(p => p.index).map(p => SITE + p.clean));
    assert.ok(urls.includes(`${SITE}/`) && urls.includes(`${SITE}/help`));
    assert.ok(!urls.some(u => /updates|404/.test(u)));
  });
  test('robots.txt allows crawling and names the sitemap', () => {
    const robots = read('public/robots.txt');
    assert.match(robots, /^User-agent: \*\nAllow: \//);
    assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
  });
  test('security.txt has a contact, a canonical address and at least 60 days before it expires', () => {
    const sec = read('public/.well-known/security.txt');
    assert.match(sec, /^Contact: mailto:[^@\s]+@[^@\s]+$/m);
    assert.ok(sec.includes(`Canonical: ${SITE}/.well-known/security.txt`));
    const expires = Date.parse(/^Expires: (.+)$/m.exec(sec)[1]);
    assert.ok(expires - Date.now() > 60 * 864e5, 'renew the Expires date in public/.well-known/security.txt');
    assert.ok(expires - Date.now() < 366 * 864e5, 'RFC 9116: Expires should be within a year');
  });
});

describe('favicons', () => {
  test('the SVG, both PNGs and the ICO exist and are real images', () => {
    assert.match(read('public/favicon.svg'), /^<svg /);
    for (const f of ['favicon-32.png', 'apple-touch-icon.png']) {
      const b = fs.readFileSync(path.join(root, 'public', f));
      assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], f);
    }
    const ico = fs.readFileSync(path.join(root, 'public/favicon.ico'));
    assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  });
  test('the PNGs are the sizes the pages claim', () => {
    const size = f => { const b = fs.readFileSync(path.join(root, 'public', f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    assert.deepEqual(size('favicon-32.png'), [32, 32]);
    assert.deepEqual(size('apple-touch-icon.png'), [180, 180]);
  });
});

describe('internal links', () => {
  const exists = href => {
    const p = href.split('#')[0].split('?')[0];
    if (p === '/') return true;
    return Object.keys(files).includes(p.slice(1)) || Object.keys(files).includes(p.slice(1) + '.html') ||
      fs.existsSync(path.join(root, 'public', p.slice(1)));
  };
  for (const page of PAGES) {
    test(`every same-site href and src on ${page.file} points at something that exists`, () => {
      for (const m of files[page.file].matchAll(/(?:href|src)="(\/[^"]*)"/g)) assert.ok(exists(m[1]), `${m[1]} (on ${page.file})`);
    });
  }
});

describe('/updates and the changelog', () => {
  const entries = parseChangelog(read('changelog.md'));
  const current = JSON.parse(read('build-number.json'));
  const currentBuild = `${current.date}.${String(current.build).padStart(3, '0')}`;

  test('changelog.md parses into entries, newest first', () => {
    assert.ok(entries.length >= 5);
    const builds = entries.map(e => e.build);
    assert.deepEqual(builds, [...builds].sort().reverse());
    assert.equal(new Set(builds).size, builds.length, 'duplicate build numbers');
  });
  test('the newest entry is the build in build-number.json, and /updates says so', () => {
    assert.equal(entries[0].build, currentBuild);
    assert.ok(files['updates.html'].includes(`Current build: ${currentBuild}`));
  });
  test('/updates shows every changelog entry, with its author and date', () => {
    for (const e of entries) assert.ok(files['updates.html'].includes(`<span class="changelog-build">${e.build}</span>`), e.build);
    assert.equal((files['updates.html'].match(/class="changelog-build"/g) || []).length, entries.length);
  });
  test('every author in the changelog is on the roster in users.json', () => {
    const roster = JSON.parse(read('users.json')).map(u => `${u.firstName} ${u.lastName}`);
    for (const e of entries) assert.ok(roster.includes(e.author), `${e.build}: ${e.author}`);
  });
  test('the build number appears on /updates only, so other pages do not change on every commit', () => {
    for (const page of PAGES.filter(p => p.file !== 'updates.html')) assert.ok(!files[page.file].includes(currentBuild), page.file);
  });
  test('changelog links to repo files are shown as code, never as dead links', () => {
    assert.ok(!/href="[^"]*(\.yml|\.jsonc|\.md|_headers)"/.test(files['updates.html']));
  });
  test('changelog **bold**, `code` and [links](...) are rendered, not shown as raw markdown', () => {
    const text = files['updates.html'].replace(/<[^>]+>/g, '');
    assert.ok(!text.includes('**'), 'raw ** left on /updates');
    assert.ok(!/`/.test(text), 'raw backtick left on /updates');
    assert.ok(!/\]\(/.test(text), 'raw markdown link left on /updates');
  });
  test('hostile changelog text cannot inject markup or odd links', () => {
    assert.ok(!/<(img|b|i|script)/i.test(inline('<img src=x onerror=alert(1)> <script>x</script> `<b>` **<i>**')));
    for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '__proto__', 'constructor', 'toString']) {
      const out = inline(`[x](${bad})`);
      assert.ok(out.startsWith('<code>x</code>') && !out.includes('<a '), bad + ' -> ' + out);
    }
    const out = inline('[x](https://a"><script>alert(1)</script>)');
    assert.ok(!out.includes('<script') && !/href="[^"]*"[^>]*"/.test(out.replace(/&quot;/g, '')), out);
  });
  test('markup in the changelog is escaped', () => {
    assert.ok(!/<script/i.test(files['updates.html']));
  });
});

describe('/help', () => {
  test('is plain-English, linked from the footer of every page, and mentions how to play and what to do when stuck', () => {
    const help = files['help.html'];
    assert.match(help, /<h1>Help<\/h1>/);
    assert.match(help, /How to play/);
    assert.match(help, /If something does not work/);
  });
});
