# Romanian Draughts — repo rules

Binding for every session. The global rules in `~/.claude/CLAUDE.md` also apply.

## What this is
An online Romanian Draughts game (8 kings a side, own-piece jumps allowed, captures optional). Rules: `docs/RULES.md`. Live target: `romaniandraughts.magicobject.workers.dev` (Cloudflare Worker, set up by Greg).

## Layout
- `src/engine.js` — rules engine and AI. Works in Node and the browser. The one source of truth for the rules.
- `src/page.template.html` — page source. `node build.js` inlines the engine into `index.html`.
- `index.html` — GENERATED. Never hand-edit; edit the source and run `npm run build`.
- `test/*.test.js` — `node:test` suites (`rules`, `ai`, `build`). Shared helpers in `test/support/`.

## Before every push
1. `npm run build` (the build test fails if `index.html` is stale).
2. `npm test` and `npm run audit` — both must pass. The pre-push hook (`.githooks/pre-push`, enabled by `npm install` via `prepare`) runs them.
3. Report "RomanianDraughts: N tests passed in Xs".

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
