const path = require('path');
const RD = require(path.join(__dirname, '../../src/engine.js'));

const sq = (r, c) => r * 8 + c;

// board({ dark: [[r,c],...], light: [[r,c],...] }) -> Int8Array(64)
function board({ dark = [], light = [] } = {}) {
  const b = new Int8Array(64);
  for (const [r, c] of dark) b[sq(r, c)] = 1;
  for (const [r, c] of light) b[sq(r, c)] = -1;
  return b;
}

const find = (moves, from, to) => moves.find(m => m.path[0] === from && m.path[m.path.length - 1] === to);
const sorted = a => a.slice().sort((x, y) => x - y);

module.exports = { RD, sq, board, find, sorted };
