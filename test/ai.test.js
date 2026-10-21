const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { RD, sq, board, find } = require('./support/helpers');

const isLegal = (b, side, m) => RD.allMoves(b, side).some(x =>
  x.path.length === m.path.length && x.path.every((s, i) => s === m.path[i]) && x.caps.length === m.caps.length);

describe('chooseMove', () => {
  test('returns null when the side has no legal move', () => {
    const b = board({ dark: [[7, 0]], light: [[6, 1], [5, 2]] });
    assert.equal(RD.chooseMove(b, 1, 'easy'), null);
  });

  for (const level of ['easy', 'medium', 'hard']) {
    test(`${level}: plays a legal move from the opening, for both sides, within its time limit`, () => {
      for (const side of [1, -1]) {
        const b = RD.initialBoard();
        const t = Date.now();
        const m = RD.chooseMove(b, side, level);
        const ms = Date.now() - t;
        assert.ok(isLegal(b, side, m), `${level} side ${side} chose an illegal move`);
        assert.ok(ms < 3500, `${level} took ${ms} ms`);
      }
    });
  }

  test('defaults to medium when no level is given', () => {
    const b = RD.initialBoard();
    assert.ok(isLegal(b, 1, RD.chooseMove(b, 1)));
  });

  test('hard takes a capture that wins the game', () => {
    const b = board({ dark: [[4, 3]], light: [[3, 4]] });
    const m = RD.chooseMove(b, 1, 'hard');
    assert.equal(m.caps.length, 1);
    assert.equal(RD.winnerAfter(RD.applyMove(b, m), 1), 1);
  });

  test('medium and hard win a capture-the-last-piece position as Light too', () => {
    const b = board({ light: [[3, 4]], dark: [[4, 3]] });
    for (const level of ['medium', 'hard']) {
      const m = RD.chooseMove(b, -1, level);
      assert.equal(RD.winnerAfter(RD.applyMove(b, m), -1), -1, level);
    }
  });

  test('hard wins by blocking when that is available', () => {
    // Light at (7,0) is boxed in once Dark steps (5,2)->... Dark to move from (6,1) with (4,3) ready:
    // after Dark plays (4,3)->(5,2) the corner piece cannot move or jump.
    const b = board({ dark: [[6, 1], [4, 3]], light: [[7, 0]] });
    const m = RD.chooseMove(b, 1, 'hard');
    assert.equal(RD.winnerAfter(RD.applyMove(b, m), 1), 1);
  });

  test('hard does not hang a piece when a safe move exists', () => {
    // Dark piece at (4,3), Light at (2,5). Stepping to (3,4) lets Light jump it; hard should avoid that.
    const b = board({ dark: [[4, 3], [6, 5]], light: [[2, 5]] });
    const m = RD.chooseMove(b, 1, 'hard');
    const after = RD.applyMove(b, m);
    const lost = RD.allMoves(after, -1).some(x => x.caps.length > 0);
    assert.equal(lost, false);
  });

  test('does not modify the board it is given', () => {
    const b = RD.initialBoard(), copy = new Int8Array(b);
    RD.chooseMove(b, 1, 'medium');
    assert.deepEqual(b, copy);
  });
});

describe('self-play', () => {
  test('a game between two computer levels only ever plays legal moves and ends cleanly', () => {
    let g = RD.initialBoard(), side = 1, winner = 0, plies = 0;
    while (plies < 300) {
      const m = RD.chooseMove(g, side, plies % 2 ? 'medium' : 'easy');
      if (!m) { winner = -side; break; }
      assert.ok(isLegal(g, side, m), `illegal move at ply ${plies}`);
      g = RD.applyMove(g, m);
      plies++;
      winner = RD.winnerAfter(g, side);
      if (winner) break;
      side = -side;
    }
    assert.ok(RD.count(g, 1) <= 8 && RD.count(g, -1) <= 8);
    assert.ok(winner === 0 ? plies === 300 : [1, -1].includes(winner));
  });
});
