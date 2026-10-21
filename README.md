# Romanian Draughts

A browser game of Romanian Draughts: an all-kings draughts variant, 8 kings a side, where pieces may jump their own men as well as the opponent's and captures are optional. Play two players on one screen, or against the computer (easy, medium, hard).

Full rules: [docs/RULES.md](docs/RULES.md)

## Play

Live: https://romaniandraughts.magicobject.workers.dev/

Locally, open `public/index.html` in any modern browser (self-contained, no server needed), or run it exactly as production serves it, with its security headers, using `npx wrangler dev`.

## Layout

| Path | What it is |
| --- | --- |
| `public/index.html` | The playable game (engine inlined into the page). Generated |
| `public/_headers` | Security headers and CSP, with script hashes filled in. Generated |
| `public/404.html` | The not-found page |
| `wrangler.jsonc` | Cloudflare Worker config (static assets from `public/`) |
| `src/_headers.template` | Source of `public/_headers` |
| `src/engine.js` | Rules engine and computer opponent; works in the browser and Node |
| `src/page.template.html` | The page source, with `/*@ENGINE@*/` where the engine is inlined |
| `test/*.test.js` | Rule, computer-opponent and build tests (`npm test`) |
| `docs/RULES.md` | The rules |

## Rebuild `public/` after editing

```sh
npm run build
```

## Test

```sh
npm test
```

## Engine API (`RD`)

- `initialBoard()` → `Int8Array(64)`, index `row*8+col`; `1` = Dark (rows 6–7, moves first), `-1` = Light, `0` = empty.
- `allMoves(board, side)` → `[{ path: [from, ..., to], caps: [squares] }]`, every step and every jump chain including stops part-way.
- `applyMove(board, move)` → new board.
- `winnerAfter(board, mover)` → winning side or `0`.
- `chooseMove(board, side, 'easy'|'medium'|'hard')` → computer move (iterative-deepening alpha-beta with a time limit).

## Rule decisions in the code

- Captured pieces stay on the board until the turn ends and cannot be jumped twice.
- A jump chain may not land on the same square twice.
- The moving piece's starting square counts as empty during its own chain.

## Ideas

- Online play between two people (shared game state or a small server).
