const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { RD, sq, board, find, sorted } = require('./support/helpers');

describe('initialBoard', () => {
  const b = RD.initialBoard();
  test('8 pieces a side', () => {
    assert.equal(RD.count(b, 1), 8);
    assert.equal(RD.count(b, -1), 8);
  });
  test('Dark on rows 6-7, Light on rows 0-1, middle rows empty', () => {
    for (let i = 0; i < 64; i++) {
      const r = i >> 3;
      if (r >= 2 && r <= 5) assert.equal(b[i], 0, `square ${i}`);
      else if (b[i] !== 0) assert.equal(b[i], r >= 6 ? 1 : -1, `square ${i}`);
    }
  });
  test('only the dark squares are used, 4 per row', () => {
    for (const r of [0, 1, 6, 7]) {
      let n = 0;
      for (let c = 0; c < 8; c++) if (b[sq(r, c)]) { n++; assert.equal((r + c) % 2, 1); }
      assert.equal(n, 4);
    }
  });
  test('each call returns a fresh board', () => {
    const x = RD.initialBoard(); x[0] = 1;
    assert.equal(RD.initialBoard()[0], 0);
  });
  test('opening: 13 moves for each side (7 steps + 6 jumps over own pieces, no captures)', () => {
    for (const side of [1, -1]) {
      const m = RD.allMoves(b, side);
      assert.equal(m.length, 13);
      assert.equal(m.filter(x => Math.abs((x.path[1] >> 3) - (x.path[0] >> 3)) === 2).length, 6);
      assert.ok(m.every(x => x.caps.length === 0));
    }
  });
});

describe('stepTargets', () => {
  test('centre piece has four steps, in any direction', () => {
    const b = board({ dark: [[3, 4]] });
    assert.deepEqual(sorted(RD.stepTargets(b, sq(3, 4))), sorted([sq(2, 3), sq(2, 5), sq(4, 3), sq(4, 5)]));
  });
  test('corner and edge pieces stay on the board', () => {
    assert.deepEqual(RD.stepTargets(board({ dark: [[7, 0]] }), sq(7, 0)), [sq(6, 1)]);
    assert.deepEqual(sorted(RD.stepTargets(board({ dark: [[4, 7]] }), sq(4, 7))), sorted([sq(3, 6), sq(5, 6)]));
  });
  test('occupied squares (either colour) block steps', () => {
    const b = board({ dark: [[3, 4], [2, 3]], light: [[4, 5]] });
    assert.deepEqual(sorted(RD.stepTargets(b, sq(3, 4))), sorted([sq(2, 5), sq(4, 3)]));
  });
});

describe('jumpTargets', () => {
  const jt = (b, from, caps = [], visited = [from]) => RD.jumpTargets(b, from, from, caps, visited);

  test('jumps an enemy piece and an own piece', () => {
    const b = board({ dark: [[4, 3], [3, 2]], light: [[3, 4]] });
    const t = jt(b, sq(4, 3));
    assert.equal(t.length, 2);
    assert.ok(t.some(j => j.over === sq(3, 4) && j.to === sq(2, 5)));
    assert.ok(t.some(j => j.over === sq(3, 2) && j.to === sq(2, 1)));
  });
  test('cannot jump an empty square', () => {
    assert.deepEqual(jt(board({ dark: [[4, 3]] }), sq(4, 3)), []);
  });
  test('cannot land off the board', () => {
    assert.deepEqual(jt(board({ dark: [[4, 1]], light: [[3, 0]] }), sq(4, 1)), []);
  });
  test('cannot land on an occupied square', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4], [2, 5]] });
    assert.deepEqual(jt(b, sq(4, 3)), []);
  });
  test('cannot jump a piece already captured this turn', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    assert.deepEqual(jt(b, sq(4, 3), [sq(3, 4)]), []);
  });
  test('cannot land on a square already visited this turn', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    assert.deepEqual(jt(b, sq(4, 3), [], [sq(4, 3), sq(2, 5)]), []);
  });
  test('the origin square is never treated as a piece to jump over', () => {
    // Mid-chain, standing next to the origin square (still holding the moving piece on the input board).
    const b = board({ dark: [[4, 3]] });
    const t = RD.jumpTargets(b, sq(4, 3), sq(3, 4), [], [sq(4, 3), sq(3, 4)]);
    assert.deepEqual(t, []);
  });
});

describe('allMoves', () => {
  test('returns nothing when the side has no pieces', () => {
    assert.deepEqual(RD.allMoves(board({ dark: [[4, 3]] }), -1), []);
  });
  test('a jump over an enemy captures it', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    assert.deepEqual(find(RD.allMoves(b, 1), sq(4, 3), sq(2, 5)).caps, [sq(3, 4)]);
  });
  test('a jump over an own piece captures nothing', () => {
    const b = board({ dark: [[4, 3], [3, 4]] });
    const m = find(RD.allMoves(b, 1), sq(4, 3), sq(2, 5));
    assert.deepEqual(m.caps, []);
    assert.equal(m.path.length, 2);
  });
  test('capturing is optional: steps are offered alongside a jump', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    const m = RD.allMoves(b, 1);
    assert.ok(find(m, sq(4, 3), sq(3, 2)), 'step available');
    assert.ok(find(m, sq(4, 3), sq(2, 5)), 'jump available');
  });
  test('chain over an own piece then an enemy; stopping part-way is offered', () => {
    const b = board({ dark: [[5, 2], [4, 3]], light: [[2, 5], [0, 1]] });
    const m = RD.allMoves(b, 1);
    const full = find(m, sq(5, 2), sq(1, 6));
    assert.deepEqual(full.path, [sq(5, 2), sq(3, 4), sq(1, 6)]);
    assert.deepEqual(full.caps, [sq(2, 5)]);
    assert.deepEqual(find(m, sq(5, 2), sq(3, 4)).caps, []);
  });
  test('multi-capture chain collects every captured piece in order', () => {
    const b = board({ dark: [[6, 1]], light: [[5, 2], [3, 4], [1, 6]] });
    const m = find(RD.allMoves(b, 1), sq(6, 1), sq(0, 7));
    assert.deepEqual(m.caps, [sq(5, 2), sq(3, 4), sq(1, 6)]);
  });
  test('a chain can turn corners and go backwards', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4], [3, 6]] });
    const m = find(RD.allMoves(b, 1), sq(4, 3), sq(4, 7));
    assert.deepEqual(sorted(m.caps), sorted([sq(3, 4), sq(3, 6)]));
  });
  test('no piece is captured twice and no square is landed on twice in any chain', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4], [3, 2], [5, 4], [5, 2], [1, 4]] });
    for (const m of RD.allMoves(b, 1)) {
      assert.equal(new Set(m.caps).size, m.caps.length, 'caps ' + m.caps);
      assert.equal(new Set(m.path).size, m.path.length, 'path ' + m.path);
    }
  });
  test('a captured piece stays on the board during the chain, so it cannot be re-jumped', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    const caps = RD.allMoves(b, 1).filter(x => x.caps.length);
    assert.equal(caps.length, 1);
    assert.deepEqual(caps[0].path, [sq(4, 3), sq(2, 5)]);
  });
  test('moves are unique by origin, destination and captures', () => {
    const b = board({ dark: [[6, 1]], light: [[5, 2], [3, 4], [5, 4], [3, 2], [1, 2]] });
    const keys = RD.allMoves(b, 1).map(m => m.path[0] + '>' + m.path.at(-1) + ':' + sorted(m.caps).join(','));
    assert.equal(new Set(keys).size, keys.length);
  });
  test('only moves pieces of the side asked for, onto empty squares', () => {
    const b = RD.initialBoard();
    for (const side of [1, -1]) for (const m of RD.allMoves(b, side)) {
      assert.equal(b[m.path[0]], side);
      assert.equal(b[m.path.at(-1)], 0);
    }
  });
  test('a turn is a step or a chain of jumps, never a mix', () => {
    const b = board({ dark: [[6, 1]], light: [[5, 2], [3, 4], [1, 6]] });
    for (const m of RD.allMoves(b, 1)) {
      const spans = m.path.slice(1).map((s, i) => Math.abs((s >> 3) - (m.path[i] >> 3)));
      assert.ok(spans.every(d => d === 1) && spans.length === 1 || spans.every(d => d === 2), 'path ' + m.path);
    }
  });
});

describe('hasMove', () => {
  test('true when a step exists', () => assert.ok(RD.hasMove(board({ dark: [[4, 3]] }), 1)));
  test('true when only a jump exists', () => {
    // (7,0) is boxed in by its friend at (6,1), but can jump it to the empty (5,2).
    assert.ok(RD.hasMove(board({ dark: [[7, 0], [6, 1]], light: [] }), 1) );
    const b = board({ dark: [[7, 0]], light: [[6, 1]] });
    assert.ok(RD.hasMove(b, 1));
  });
  test('false when boxed in with no landing square', () => {
    assert.equal(RD.hasMove(board({ dark: [[7, 0]], light: [[6, 1], [5, 2]] }), 1), false);
  });
  test('false with no pieces', () => assert.equal(RD.hasMove(new Int8Array(64), 1), false));
  test('agrees with allMoves on the opening position', () => {
    const b = RD.initialBoard();
    for (const s of [1, -1]) assert.equal(RD.hasMove(b, s), RD.allMoves(b, s).length > 0);
  });
});

describe('applyMove', () => {
  test('moves the piece and does not mutate the input', () => {
    const b = RD.initialBoard(), copy = new Int8Array(b);
    const m = RD.allMoves(b, 1)[0];
    const n = RD.applyMove(b, m);
    assert.deepEqual(b, copy);
    assert.equal(n[m.path[0]], 0);
    assert.equal(n[m.path.at(-1)], 1);
    assert.equal(RD.count(n, 1), 8);
  });
  test('removes captured enemies and only those', () => {
    const b = board({ dark: [[6, 1]], light: [[5, 2], [3, 4], [1, 6], [2, 1]] });
    const n = RD.applyMove(b, find(RD.allMoves(b, 1), sq(6, 1), sq(0, 7)));
    for (const [r, c] of [[5, 2], [3, 4], [1, 6]]) assert.equal(n[sq(r, c)], 0);
    assert.equal(n[sq(2, 1)], -1);
    assert.equal(n[sq(0, 7)], 1);
  });
  test('an own piece that was jumped stays on the board', () => {
    const b = board({ dark: [[4, 3], [3, 4]] });
    const n = RD.applyMove(b, find(RD.allMoves(b, 1), sq(4, 3), sq(2, 5)));
    assert.equal(RD.count(n, 1), 2);
    assert.equal(n[sq(3, 4)], 1);
  });
  test('keeps the piece colour for Light', () => {
    const b = board({ light: [[3, 4]] });
    const n = RD.applyMove(b, RD.allMoves(b, -1)[0]);
    assert.equal(RD.count(n, -1), 1);
    assert.equal(RD.count(n, 1), 0);
  });
});

describe('count / winnerAfter', () => {
  test('count counts per side', () => {
    const b = board({ dark: [[1, 0], [2, 1]], light: [[5, 4]] });
    assert.equal(RD.count(b, 1), 2);
    assert.equal(RD.count(b, -1), 1);
  });
  test('capturing the last piece wins', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    const n = RD.applyMove(b, find(RD.allMoves(b, 1), sq(4, 3), sq(2, 5)));
    assert.equal(RD.winnerAfter(n, 1), 1);
  });
  test('blocking the opponent wins', () => {
    assert.equal(RD.winnerAfter(board({ dark: [[6, 1], [5, 2]], light: [[7, 0]] }), 1), 1);
  });
  test('works for Light too', () => {
    assert.equal(RD.winnerAfter(board({ light: [[1, 6], [2, 5]], dark: [[0, 7]] }), -1), -1);
  });
  test('no winner while the opponent can still move', () => {
    assert.equal(RD.winnerAfter(RD.initialBoard(), 1), 0);
    assert.equal(RD.winnerAfter(RD.initialBoard(), -1), 0);
  });
  test('an opponent who can only jump is not blocked', () => {
    const b = board({ light: [[7, 0], [6, 1]], dark: [[3, 4]] });
    assert.equal(RD.winnerAfter(b, 1), 0);
  });
});
