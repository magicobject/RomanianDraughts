# Changelog

## build-2026.10.22.002 (22 Oct 2026, Greg Wright)
Fixed the live game not responding to clicks, and brought the site up to the standard MediaWright setup.

**Cause:** the page had no `<meta charset>`, so the browser misread the game script, its Content-Security-Policy hash stopped matching, and the browser blocked the script: the board stayed empty. The page is now a proper document (doctype, language, charset, viewport) and the scripts and styles are separate files (`/js/engine.js`, `/js/game.js`, `/css/style.css`, each with a content hash in its address), so the CSP is now just `script-src 'self'` with no per-script hashes to go stale.

**Also fixed while testing in a real browser:** the board squares grew to 150px and covered the controls once the page was in standards mode (grid tracks are now `minmax(0, 1fr)`); the pieces were stretched into ovals for the same reason (they are now sized with `aspect-ratio`); Undo stayed greyed out after the first move; the 32 unplayable light squares were unlabelled buttons and the board used a `grid` role without rows (axe now finds no violations). An independent test pass then found and we fixed: Finish move/Cancel and the computer options were always showing (the `hidden` attribute was being overridden by CSS); starting a new game, or switching mode, while the computer was moving let its old move land in the new game; the "wins" heading and the keyboard focus rings were too low-contrast (now computed and pinned by a test); the Rules summary was under the 24px minimum target; and with JavaScript off the page now says the game needs it. Escape now cancels a selected piece.

**New:** a footer on every page marking it as a MediaWright site, with links to [Help](help.html) and [Site updates](updates.html); a plain-English [help page](help.html); this [updates page](updates.html), generated from `changelog.md`; a styled [404 page](404.html); favicons (SVG, PNG, Apple touch icon and `favicon.ico`, made by `scripts/generate-favicons.js`); `sitemap.xml`, `robots.txt` and `/.well-known/security.txt`; page descriptions, canonical addresses and social tags.

**Tests:** `npm run test:e2e` runs Playwright against `wrangler dev` (real clicks under the production CSP, axe scans of every page in light and dark mode and with a piece selected, heading order, security headers, 404, sitemap, robots, security.txt), and the Node tests now also check the page shell, sitemap, security.txt expiry and that `/updates` matches this changelog. The game is on [the play page](index.html).

## build-2026.10.22.001 (22 Oct 2026, Greg Wright)
Fixed the PR gate's clone step in [claude-pr-automerge.yml](.github/workflows/claude-pr-automerge.yml). It sent a `bearer` header, which GitHub rejects for git over HTTPS (`could not read Username`), so the gate failed before running any tests on both earlier PRs. It now sends Basic auth with `x-access-token`, the same as `actions/checkout`, and masks the encoded value in the log.

## build-2026.10.21.003 (21 Oct 2026, Greg Wright)
Added the Cloudflare Worker config. [wrangler.jsonc](wrangler.jsonc) serves only `public/` (worker name `romaniandraughts`, `not_found_handling: "404-page"`). The build now writes `public/index.html` and [public/_headers](public/_headers) (CSP with a hash for each inline script, plus nosniff, frame, referrer, permissions and HSTS headers) and there is a [public/404.html](public/404.html). The old root `index.html` is gone. Tests grew to 69, covering the CSP hashes, the config and the 404 guard. Checked under `wrangler dev`: correct headers, custom 404, no CSP errors in the console (only a missing favicon).

## build-2026.10.21.002 (21 Oct 2026, Greg Wright)
Added the branch-and-PR workflow: [claude-pr-automerge.yml](.github/workflows/claude-pr-automerge.yml) re-runs the tests and audit on every `claude/*` PR, set to the cautious `careful` level so only green `risk:simple` PRs merge themselves. Documented in [CLAUDE.md](CLAUDE.md).

## build-2026.10.21.001 (21 Oct 2026, Greg Wright)
Added the standard repo setup and a proper test suite. 58 tests now cover the starting position, steps, jumps (own and enemy pieces, chains, optional capture, no double captures or landings), `applyMove`, win detection, the computer opponent at all three levels, a self-play game, and a check that [index.html](index.html) matches what `build.js` produces. Added [package.json](package.json) (`npm test`, `npm run build`, `npm run audit`), a pre-push hook that runs tests and audit, [.gitattributes](.gitattributes) pinning LF, [CLAUDE.md](CLAUDE.md), and this changelog. Replaced the old single-file `test/engine.test.js`.

## build-2026.10.21.000 (21 Oct 2026, Greg Wright)
First commit: engine, game page, rules and the original test script.
