# Romanian Draughts

A browser game of Romanian Draughts: an all-kings draughts variant, 8 kings a side, where pieces may jump their own men as well as the opponent's and captures are optional. Play two players on one screen, or against the computer (easy, medium, hard).

Full rules: [docs/RULES.md](docs/RULES.md)

## Play

Live: https://romaniandraughts.mediawright.uk/ (a MediaWright site). Help for players: /help. Build history: /updates.

Run it exactly as production serves it, with its security headers, using `npx wrangler dev` (after `npm install` and `npm run build`).

## Layout

| Path | What it is |
| --- | --- |
| `public/index.html`, `help.html`, `updates.html`, `404.html` | The pages. Generated |
| `public/css/style.css`, `public/js/engine.js`, `public/js/game.js` | Styles and scripts, copied from `src/`. Generated |
| `public/sitemap.xml`, `public/_headers` | Sitemap and security headers (CSP). Generated |
| `public/robots.txt`, `public/.well-known/security.txt` | Hand-written. Renew security.txt's `Expires` yearly |
| `public/favicon*`, `public/apple-touch-icon.png` | From `scripts/generate-favicons.js` |
| `wrangler.jsonc` | Cloudflare Worker config (static assets from `public/`) |
| `src/engine.js` | Rules engine and computer opponent; works in the browser and Node |
| `src/game.js`, `src/style.css`, `src/page.template.html` | The game's script, styles and page body |
| `src/shell.html`, `src/pages/` | The shared page shell (head, footer) and the other pages' bodies |
| `changelog.md`, `build-number.json` | The build history shown on /updates |
| `test/*.test.js` | Rule, computer-opponent, build and site tests (`npm test`) |
| `test/e2e/` | Browser tests: real clicks, accessibility, headers (`npm run test:e2e`) |
| `docs/RULES.md` | The rules |

## Rebuild `public/` after editing

```sh
npm run build
```

## Test

```sh
npm test            # rules, computer opponent, build output, site files (fast)
npm run test:e2e    # real browser against wrangler dev: clicks, accessibility, headers (needs: npx playwright install chromium)
npm run audit
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
