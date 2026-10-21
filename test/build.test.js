const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');

describe('generated index.html', () => {
  const engine = read('src/engine.js').replace("if (typeof module !== 'undefined') module.exports = RD;", '');
  const expected = read('src/page.template.html').replace('/*@ENGINE@*/', () => engine);

  test('is exactly what build.js produces (run `node build.js` after editing src/)', () => {
    assert.equal(read('index.html'), expected);
  });
  test('the template still has its engine placeholder', () => {
    assert.ok(read('src/page.template.html').includes('/*@ENGINE@*/'));
  });
  test('the built page does not leak the Node export line', () => {
    assert.ok(!read('index.html').includes('module.exports'));
  });
  test('the built page defines RD and is self-contained (no external scripts)', () => {
    const html = read('index.html');
    assert.match(html, /const RD = /);
    assert.ok(!/<script[^>]+src=/i.test(html));
  });
});

describe('docs', () => {
  test('RULES.md exists and the README links to it', () => {
    assert.ok(fs.existsSync(path.join(root, 'docs/RULES.md')));
    assert.match(read('README.md'), /docs\/RULES\.md/);
  });
});
