// Web Worker for the computer's search, so Hard does not freeze the page.
// build.js writes this after the engine into public/js/ai-worker.js (one file, so the worker needs no importScripts and
// no extra request); the engine here is the same code the page and the tests use.
self.onmessage = e => {
  const { id, board, side, level } = e.data;
  self.postMessage({ id, move: RD.chooseMove(Int8Array.from(board), side, level) });
};
