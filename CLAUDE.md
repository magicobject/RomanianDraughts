# Romanian Draughts — repo rules

Binding for every session. The global rules in `~/.claude/CLAUDE.md` also apply.

## What this is
An online Romanian Draughts game (8 kings a side, own-piece jumps allowed, captures optional). Rules: `docs/RULES.md`. Live: `romaniandraughts.mediawright.uk` (Cloudflare Worker, set up by Greg; also `romaniandraughts.magicobject.workers.dev`). A MediaWright site: keep the footer mark, `/help`, `/updates`, favicons, sitemap, robots and security.txt current.

## Layout
- `src/engine.js` — rules engine and AI. Works in Node and the browser. The one source of truth for the rules.
- `src/game.js`, `src/style.css`, `src/page.template.html` — the game's script, styles and page body. `src/shell.html` is the shared page shell (head, favicons, footer, scripts) and `src/pages/*.html` are the other pages' bodies (`help`, `404`).
- `changelog.md` feeds `/updates`; `build-number.json` is the current build. The build number appears on `/updates` only.
- `build.js` generates into `public/`: `index.html`, `help.html`, `updates.html`, `404.html`, `sitemap.xml`, `_headers`, `css/style.css`, `js/engine.js`, `js/game.js`. Never hand-edit those; edit the source and `npm run build`. Pages link css/js with a content-hash `?v=` the build writes.
- Hand-written in `public/`: `robots.txt`, `.well-known/security.txt` (renew its `Expires` before it lapses; a test fails with under 60 days left). The favicon files come from `scripts/generate-favicons.js` (hand-run, results committed).
- `wrangler.jsonc` — Worker config. Keep `not_found_handling: "404-page"` and `directory: ./public` (guarded by `test/build.test.js`).
- The CSP is `script-src 'self'` only: no inline scripts, no per-script hashes. Put code in `src/game.js`/`src/engine.js`, never in a `<script>` in a page. Every page needs `<meta charset="utf-8">` early (a missing one once made the browser misread the script and the CSP blocked it: a dead page). `style-src` allows `unsafe-inline` because the page uses inline `style=` attributes.
- `test/*.test.js` — `node:test` suites (`rules`, `ai`, `build`, `site`). Shared helpers in `test/support/`.
- `test/e2e/*.spec.js` — Playwright (`npm run test:e2e`), run against `wrangler dev` so the real `_headers` apply: real clicks, axe on every page in light and dark, heading order, headers, 404. New pages go in `test/e2e/pages.js`. Every spec fails on any console error (that is how a CSP block shows).
- Footer on every page: "A MediaWright site", with links to Help, Site updates and the security policy. Keep it in `src/shell.html`.

## Before every push
1. `npm run build` (the build test fails if `public/` is stale).
2. `npm test`, `npm run test:e2e` and `npm run audit` — all must pass (CI re-runs only `npm test` and the audit; the browser suite runs locally in the pre-push hook). The pre-push hook (`.githooks/pre-push`, enabled by `npm install` via `prepare`) runs them.
3. Report "RomanianDraughts: N tests passed in Xs" for each suite.

## Every commit
- Add a `changelog.md` entry (newest first, author from `users.json` via `gh api user --jq .login`), then tag `build-<YYYY.MM.DD>.<NNN>` matching the entry and push the tag. `build-number.json` holds the current date and counter.
- Any rule change needs a test in `test/rules.test.js` and an update to `docs/RULES.md`.

## Rules for online play (when added)
- The server is authoritative: validate every move with `RD.allMoves`, never trust the client.
- No third-party script/font/embed without adding exactly what it needs to the CSP in `_headers` and checking with `npx wrangler dev`.
- Keep `.gitattributes` pinning text to LF.

## Branch and PR workflow
- Never commit to `main` directly. Work on a `claude/*` branch and open a PR.
- `.github/workflows/claude-pr-automerge.yml` re-runs `npm test` and `npm run audit` on the PR head. `AUTO_MERGE_LEVEL` is `careful`: only a green PR labelled `risk:simple` merges itself; everything else waits for Greg.
- Label every PR `risk:simple` (docs, changelog, tests-only, single concern), `risk:complex` or `risk:gnarly` (never auto-merges; Greg is asked by name). Unlabelled counts as complex.
- Tags (`build-<date>.<NNN>`) are pushed after the merge, on the merge commit.
