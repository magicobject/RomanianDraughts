const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Every text/background (4.5:1) and UI/focus (3:1) pairing the page relies on, computed from the tokens in src/style.css, never eyeballed.
const css = fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8').replace(/\r\n/g, '\n');
const tokens = block => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
const light = tokens(/:root \{([\s\S]*?)\n\}/.exec(css)[1]);
const dark = { ...light, ...tokens(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(css)[1]) };

const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

const PAIRS = [ // [foreground token, background token, minimum, what it is]
  ['fg', 'bg', 4.5, 'body text'], ['fg', 'surface', 4.5, 'card text'], ['muted', 'surface', 4.5, 'muted text on cards'], ['muted', 'bg', 4.5, 'muted text on the page'],
  ['accent', 'surface', 4.5, 'links and the focus ring on cards'], ['accent', 'bg', 4.5, 'links on the page'],
  ['surface', 'accent', 4.5, 'selected and primary button text'],
  ['ochre-text', 'surface', 4.5, 'the "wins" heading'],
  ['focus-sq', 'sq-dark', 3, 'focus and selection ring on a playable square'],
  ['frame-text', 'frame', 3, 'file and rank letters'],
];

for (const [name, t] of [['light', light], ['dark', dark]]) {
  describe(`${name} mode contrast`, () => {
    for (const [fg, bg, min, what] of PAIRS) {
      test(`${what}: ${fg} on ${bg} is at least ${min}:1`, () => {
        assert.ok(t[fg] && t[bg], `token missing: ${fg} or ${bg}`);
        const r = ratio(t[fg], t[bg]);
        assert.ok(r >= min, `${t[fg]} on ${t[bg]} is ${r.toFixed(2)}:1, needs ${min}:1`);
      });
    }
  });
}
