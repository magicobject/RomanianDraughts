// Romanian Draughts engine. Board: Int8Array(64), index = row*8+col.
// 1 = Dark (starts rows 6-7, moves first), -1 = Light (rows 0-1), 0 = empty.
const RD = (() => {
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function initialBoard() {
    const b = new Int8Array(64);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r <= 1) b[r * 8 + c] = -1;
      if (r >= 6) b[r * 8 + c] = 1;
    }
    return b;
  }

  function stepTargets(b, from) {
    const r = from >> 3, c = from & 7, out = [];
    for (const [dr, dc] of DIRS) {
      const r1 = r + dr, c1 = c + dc;
      if (inB(r1, c1) && b[r1 * 8 + c1] === 0) out.push(r1 * 8 + c1);
    }
    return out;
  }

  // Jumps available from `cur` for a piece that started at `from`.
  // The origin square counts as empty; captured pieces stay on the board
  // until the turn ends but cannot be jumped again; no square is landed on twice.
  function jumpTargets(b, from, cur, caps, visited) {
    const r = cur >> 3, c = cur & 7, out = [];
    for (const [dr, dc] of DIRS) {
      const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
      if (!inB(r2, c2)) continue;
      const over = r1 * 8 + c1, to = r2 * 8 + c2;
      if (over === from || b[over] === 0) continue;
      if (caps.includes(over)) continue;
      if (to !== from && b[to] !== 0) continue;
      if (visited.includes(to)) continue;
      out.push({ over, to });
    }
    return out;
  }

  // All legal moves for `side`, deduplicated by resulting position.
  function allMoves(b, side) {
    const moves = [], seen = new Set();
    for (let i = 0; i < 64; i++) {
      if (b[i] !== side) continue;
      for (const to of stepTargets(b, i)) moves.push({ path: [i, to], caps: [] });
      const dfs = (cur, path, caps) => {
        for (const j of jumpTargets(b, i, cur, caps, path)) {
          const nCaps = b[j.over] === -side ? caps.concat(j.over) : caps;
          const nPath = path.concat(j.to);
          const key = i + '>' + j.to + ':' + nCaps.slice().sort((a, b) => a - b).join(',');
          if (!seen.has(key)) {
            seen.add(key);
            moves.push({ path: nPath, caps: nCaps });
          }
          dfs(j.to, nPath, nCaps);
        }
      };
      dfs(i, [i], []);
    }
    return moves;
  }

  function hasMove(b, side) {
    for (let i = 0; i < 64; i++) {
      if (b[i] !== side) continue;
      if (stepTargets(b, i).length) return true;
      if (jumpTargets(b, i, i, [], [i]).length) return true;
    }
    return false;
  }

  function applyMove(b, m) {
    const n = new Int8Array(b);
    const from = m.path[0], to = m.path[m.path.length - 1];
    const p = n[from];
    n[from] = 0;
    for (const c of m.caps) n[c] = 0;
    n[to] = p;
    return n;
  }

  const count = (b, side) => { let k = 0; for (let i = 0; i < 64; i++) if (b[i] === side) k++; return k; };

  // Returns the winning side after `mover` has just moved, or 0.
  function winnerAfter(b, mover) {
    const opp = -mover;
    if (count(b, opp) === 0 || !hasMove(b, opp)) return mover;
    return 0;
  }

  // ---------- Computer opponent ----------
  function stepMobility(b, side) {
    let k = 0;
    for (let i = 0; i < 64; i++) if (b[i] === side) k += stepTargets(b, i).length;
    return k;
  }

  function evaluate(b, side) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const r = i >> 3, c = i & 7;
      const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)); // 0 edge .. 3 centre
      const edge = (r === 0 || r === 7 || c === 0 || c === 7) ? 4 : 0; // edges can't be jumped over
      score += p * (100 + centre * 2 + edge);
    }
    score += 2 * (stepMobility(b, 1) - stepMobility(b, -1));
    return score * side;
  }

  const WIN = 100000;

  function search(b, side, depth, alpha, beta, ctx, ply) {
    if (++ctx.nodes % 2048 === 0 && Date.now() > ctx.deadline) ctx.stop = true;
    if (ctx.stop) return 0;
    const moves = allMoves(b, side);
    if (moves.length === 0) return -WIN + ply; // side to move has no move: loses
    if (depth === 0) return evaluate(b, side);
    moves.sort((x, y) => y.caps.length - x.caps.length);
    let best = -Infinity;
    for (const m of moves) {
      const nb = applyMove(b, m);
      let v;
      if (count(nb, -side) === 0) v = WIN - ply - 1;
      else v = -search(nb, -side, depth - 1, -beta, -alpha, ctx, ply + 1);
      if (ctx.stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  // level: 'easy' | 'medium' | 'hard'
  function chooseMove(b, side, level = 'medium') {
    const moves = allMoves(b, side);
    if (!moves.length) return null;
    const cfg = { easy: { max: 1, ms: 300, noise: 60 }, medium: { max: 3, ms: 800, noise: 6 }, hard: { max: 8, ms: 1800, noise: 1 } }[level];
    const ctx = { deadline: Date.now() + cfg.ms, nodes: 0, stop: false };
    let bestMove = moves[0];
    let order = moves.slice().sort((x, y) => y.caps.length - x.caps.length);
    for (let depth = 1; depth <= cfg.max; depth++) {
      let alpha = -Infinity, bestHere = null, bestVal = -Infinity;
      const scored = [];
      for (const m of order) {
        const nb = applyMove(b, m);
        let v = count(nb, -side) === 0 ? WIN : -search(nb, -side, depth - 1, -Infinity, -alpha + cfg.noise, ctx, 1);
        if (ctx.stop) break;
        v += Math.random() * cfg.noise;
        scored.push([v, m]);
        if (v > bestVal) { bestVal = v; bestHere = m; }
        if (v > alpha) alpha = v;
      }
      if (ctx.stop && depth > 1) break;
      if (bestHere) bestMove = bestHere;
      scored.sort((x, y) => y[0] - x[0]);
      order = scored.map(s => s[1]).concat(order.filter(m => !scored.some(s => s[1] === m)));
      if (bestVal >= WIN - 100) break;
      if (ctx.stop) break;
    }
    return bestMove;
  }

  return { initialBoard, stepTargets, jumpTargets, allMoves, hasMove, applyMove, count, winnerAfter, chooseMove };
})();


// Web Worker for the computer's search, so Hard does not freeze the page.
// build.js writes this after the engine into public/js/ai-worker.js (one file, so the worker needs no importScripts and
// no extra request); the engine here is the same code the page and the tests use.
self.onmessage = e => {
  const { id, board, side, level } = e.data;
  self.postMessage({ id, move: RD.chooseMove(Int8Array.from(board), side, level) });
};
