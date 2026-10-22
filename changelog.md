# Changelog

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
