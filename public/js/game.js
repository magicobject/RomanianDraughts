(() => {
  const $ = id => document.getElementById(id);
  const NAME = { 1: 'Dark', '-1': 'Light' };
  const sqName = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));

  let S; // game state
  function fresh(settings) {
    return {
      settings: settings || { mode: 'ai', you: 1, level: 'medium' },
      history: [], // {board:Array, side, notation, last:[from,to]}
      board: Array.from(RD.initialBoard()),
      side: 1,
      winner: 0, winText: '',
      last: null,
    };
  }
  let sel = null;   // {from, cur, path, caps}
  let busy = false; // computer thinking or animating
  let gen = 0;      // bumped by every new game, so a computer move from an old game is dropped
  let anim = null;  // {board, at} temporary display

  const B = () => Int8Array.from(S.board);
  const isAITurn = () => S.settings.mode === 'ai' && S.side !== S.settings.you && !S.winner;
  const flipped = () => S.settings.mode === 'ai' && S.settings.you === -1;

  // ---------- Board rendering ----------
  const boardEl = $('board');
  const cells = [];
  for (let k = 0; k < 64; k++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq';
    btn.addEventListener('click', () => onSquare(Number(btn.dataset.i)));
    boardEl.appendChild(btn);
    cells.push(btn);
  }

  function pieceEl(p, extra) {
    const d = document.createElement('span');
    d.className = 'piece ' + (p === 1 ? 'd' : 'l') + (extra ? ' ' + extra : '');
    d.innerHTML = '<svg aria-hidden="true"><use href="#star"/></svg>';
    return d;
  }

  function targets() {
    if (!sel) return [];
    const b = B(), out = [];
    if (sel.path.length === 1) for (const t of RD.stepTargets(b, sel.from)) out.push({ to: t, kind: 'step' });
    for (const j of RD.jumpTargets(b, sel.from, sel.cur, sel.caps, sel.path))
      out.push({ to: j.to, over: j.over, kind: b[j.over] === -S.side ? 'cap' : 'hop' });
    return out;
  }

  function render() {
    const fl = flipped();
    $('files').innerHTML = [...'abcdefgh'].map((f, i) => `<span>${fl ? 'hgfedcba'[i] : f}</span>`).join('');
    $('ranks').innerHTML = [...Array(8)].map((_, i) => `<span>${fl ? i + 1 : 8 - i}</span>`).join('');

    let disp = S.board.slice();
    let ghosts = [], selAt = -1;
    if (anim) { disp = anim.board; selAt = anim.at; ghosts = anim.ghosts || []; }
    else if (sel) {
      disp[sel.from] = 0; disp[sel.cur] = S.side; selAt = sel.cur; ghosts = sel.caps;
    }
    const tg = anim ? [] : targets();
    const yourTurn = !busy && !S.winner && !isAITurn();

    for (let k = 0; k < 64; k++) {
      const i = fl ? 63 - k : k;
      const r = i >> 3, c = i & 7, btn = cells[k];
      btn.dataset.i = i;
      const dark = (r + c) % 2 === 1;
      btn.className = 'sq' + (dark ? ' dark' : '') + (S.last && !sel && !anim && S.last.includes(i) ? ' last' : '');
      btn.disabled = !dark || !yourTurn;
      btn.tabIndex = dark ? 0 : -1;
      btn.innerHTML = '';
      const p = disp[i];
      let label = sqName(i);
      if (p) {
        btn.appendChild(pieceEl(p, (i === selAt ? 'sel' : '') + (ghosts.includes(i) ? ' ghost' : '')));
        label += ', ' + NAME[p] + ' king' + (ghosts.includes(i) ? ', captured' : '');
      }
      const t = tg.find(x => x.to === i);
      if (t) {
        const m = document.createElement('span');
        m.className = 'mark ' + t.kind;
        btn.appendChild(m);
        label += t.kind === 'cap' ? ', capture here' : t.kind === 'hop' ? ', jump here' : ', step here';
      }
      if (dark) { btn.setAttribute('aria-label', label); btn.removeAttribute('aria-hidden'); }
      else { btn.removeAttribute('aria-label'); btn.setAttribute('aria-hidden', 'true'); } // unplayable squares are not announced
    }

    // status
    const st = $('status'), hint = $('hint');
    st.classList.toggle('win', !!S.winner);
    if (S.winner) {
      st.innerHTML = `<span class="swatch ${S.winner === 1 ? 'd' : 'l'}"></span>${NAME[S.winner]} wins`;
      hint.textContent = S.winText;
    } else {
      const who = S.settings.mode === 'ai' ? (S.side === S.settings.you ? 'Your move' : 'Computer is thinking…') : `${NAME[S.side]} to move`;
      st.innerHTML = `<span class="swatch ${S.side === 1 ? 'd' : 'l'}"></span>${who}`;
      if (isAITurn()) hint.textContent = `The computer plays ${NAME[S.side]}.`;
      else if (sel && sel.path.length > 1) {
        const more = tg.length;
        hint.textContent = (sel.caps.length ? `${sel.caps.length} piece${sel.caps.length > 1 ? 's' : ''} taken so far. ` : '') +
          (more ? 'Jump again, or finish the move here.' : 'No further jumps.');
      } else if (sel) hint.textContent = 'Choose a square to step or jump to, or pick another piece.';
      else hint.textContent = `Select a ${NAME[S.side]} piece.`;
    }
    $('chainBtns').hidden = !(sel && sel.path.length > 1);

    // controls
    const m = S.settings.mode;
    $('modeHuman').setAttribute('aria-pressed', m === 'human');
    $('modeAI').setAttribute('aria-pressed', m === 'ai');
    $('aiOpts').hidden = m !== 'ai';
    $('youDark').setAttribute('aria-pressed', S.settings.you === 1);
    $('youLight').setAttribute('aria-pressed', S.settings.you === -1);
    for (const [id, lv] of [['lvlEasy', 'easy'], ['lvlMed', 'medium'], ['lvlHard', 'hard']]) $(id).setAttribute('aria-pressed', S.settings.level === lv);
    $('undoBtn').disabled = busy || undoTarget() === null; // index 0 (the first move) is a valid target

    // tally
    const cD = S.board.filter(x => x === 1).length, cL = S.board.filter(x => x === -1).length;
    $('pipsD').innerHTML = [...Array(8)].map((_, i) => `<i class="${i < cD ? '' : 'gone'}"></i>`).join('');
    $('pipsL').innerHTML = [...Array(8)].map((_, i) => `<i class="${i < cL ? '' : 'gone'}"></i>`).join('');
    $('cntD').textContent = `Dark ${cD}`;
    $('cntL').textContent = `Light ${cL}`;

    // log
    const log = $('log');
    if (!S.history.length) log.innerHTML = '<li><span class="empty" style="grid-column:1/-1">No moves yet. Dark moves first.</span></li>';
    else {
      let html = '';
      for (let i = 0; i < S.history.length; i += 2) {
        const a = S.history[i], b = S.history[i + 1];
        html += `<li><span class="n">${i / 2 + 1}.</span><span>${a.notation}</span><span>${b ? b.notation : ''}</span></li>`;
      }
      log.innerHTML = html;
      log.scrollTop = log.scrollHeight;
    }
  }

  // ---------- Moves ----------
  function notation(b, m) {
    if (m.caps.length === 0 && m.path.length === 2 && Math.abs((m.path[1] >> 3) - (m.path[0] >> 3)) === 1) return sqName(m.path[0]) + '–' + sqName(m.path[1]);
    let s = sqName(m.path[0]);
    for (let k = 1; k < m.path.length; k++) {
      const over = (m.path[k] + m.path[k - 1]) / 2;
      s += (m.caps.includes(over) ? '×' : '–') + sqName(m.path[k]);
    }
    return s;
  }

  function commit(m) {
    const b = B();
    S.history.push({ board: S.board.slice(), side: S.side, notation: notation(b, m), last: S.last });
    const nb = RD.applyMove(b, m);
    S.board = Array.from(nb);
    S.last = [m.path[0], m.path[m.path.length - 1]];
    const w = RD.winnerAfter(nb, S.side);
    if (w) {
      S.winner = w;
      S.winText = RD.count(nb, -S.side) === 0
        ? `${NAME[w]} took ${NAME[-w]}'s last piece.`
        : `${NAME[-w]} has no legal move.`;
    } else S.side = -S.side;
    sel = null;
    render();
    maybeAI();
  }

  function onSquare(i) {
    if (busy || S.winner || isAITurn()) return;
    const b = B();
    if (!sel) {
      if (b[i] === S.side) { sel = { from: i, cur: i, path: [i], caps: [] }; render(); }
      return;
    }
    const t = targets().find(x => x.to === i);
    if (t) {
      if (t.kind === 'step') { commit({ path: [sel.from, i], caps: [] }); return; }
      sel.path.push(i);
      sel.cur = i;
      if (t.kind === 'cap') sel.caps.push(t.over);
      if (RD.jumpTargets(b, sel.from, sel.cur, sel.caps, sel.path).length === 0) { commit({ path: sel.path, caps: sel.caps }); return; }
      render();
      return;
    }
    if (sel.path.length > 1) {
      if (i === sel.cur) commit({ path: sel.path, caps: sel.caps });
      return;
    }
    if (i === sel.from) sel = null;
    else if (b[i] === S.side) sel = { from: i, cur: i, path: [i], caps: [] };
    else sel = null;
    render();
  }

  $('finishBtn').addEventListener('click', () => { if (sel && sel.path.length > 1) commit({ path: sel.path, caps: sel.caps }); });
  $('cancelBtn').addEventListener('click', () => { sel = null; render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel && !busy) { sel = null; render(); } });

  // ---------- Computer ----------
  const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  function maybeAI() {
    if (!isAITurn()) return;
    busy = true; render();
    const side = S.side, token = S.history.length, myGen = gen;
    setTimeout(() => {
      if (gen !== myGen) return;
      const m = RD.chooseMove(B(), side, S.settings.level);
      if (!m || S.history.length !== token) { busy = false; render(); return; }
      // animate hop by hop
      const base = S.board.slice();
      let k = 0;
      const stepAnim = () => {
        if (gen !== myGen) return;
        k++;
        const b2 = base.slice();
        b2[m.path[0]] = 0; b2[m.path[k]] = side;
        const ghosts = [];
        for (let j = 1; j <= k; j++) { const over = (m.path[j] + m.path[j - 1]) / 2; if (m.caps.includes(over)) ghosts.push(over); }
        anim = { board: b2, at: m.path[k], ghosts };
        render();
        if (k < m.path.length - 1) setTimeout(stepAnim, reduced ? 60 : 380);
        else setTimeout(() => { if (gen !== myGen) return; anim = null; busy = false; commit(m); }, reduced ? 60 : 380);
      };
      stepAnim();
    }, 300);
  }

  // ---------- Controls ----------
  function undoTarget() {
    if (S.settings.mode !== 'ai') return S.history.length ? S.history.length - 1 : null;
    for (let i = S.history.length - 1; i >= 0; i--) if (S.history[i].side === S.settings.you) return i;
    return null;
  }
  $('undoBtn').addEventListener('click', () => {
    if (busy) return;
    if (sel) { sel = null; }
    const t = undoTarget();
    if (t === null) return;
    const h = S.history[t];
    S.board = h.board; S.side = h.side; S.last = h.last;
    S.history = S.history.slice(0, t);
    S.winner = 0; S.winText = '';
    render();
  });
  function newGame(settings) { gen++; S = fresh(settings); sel = null; anim = null; busy = false; render(); maybeAI(); }
  $('newBtn').addEventListener('click', () => newGame({ ...S.settings }));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (S.settings.mode === b.dataset.mode) return;
    newGame({ ...S.settings, mode: b.dataset.mode });
  }));
  document.querySelectorAll('[data-you]').forEach(b => b.addEventListener('click', () => {
    const you = Number(b.dataset.you);
    if (S.settings.you === you) return;
    newGame({ ...S.settings, you });
  }));
  document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => {
    S.settings.level = b.dataset.level; render();
  }));

  // ---------- Start ----------
  S = fresh();
  render();
  maybeAI();
})();
