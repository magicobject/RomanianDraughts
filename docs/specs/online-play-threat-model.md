# Online play: threat model

Status: DRAFT for security-architect review. Companion to [online-play.md](online-play.md). Date: 23 Oct 2026.

## 1. Assets
Email addresses (as keyed hashes only), sessions, one-time codes, the lookup and code HMAC keys, the Resend API key, display names, game history (a pattern of who plays whom and when), the sending domain's reputation, Cloudflare and Resend spend, and children's safety.

## 2. Actors
Anonymous visitor · signed-in player (sign-up is free, so treated as anonymous) · adult targeting children · griefer · spammer · code brute-forcer · cheater with a modified client · scraper · compromised dependency · someone with repo write access · operator error (Greg).

## 3. Trust boundaries
- Browser → Worker: everything from the client is untrusted (body, Origin, Host, cookies, timing).
- Worker → D1 and → Resend: Resend is a data processor.
- The inbox: whoever reads it is the account owner.
- Sibling hosts under `*.mediawright.uk` are same-site; `romaniandraughts.magicobject.workers.dev` is another origin and must serve no API.
- Static assets (headers from `_headers`) vs Worker responses (headers must be set in code).

## 4. Threats and mitigations

Severity is before mitigation. Residual is after.

| ID | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | **Code brute force** (High). Attacker knows an address and guesses 6 digits | `getRandomValues` with rejection sampling; code stored as HMAC; 10-minute expiry; 5 attempts; single use, atomic redeem; new code cancels old; 20 failures/address/day locks 24h; code bound to requesting browser by cookie | About 25 in a million per address per hour. Accepted |
| T2 | **Account enumeration** (Medium) via sign-in, invite or timing | One sign-in/sign-up form; identical bodies; send after response; no invite-by-address; random ids; names not unique | Timing tested, not proven. Accepted |
| T3 | **Mail bombing and quota exhaustion** (High). Victim's address entered repeatedly; provider suspends us | Per-IP 30/min on `start` (IPv6 by /64; a "busy" message is fine, an IP limit reveals nothing about an address); 5 codes/address/hour with an identical response; global daily cap, also set at Resend; alert at 50% | A determined actor with many IPs can still use the quota. Accepted, alerted |
| T4 | **Server as a mail relay** (was High under email invites) | The server emails only the address that asked for a code. Invites are links shared by the player's own channel | None for the server. A player can still send a link to a stranger by their own means |
| T5 | **Invite link misuse** (Medium). Forwarded or leaked link claimed by the wrong person | 32 random bytes, hash stored; 7 days; single use; claimed by POST not GET; fragment keeps token out of logs and `Referer`; canonical host only; inviter sees joiner, can cancel; caps 5/day and 10 open | Wrong person can claim a leaked link. Accepted |
| T6 | **Session theft or fixation** (High) | `__Host-` cookie, HttpOnly, Secure, SameSite=Lax; hashed ids; new id at sign-in; 30/90 day expiry; sign out everywhere; CSP `script-src 'self'` | Malware on the device. Out of scope |
| T7 | **CSRF** (High) | Exact Origin check on all non-GET; null/missing refused; JSON content type only; no CORS | Same-site sibling host can still send a request with the right Origin only if it can forge Origin, which browsers prevent |
| T8 | **Sibling-subdomain abuse** (Medium). Another `*.mediawright.uk` site is same-site | `__Host-` prefix (no Domain attribute); exact Origin match; never set cookies on the parent domain | A compromised sibling site could read nothing of ours, but could make same-site top-level navigations. Accepted |
| T9 | **Adult targeting a child** (High) | No chat, search, directory, online list, public profile or matchmaking; generated names; invite only by link someone chose to share; block and report one tap away; history visible only to the two players | A predator who already knows the child and shares a link. Cannot be removed by design |
| T10 | **Offensive or identifying names** (Medium) | Names rolled by the server from reviewed lists; players never submit a name | List quality (O5) |
| T11 | **Cheating** (Low without ratings) | Server validates every move with the engine; the server replays state, never trusts client state | Engine assistance cannot be prevented. Accepted |
| T12 | **Move injection and engine DoS** (Medium) | `RD.moveFromPath` with strict shape checks before the engine is called (integers 0-63, ≤33 squares, ≤1 KB); `chooseMove` never runs server-side; version check; 2,000-ply cap | None known |
| T13 | **Race conditions** (Medium). Two moves, two claims, two verifies at once | Atomic D1 updates (`WHERE version=?`, `WHERE status='pending'`, `UPDATE ... RETURNING`), tested concurrently | None known |
| T14 | **Denial of wallet** (Medium). Request flood or polling abuse | Rate limiting binding; per-user caps; small responses; polling only when tab visible; billing alerts (Greg) | Cloudflare plans may not have a hard cap (verify). Alerts, not guarantees |
| T15 | **Secrets compromise** (High) | Worker secrets per environment; send-only, domain-scoped Resend key rotated yearly; versioned lookup key; no secrets in repo, logs or prompts | Leak of the lookup key plus a D1 export lets an attacker test known addresses against hashes |
| T16 | **Data leak from D1 or backups** (High) | No readable email, no IP, no free text, no DOB; hashes keyed; retention in the spec; Time Travel window disclosed (verify) | Keyed hashes of guessable addresses are only as safe as the key |
| T17 | **Information leaks in errors and logs** (Low) | Fixed generic messages; opaque ids only in logs; no emails, codes, tokens, names or full IPs | None known |
| T18 | **Missing headers on Worker responses** (Medium). `_headers` does not apply to them | One header helper, tested on every route | Regression risk, covered by a test |
| T19 | **Supply chain** (Medium) | Zero runtime dependencies (WebCrypto, `fetch`); dev-only wrangler; audit gate high | Wrangler/miniflare compromise at build time |
| T20 | **Third-party data exposure** (Medium). Google Fonts receives visitors' IPs | Self-host fonts first; CSP forbids third-party origins; test checks | None after PR 1 |
| T21 | **Lockout abuse** (Low). Someone burns an address's failure budget | Accepted trade-off, 24-hour limit | Annoyance |
| T22 | **Operator error** (Medium). Wrong DNS, leaked key, misconfigured binding | Config tests (`workers_dev: false`, `DEV_MAIL_SINK` unset, `not_found_handling`); Greg owns DNS and billing | Human error |
| T23 | **Unlawful processing** (High). Children's data without a DPIA | DPIA, Children's Code assessment, Ofcom scope record, privacy notice before launch; 13+ gate; legal check | Under-13s who lie about age. Documented as a speed bump |

### Added after security review round 1

| ID | Threat | Mitigation | Residual |
|---|---|---|---|
| T24 | **Impersonating a child's friend** (High). A client chooses a name, or fishes by re-rolling | Names are rolled by the server only; 5 re-rolls a day; none during an open invite or active game; invite preview shows the inviter's name before accept | Names are not unique, so a random match with a friend's name is possible but not chosen. Accepted |
| T25 | **Blocked adult returns** (High). New link via another channel, or sign-up again after suspension | Symmetric blocks inside the atomic claim; preview before accept; suspension adds the address to `denied_emails` | A new email address is a new account. Cannot be prevented without identity checks. Accepted |
| T26 | **Reports without teeth** (High). No suspension, evidence deleted with the account, or delete-then-sign-up-again before Greg acts | `suspended_at` enforced in the one session loader; reports survive deletion with a copy of the moves and the reported address hash; one alert per report; the repo suspension script takes a report id and works on a deleted account | Greg must act on alerts. O3 |
| T27 | **Draw offers as spam or a signal** (Low/Medium) | Own turn only, one per move, none after 3 declines | A prior channel already exists for signalling. Accepted |
| T28 | **Server CPU exhaustion** (Medium). `allMoves` is exponential with own-piece jumps | Server never calls `allMoves` or `chooseMove`; shape checks first; benchmark; 2,000-ply cap | None known |
| T29 | **Links posted publicly as stranger matchmaking** (Medium) | 5 new distinct opponents in 7 days; alert when many brand-new accounts claim one account's invites | Reduced, not removed |
| T30 | **Idle-job race** (Low) | Race-safe update on `last_move_at`; polling is not activity | None known |
| T31 | **Unexpected data capture by platform** (Medium). Workers logs, preview URLs, read replicas | Logs off or verified; `preview_urls` and `workers_dev` off; read replication off | Cloudflare settings can change; config tests |

## 5. What is deliberately absent
No passwords, no free text between players, no stored email, no IP logging, no ratings, no search or directory, no server-sent invite emails, no third-party scripts, no WebSockets in v1.

## 6. Things only Greg can do
Add SPF, DKIM and DMARC for the sending domain; set Cloudflare billing alerts; add a Resend DPA and decide the processing region; approve the DPIA and privacy notice; decide whether to pay for a legal check.

## 7. Questions for the security-architect
1. Is storing only a keyed email hash (no encrypted copy) acceptable, including the key-rotation approach in spec 6.2?
2. Is claiming an invite by POST with the token in the URL fragment sound, or should the fragment be replaced by a short claim code?
3. Are the sign-in limits right for a children's site (code lockout for 24 hours after 20 failures)?
4. Is correspondence play with polling acceptable from an abuse and cost view, and what is the smallest rate-limit set it needs?
5. Is the age screen with a browser-side speed bump acceptable evidence of "reasonable efforts" for the DPIA, or should the age answer also be handled differently?
6. Anything in the build order that should be reordered because a control must exist earlier.
