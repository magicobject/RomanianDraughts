# Changelog

## build-2026.10.21.001 (21 Oct 2026, Greg Wright)
Added the standard repo setup and a proper test suite. 58 tests now cover the starting position, steps, jumps (own and enemy pieces, chains, optional capture, no double captures or landings), `applyMove`, win detection, the computer opponent at all three levels, a self-play game, and a check that [index.html](index.html) matches what `build.js` produces. Added [package.json](package.json) (`npm test`, `npm run build`, `npm run audit`), a pre-push hook that runs tests and audit, [.gitattributes](.gitattributes) pinning LF, [CLAUDE.md](CLAUDE.md), and this changelog. Replaced the old single-file `test/engine.test.js`.

## build-2026.10.21.000 (21 Oct 2026, Greg Wright)
First commit: engine, game page, rules and the original test script.
