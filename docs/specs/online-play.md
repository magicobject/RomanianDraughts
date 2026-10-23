# Online play: accounts and invitations (spec)

Status: DRAFT for security-architect review. Nothing here is built. Date: 23 Oct 2026. Owner: Greg Wright. Companion: [online-play-threat-model.md](online-play-threat-model.md).

## 1. Why

Romanian Draughts is a static site: you play the computer, nothing is stored, nobody has an account. Greg wants people to play each other, by invitation, without the site becoming a place where strangers can reach children. Children are expected to be a large share of players, so the design is child-safe by default, not child-safe by policy.

## 2. Who uses it

- **Players, 13 and over**, who sign in with an email address and play friends they invite.
- **Invitees**, who receive a link from a friend, sign in (creating an account if new) and accept.
- **Greg**, as operator: handles reports, suspensions, deletion requests and the privacy duties.
- **Under-13s are not served in v1.** They can still play the computer, anonymously, exactly as today.

## 3. Decisions already made (grilling rounds 1 and 2)

| # | Decision |
|---|---|
| D1 | Sign-in is passwordless: an emailed 6-digit one-time code. No passwords, no social login. |
| D2 | We store as little as possible: a keyed hash of the email (no readable or encrypted address), a generated display name, game history. |
| D3 | 13+ only at launch, by a neutral age question. The ICO Children's Code standards are applied to everyone. Parent-managed or school accounts for under-13s are a separate later project. |
| D4 | Accounts are mandatory for online play, for inviter and invitee. Playing the computer stays anonymous. |
| D5 | Invitations are single-use **links** the inviter shares by their own channel (including their own mail app via `mailto:`). The server never emails an invitee. |
| D6 | No communication between players of any kind: no chat, no presets, no free text. |
| D7 | Display names are rolled **by the server** (adjective + animal + number) and re-rollable within limits. Players never submit a name. |
| D8 | **Correspondence play first**: moves stored in D1, the page polls. No WebSockets, no Durable Objects, no clocks. Live play can follow if wanted. |
| D9 | Games end by capture, blocked side, resign, agreed draw, **threefold repetition**, **50 moves each without a capture**, or 14 days idle (see 5.7). |
| D10 | No ratings, leaderboards, player search, "online now" list, public profiles or stranger matchmaking. History visible only to the two players. |
| D11 | Retention: see section 9. |
| D12 | Email provider: Resend (already used by siteadmin). Data processing agreement and processing region to be confirmed before the DPIA. |
| D13 | Platform: one Cloudflare Worker for `/api/*`, D1 in the EU jurisdiction. Static assets unchanged. |

## 4. Scope

In v1: age screen, sign-in/sign-up, generated name, create/cancel invite links, accept/decline, play a correspondence game, resign/offer draw/accept draw, block and report, account page (history, sign out everywhere, delete account), help pages and privacy notice.

Out of v1: chat of any kind, ratings, spectators, live (real-time) play, server clocks, emailed notifications ("it's your move"), under-13 accounts, changing your email address, server-sent invitation emails, free-text names.

## 5. Behaviour

### 5.1 Age screen
Before any email is asked for, a neutral question: "How old are you?" (choose a number; nothing preselected; the list includes ages under 13; the screen never states the cut-off). 13 or more continues. Under 13 sees a friendly message pointing to play-the-computer. No age or date of birth is stored; the server records only a `declared_13_at` timestamp, and `/complete` refuses to create an account without it. A browser-side flag blocks re-trying with a different answer for 24 hours; it is a speed bump, not age assurance, and the privacy notice says so. The DPIA must record why self-declaration is enough here (no contact between strangers by design).

### 5.2 Sign-in and sign-up (one flow)
1. The player enters an email address. The page responds identically whether or not an account exists: "If that address can sign in, we've emailed a code."
2. The Worker emails a 6-digit code (after the response is sent) and sets a short-lived pre-sign-in cookie that binds the code to this browser.
3. The player enters the code. On success: an existing account gets a new session; a new address proceeds to the generated-name step, then the account and session are created together.
4. The code is single-use, expires in 10 minutes, allows 5 attempts, and issuing a new code cancels the old one.

### 5.3 Display names
Rolled by the server from reviewed adjective and animal lists plus a number, for example "Brave Otter 4821". The player never submits a name: `POST /api/me/reroll-name` takes no body and the server picks. Limits: at most 5 re-rolls per day, and none while the player has an open invite or an active game (so nobody can fish for a particular name, or copy a friend's name mid-conversation). Names are not unique, so a name lookup reveals nothing, but because players cannot choose, an adult cannot deliberately impersonate a child's friend. A name appears only to the opponent in a shared game or invitation, and on the invite preview (5.4).

### 5.4 Invitations (links)
1. A signed-in player presses "Invite a friend". The server creates an invite: 32 random bytes, stored only as a hash, valid 7 days, single-use.
2. The page shows a link of the form `https://romaniandraughts.mediawright.uk/play#i=<token>` (the fragment keeps the token out of server logs and `Referer` headers) and buttons: copy link, share (Web Share API), and "email it" which opens the player's own mail app with fixed wording and the link. The site sends no email.
3. The invitee opens the link. On load the page strips the fragment with `history.replaceState` and holds the token in `sessionStorage`, clearing it after the claim. If not signed in, they go through 5.1 and 5.2 first; the token never goes to the server until they are signed in.
4. **Preview before accept.** `POST /api/invites/preview` (token in the body) returns the inviter's generated name with the words "Only accept if you know who sent this", and never uses the invite up. If either player has blocked the other, or the invite is invalid, it returns the same generic invalid response.
5. The invitee presses Accept; the page sends the token by `POST`. The claim is atomic: first valid claim wins, and the block check is inside the same SQL statement.
6. A game is created with colours assigned at random by the server. The inviter sees who joined (the generated name) and can cancel any unclaimed invite.
7. You cannot claim your own invite. **Blocks are symmetric**: if either player has blocked the other, neither can claim the other's invites.
8. A player may start games with at most 5 new distinct opponents in any 7 days. The server alerts Greg when one account's invites are claimed by many brand-new accounts (a sign of links being posted in a public place).
9. Known weakness, accepted: whoever holds an unclaimed link can claim it. The inviter chooses the channel, sees the joiner's name, and can cancel; the invitee sees who is inviting before accepting.

### 5.5 Blocking and reporting
- **Block** a player from a game, invite preview or invite: symmetric. It cancels pending invites between you, prevents either of you claiming the other's invites, and ends any game between you as aborted (no result).
- **Report** a player: choose a reason from a fixed list (no free text); at most 10 reports a day per reporter. The server records the reporter, the reported player, the game, the reason and time, **plus a copy of the game's moves**, and sends Greg one alert containing opaque ids only. A report survives deletion of either account and is kept 12 months (legitimate interest, recorded in the DPIA). There is no automatic penalty.
- **Suspension** (Greg): `users.suspended_at` is set by a script in the repo with a dry-run mode. The script takes a user id or a **report id**, and works whether or not the account still exists. The single session loader treats a suspended user as signed out and revokes their sessions; suspending also cancels their invites and aborts their games. The address's keyed hash is added to `denied_emails`, which `/complete` checks. Because a reported player could delete their account before Greg acts, **each report stores the reported account's `email_hmac` and `key_ver`** (kept 12 months like the report), and the script takes the hash from the report if the account is gone. Re-sign-up with the same address then gets the generic response and no account. Keyed hashes of addresses are therefore kept after an account is gone in two places only: `denied_emails` and open reports. The legitimate-interest basis for this is recorded in the DPIA.

### 5.6 Playing a game
- Games are correspondence games: a player moves whenever they next visit. The page shows your games and whose turn it is; it polls only while the tab is visible, at a modest interval with back-off.
- The browser builds a move as a path of squares and sends `{gameId, version, path}`. The Worker rebuilds the position by replaying the stored moves with the shared engine, validates the path with `RD.moveFromPath` (which works out the captures itself; the client never supplies them), checks it is that player's turn and that `version` matches, then stores the move. A stale version is rejected and the client resyncs.
- Limits: at most 5 active games per player; a game has at most 2,000 plies (reaching it, which the 50-move rule makes practically impossible at about 1,600, is a draw); request bodies at most 1 KB.
- The server **never calls `allMoves` or `chooseMove`**: `allMoves` explores every jump chain and own-piece jumps make that grow exponentially. It uses `moveFromPath` only, and a test asserts the Worker bundle does not import the others. Repetition and the 50-move count are computed on the server from the stored moves, never from the client; positions compare board plus side to move; a non-capturing own-piece jump counts as a move without a capture and resets nothing. A benchmark replays a worst-case game and must fit the Worker CPU limit.
- Polling: every 15 seconds while the tab is visible, backing off to 2 minutes, stopping after 30 minutes with no change; `GET /api/games` answers "not modified" by game version; about 1 request per 5 seconds per session; polling never counts as activity for the idle rule.

### 5.7 Ending a game
| Outcome | When |
|---|---|
| Win | you capture the opponent's last piece, or the opponent has no legal move (existing rule) |
| Resign | either player, any time |
| Draw by agreement | one offers, the other accepts; an offer lapses when declined or when the offerer moves. **Limits:** an offer can only be made on your own turn, at most one per move, and none after 3 declines in a game, so offers cannot be spammed or used as a signal |
| **Draw by repetition** | the same board with the same side to move occurs for the third time. Automatic. |
| **Draw by 50-move rule** | 50 moves by each player (100 plies) without a capture. Automatic. |
| Idle | no move for 14 days: the idle player forfeits if any move has been made, otherwise the game is aborted. The job updates `WHERE status='active' AND last_move_at=?`, so a move arriving at day 14 cannot race it |

Because every piece is a king, a capture is the only move that cannot be undone, so repetition and the move counter both reset on each capture and only the history since the last capture is needed. Chess's rules are the model; the 50-move figure is a single constant in the engine and is Greg's to tune. Draw rules live in `src/engine.js` and apply to the computer game as well as online play, with the computer's search treating a repeated position as a draw. Each needs tests in `test/rules.test.js` and an update to `docs/RULES.md`. I have not checked whether official Romanian rules say something different.

### 5.8 Account page
History of your games (opponent's generated name, result, date), sign out here, sign out everywhere, delete account (needs a sign-in within the last 10 minutes). Deleting removes the account, sessions and invites; finished games remain for the opponent with the other player shown as "Deleted player"; games in progress end as aborted.

## 6. Architecture

### 6.1 Components
- **Static site** (unchanged): `public/`, with headers from `_headers`. New page `/play` and `js/online.js`.
- **Worker** (`worker/index.js`): runs first only for `/api/*`; everything else falls through to static assets. Imports `src/engine.js` so there is one rules engine.
- **D1** (EU jurisdiction): accounts, sessions, challenges, invites, games, blocks, reports.
- **Rate Limiting binding**: per-IP limits. Availability and plan limits to verify.
- **Mailer**: a plain `fetch` to Resend's HTTP API. No SDK. Faked in tests.

Business logic sits in plain modules that take storage as a parameter (`auth`, `invites`, `game-core`) so they are testable under `node:test` with a fake D1, and could move to a Durable Object later without a rewrite.

### 6.2 Data model (D1)
- `users(id random128 PK, email_hmac UNIQUE, email_key_ver, display_name, declared_13_at, suspended_at, created_at, last_active_at)`
- `denied_emails(email_hmac PK, key_ver, created_at)`: addresses of suspended accounts; checked in `/complete`.
- `sessions(id_hash PK, user_id FK CASCADE, created_at, last_seen_at, shared)`
- `challenges(id_hash PK, email_hmac, code_hmac, attempts, created_at, expires_at)`: purged after 24 hours; per-address limits are counted from these rows.
- `invites(id, from_user FK CASCADE, token_hash UNIQUE, status pending|claimed|cancelled|expired, created_at, expires_at, game_id)`
- `games(id, dark_user, light_user (each FK SET NULL; the other player sees "Deleted player"), version, status, result dark|light|draw|aborted, reason, moves JSON, last_move_at, created_at, finished_at)`; the draw offer is a field on the row.
- `blocks(blocker, blocked)` (a row is removed when the *blocker's* account is deleted; if the blocked party's account goes the block is moot), `reports(id, reporter_ref, reported_ref, reported_email_hmac, reported_key_ver, game_moves_copy, reason_code, created_at)`: `*_ref` are opaque ids kept independently of the `users` rows so the report outlives either account; the reported hash lets suspension work after deletion; purged at 12 months.
- **Never stored:** a readable or encrypted email address, codes in plain, session tokens in plain, IP addresses, user agents, dates of birth, any free text.

`email_hmac = HMAC-SHA256(EMAIL_LOOKUP_KEY, normalise(email))`, with the key version recorded. **Normalisation is pinned:** trim, Unicode NFKC, then ASCII-only lower-casing; addresses over 254 characters, with control characters, or without exactly one `@` are refused. It is hard to change later (every lookup depends on it), so it is tested with fixed vectors. With no recoverable address, sign-up and lookup always compute **every live key version**, so the work is constant and no duplicate account can be created; old-version rows are upgraded when the person next signs in, or deleted after 2 years' inactivity. A leaked key cannot be fixed for existing rows; that is recorded in the DPIA. Access and erasure requests are handled by the person signing in, not by email.

### 6.3 Sessions
Cookie `__Host-rd_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`, 32 random bytes, stored as a hash, replaced at every sign-in. 30 days idle, 90 days total. A "shared computer" choice makes it a browser-session cookie with 2 hours idle and 12 hours total. Every non-GET request must carry an `Origin` that exactly matches the canonical host (`Origin: null` and a missing Origin are refused; there is no `Sec-Fetch-Site` fallback), and `Content-Type: application/json`, with a 1 KB body limit. The static `/play` page must never be served with `Referrer-Policy: no-referrer`, because same-origin `fetch` POSTs would then send `Origin: null` (PCC met this in a real browser); it keeps the site default `strict-origin-when-cross-origin`. A single session loader treats a suspended user as signed out. A code lockout stops new codes only; existing sessions keep working. `*.mediawright.uk` sibling hosts are same-site, so SameSite alone does not protect us; the Origin check and `__Host-` prefix do. The `workers.dev` host is disabled.

### 6.4 API (all JSON)
`POST /api/auth/start`, `/verify`, `/complete`, `/sign-out`, `/sign-out-all` · `GET /api/me`, `POST /api/me/reroll-name` (no body), `DELETE /api/me` · `POST /api/invites`, `GET /api/invites`, `POST /api/invites/:id/cancel`, `POST /api/invites/preview`, `POST /api/invites/claim` · `GET /api/games`, `GET /api/games/:id`, `POST /api/games/:id/move|resign|draw-offer|draw-accept|draw-decline|block|report` · `GET /api/health`.

### 6.4a Rate limits and launch switch
- All `/api`: about 120 requests a minute per IP (from `CF-Connecting-IP` only; IPv6 keyed by /64). `POST /api/auth/start`: about 30 a minute per IP (schools share one address); over the limit it may say "busy, try again in a minute", because an IP limit reveals nothing about an address. Only the per-address limits must look identical to a success.
- Per address: 5 codes an hour; 20 failures a day lock new codes for 24 hours. Per user: 5 invites a day (1 for accounts under 24 hours old with no completed game), 10 open invites, 5 active games, 10 reports a day, 5 name re-rolls a day, 5 new distinct opponents in 7 days. Moves, previews and claims are limited per user and per IP. A global daily send cap is also set at Resend.
- **Launch switch:** until the DPIA, the Ofcom scope record and build steps 4 to 9 are complete, production returns 404 for every `/api/*` route except `/api/health`. Turning the switch on is its own `risk:gnarly` PR.
- Platform settings: `workers_dev: false` and `preview_urls: false`; Workers invocation logs off or verified to hold no IP or request detail; D1 read replication off so revocation and suspension apply at once.

### 6.5 Responses and headers
`_headers` does not apply to Worker responses, so one helper sets, on every response: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security`, `Cross-Origin-Resource-Policy: same-origin`. A test asserts every Worker response carries them. Errors return fixed generic bodies; detail goes only to the error store.

### 6.6 Static site changes
- Self-host the Alegreya fonts so no visitor's IP address goes to Google; remove `fonts.googleapis.com` and `fonts.gstatic.com` from the CSP.
- `connect-src 'self'` already covers same-origin `fetch`. If live play is added later, test `wss:` in WebKit.
- `/play`, `/privacy` added to `test/e2e/pages.js` for axe (light and dark), heading order, and console errors.

## 7. Acceptance criteria

Authentication
1. AC1 `start` returns a byte-identical body and similar timing for a known address, an unknown address and a rate-limited address; no email is sent before the response.
2. AC2 A code works once, expires after 10 minutes, fails after 5 attempts, and a new code cancels the old; the comparison is constant-time and the stored value is an HMAC, not the code.
3. AC3 Codes come from `crypto.getRandomValues` with rejection sampling.
4. AC4 More than 5 codes per address per hour sends nothing and looks identical to the user; 20 failed attempts per address per day locks new codes for that address for 24 hours. More than 30 `start` calls a minute from one IP gets a "busy, try again in a minute" response (an IP limit reveals nothing about an address); only the per-address limits must look identical to success.
5. AC5 The code only verifies in the browser that requested it (pre-sign-in cookie).
6. AC6 Concurrent `verify` calls with one code produce exactly one session.
7. AC7 Every sign-in issues a new session id; sign-out-all revokes all; idle and absolute expiry are enforced at 29/31 and 89/91 days.
8. AC8 Session cookie flags are exactly as in 6.3; non-GET requests with a bad, null or missing Origin get 403.
9. AC9 The age screen precedes the email field; no date of birth or age is stored server-side.

Names and privacy
10. AC10 The server alone chooses names from the word lists, including a new account's first name (no name field in `/complete`); `/api/me/reroll-name` ignores any body, refuses the 6th re-roll in a day, and refuses a re-roll while the player has an open invite or an active game.
11. AC11 A schema test finds no column that can hold a readable email, IP address or free text from a player.
12. AC12 Logs contain only opaque ids and event types: never an email, code, token, cookie, name or full IP.
13. AC13 Deleting an account leaves no D1 row linkable to the user, apart from three named exceptions: games shown as "Deleted player", reports (AC33) and `denied_emails` rows.

Invitations
14. AC14 Opening an invite link does not consume it; only the POST claim does, atomically, once.
15. AC15 Expired, cancelled, already-claimed and self-claimed claims are refused with the same generic response; block handling is defined only in AC31.
16. AC16 At most 5 new invites per day per player (1 for an account under 24 hours old with no completed game), at most 10 open invites, at most 5 active games.
17. AC17 The invite token appears in no server log, `Referer` or error report; the link uses the canonical host, never the request's `Host`.
18. AC18 The server sends no email to anyone except the address that just asked for a sign-in code.

Play
19. AC19 `RD.moveFromPath` accepts every legal chain, including one that `allMoves` would have dropped as a duplicate result, and rejects out-of-range or non-integer squares, paths over 33 squares, mixed step-and-jump paths and repeated landing squares. Captures are always computed by the engine.
20. AC20 An illegal move, a move out of turn, a stale version, or a move by a non-player changes nothing.
21. AC21 Threefold repetition and the 50-move rule end the game as a draw automatically, on both the server and the local computer game; both counters reset on a capture.
22. AC22 Resign, draw offer/accept/decline and the 14-day idle rule behave as in 5.7; every game reaches exactly one final result.
23. AC23 Blocking cancels held invites, prevents new claims and aborts shared games.
24. AC24 Reports accept only a reason from the fixed list.

Platform and quality
25. AC25 Every Worker response carries the headers in 6.5.
26. AC26 The `workers.dev` host serves no API; `not_found_handling: "404-page"` remains guarded by `test/build.test.js`.
27. AC27 No new runtime dependency; `npm run audit` clean.
28. AC28 Playwright against `wrangler dev` plays a full two-browser game, with zero console errors and zero axe violations on every new page, light and dark, including open states.
29. AC29 A dev-only mail sink exists only when `DEV_MAIL_SINK` is set, and a test asserts it is unset in committed config.
30. AC30 Error store and alerting exist before launch (service-project-baseline), including an alert when the daily send budget reaches 50%.

Added after security review round 1
31. AC31 Blocks are symmetric: a claim is refused in both directions, enforced inside the atomic claim SQL. `/api/invites/preview` shows the inviter's name, never consumes the invite, and returns the generic invalid response if either side has blocked the other.
32. AC32 A suspended user's session gets 401 on every route; suspension cancels invites, aborts games and adds the address to `denied_emails`; a denied address gets the generic sign-in response and no account. The suspension script takes a user id or a report id, has a dry-run mode, and works on an already-deleted account. Test: report a player, delete the reported account, run the script with the report id, sign up with the same address, expect the generic response and no account.
33. AC33 One report produces one alert (opaque ids only); a report, its game-moves copy and the reported `email_hmac`/`key_ver` survive deletion of either account for 12 months; a reporter is capped at 10 reports a day.
34. AC34 Draw offers are refused unless it is your turn, once more than one is made in a move, and after 3 declines **of that player's offers** in a game (counted per offerer), each with no change to the game.
35. AC35 Idle forfeit uses `WHERE status='active' AND last_move_at=?`; a move and the job racing at day 14 give exactly one outcome; polling never counts as activity.
36. AC36 Worker tests replace `allMoves` and `chooseMove` with stubs that throw, so any server-side call fails the test (the Worker imports the whole of `src/engine.js`, so an import check would not work); a benchmark of a worst-case game replay fits the Worker CPU limit; reaching 2,000 plies is a draw.
37. AC37 Repetition and the 50-move count are computed server-side from stored moves; a non-capturing own-piece jump resets neither.
38. AC38 The IP used for limits comes from `CF-Connecting-IP` only, IPv6 grouped by /64; requests with a content type other than JSON, or a body over 1 KB, are refused; errors are fixed generic bodies.
39. AC39 Account deletion requires a sign-in within the last 10 minutes; a shared-computer session expires at 2 hours idle or 12 hours total.
40. AC40 The CSP names no third-party origin (fonts are self-hosted), and a test fails if any secret-like variable appears in `wrangler.jsonc`.
41. AC41 A config test asserts `preview_urls` and `workers_dev` are both false, invocation logs are off in `observability`, and D1 read replication is off.
42. AC42 The `/play` page strips the invite fragment on load, keeps the token in `sessionStorage`, clears it after the claim, and is not served with `Referrer-Policy: no-referrer`.
43. AC43 A player cannot start games with more than 5 new distinct opponents in 7 days; an alert fires when 5 or more accounts under 7 days old claim invites from one account within 24 hours.
44. AC44 Until the launch switch is on, production returns 404 for every `/api/*` route except `/api/health`; the test reads the committed config, and any local override for `wrangler dev` is not the committed default.
45. AC45 The 24-hour purge of codes and unfinished sign-ups runs from the day sign-in ships; `/complete` refuses an account without `declared_13_at`.
46. AC46 The computer game's Web Worker receives the game history, and all existing AI tests still pass with the draw rules.

## 8. Security rules (mandatory controls; full table in the threat model)
- All secrets are Worker secrets, separate per environment, never in the repo, `wrangler.jsonc`, prompts or logs. Tests use fakes.
- Keys: `EMAIL_LOOKUP_KEY`, `CODE_HMAC_KEY`, `RESEND_API_KEY` (send-only, limited to the sending domain, rotated yearly).
- The browser is never trusted: moves, versions, Origin, Host and every body are checked server-side.
- No player directory, search, online list, public profile or matchmaking, ever, without a fresh security and child-safety review.
- No third-party script, font, tracker or embed.
- Sending domain has SPF, DKIM and DMARC (`p=reject`). These DNS records and Cloudflare billing alerts are Greg's to make.

## 9. Data protection and retention
| Data | Kept |
|---|---|
| Codes and unfinished sign-ups | 24 hours |
| Invite links | 7 days to expiry, then deleted |
| Games in progress, idle | forfeited or aborted at 14 days |
| Finished games | 12 months |
| Accounts inactive | 2 years, deleted **without a warning** (we hold no address to warn; the privacy notice says so) |
| Report records (with moves copy and reported address hash) | 12 months |
| `denied_emails` (suspended accounts' address hashes) | reviewed at 2 years; kept only while the reason still applies, stated in the DPIA |

Lawful basis: contract (providing the game the player signed up for), not consent; the DPIA must record this. D1 backups (Time Travel) may hold deleted data for a short period (to verify); the privacy notice says so. Deliverables before launch: a DPIA, a Children's Code assessment, Ofcom "does the Online Safety Act apply" result recorded in writing, a child-readable privacy notice, and a short legal check on the points the research could not confirm.

## 10. Build order (each a PR; B = `risk:gnarly`, Greg merges)
1. Self-host fonts and tighten the CSP. Simple.
2. Engine: `RD.moveFromPath`, draw outcome, repetition and 50-move rules, tests, `RULES.md`. Complex.
3. DPIA, Children's Code assessment, privacy notice, Ofcom scope record. Docs.
4. B Worker skeleton: config, `/api/health`, header helper, Origin check, `workers_dev` and `preview_urls` off, Workers logs settings, proof the rate-limit binding works, error store and alerts, and the **launch switch** (404 for all other `/api/*`).
5. B D1 migrations (including `suspended_at`, `declared_13_at`, `denied_emails`, report-survival), crypto module, fake D1 and recording mailer for tests.
6. B Sign-in, age screen and `declared_13_at`, server-rolled names, `/play` shell, and the 24-hour purge of codes and unfinished sign-ups.
7. B Invite links, symmetric blocks, preview, reports with alerts, and the suspension script.
8. B Correspondence games, with the race-safe idle job and the CPU benchmark.
9. B Account page, deletion, retention job.
10. B Turn the launch switch on, once the DPIA and the Ofcom scope record are done. Its own PR.
Each of 4 to 9 gets `security-architect` before it starts and `security-engineer` before release; `tester` and `ux-designer` on the player-facing pages.

## 11. Compromises we are accepting
- **Email is the only identity.** Whoever controls the inbox controls the account; school mail filters may block codes; children without an address will use a parent's; there is no change-of-address flow.
- **A shared link can be claimed by the wrong person.** Mitigated by cancel, seeing the joiner, single use.
- **Engine-assisted cheating cannot be stopped** (the strong computer player ships in the browser). Acceptable with friends-only play and no ratings.
- **No notifications.** Without a stored address we cannot say "your move". Players must return. Revisit only with a new privacy decision.
- **Polling costs requests** against free-tier limits (to verify). It is the price of not running a stateful game server.
- **Cloudflare lock-in.** D1 and the Worker are Cloudflare-only. Logic is in plain modules to keep the exit cost to a thin shell.
- **Hard to change later:** email normalisation and lookup key; the EU jurisdiction; email as identity; the 13+ model; generated names; the stored-move format.
- **Code-guessing lockout can be abused** to lock someone out of new sign-in codes for a day (existing sessions keep working).
- **Covert signalling through moves** between two people who already have another channel cannot be prevented; accepted.
- **A leaked lookup key cannot be repaired** for existing rows (see 6.2); recorded in the DPIA.
- **Public links:** an adult could post invite links in a children's community; limited by the distinct-opponent cap and an alert, not eliminated.

## 12. Open questions
- O1 Resend: processing region and DPA terms (confirm before the DPIA).
- O2 Whether to pay for a short legal check on neutral-invite status, the Data (Use and Access) Act 2025 changes, and display names under the Online Safety Act.
- O3 (answered by security review) v1 suspension is a repo script with a dry-run mode and reports arrive as an alert; a small admin page would need its own security review and is out of v1.
- O4 Whether the 50-move figure and repetition count match any official Romanian rules.
- O5 Word lists for generated names: who reviews them.
- O6 Whether to offer opt-in "your move" emails later (needs a stored address, which reverses D2).
