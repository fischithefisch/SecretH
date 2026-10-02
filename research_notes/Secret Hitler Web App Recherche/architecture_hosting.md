# Technical Architecture & Hosting Options for a Real-Time Hidden-Information Web Game (Secret Hitler, 5–10 players on phones), as of Oct 2026

Research date: 2026-10-02. Method note: direct page fetches to supabase.com, developers.cloudflare.com, render.com, firebase.google.com and socket.io were blocked by the network proxy in this research session, so most numbers below come from web-search snippets of the official pages (official URL cited) and, where noted, from third-party aggregators. Numbers marked "(aggregator)" should be re-checked on the vendor's pricing page before the final report states them as fact.

## 1. Architectural principle: server-authoritative state, per-player views, validation, state machine

### Takeaway
The only safe design for a hidden-role game is: the full game state (roles, party memberships, deck order, drawn policy cards) lives exclusively on a server process/function the clients cannot read; every client gets a per-player filtered "view" computed on the server, and every action is validated by the server against the current state-machine phase. Any architecture that stores the full state in a client-readable shared realtime store (a Firebase node / Supabase table / broadcast channel subscribed to by all players) leaks roles to anyone who opens DevTools.

### Cited Findings
- boardgame.io (a framework designed for turn-based games) explicitly separates game state management and multiplayer networking from the view layer and handles synchronization between server and clients; it supports phases, lobby, logs with time travel — [boardgame.io GitHub](https://github.com/boardgameio/boardgame.io)
- Supabase Realtime Broadcast/Presence channels are by default open: without authorization, any authenticated client can subscribe to any channel; access is controlled via RLS policies on the `realtime.messages` table, and the channel must be created with `private: true`. Policies are evaluated when the user connects (SELECT = may receive, INSERT = may send) — [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization); [Supabase blog: Broadcast and Presence Authorization](https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization)
- PartyServer (Cloudflare) offers room-based routing, lifecycle hooks, and "easy broadcasting to all or selected connections in a server" — i.e. it can send different messages to different connections, which is what per-player views need — [partyserver README (npm/jsDelivr)](https://cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md)

### Inferences
- Recommended pattern (synthesis, standard practice in multiplayer game dev):
  1. **Single authoritative `GameState` object per room** held on the server (in-memory in a Durable Object / Node process, persisted to storage for crash/redeploy safety).
  2. **Pure reducer / state machine**: `applyAction(state, playerId, action) -> newState | Error`. Phases for Secret Hitler map naturally to states: `LOBBY -> ROLE_REVEAL -> NOMINATE_CHANCELLOR -> VOTE -> (LEGISLATIVE_PRESIDENT_DISCARD -> LEGISLATIVE_CHANCELLOR_ENACT [-> VETO_REQUEST -> VETO_RESPONSE]) -> EXECUTIVE_ACTION (investigate / special election / policy peek / execution) -> NEXT_ROUND`, plus terminal `GAME_OVER`. Election tracker / chaos (3 failed elections) is a transition, not a phase. Libraries like XState are optional; a hand-written `switch(phase)` reducer with exhaustive TypeScript types is usually enough for hobby scope.
  3. **Validation on every action**: is it this phase? is the sender the player allowed to act (president/chancellor)? is the target eligible (term limits, not dead)? is the card index valid in *their* hand? Reject everything else. Never trust client-sent state.
  4. **`viewFor(state, playerId)` projection**: strip/mask secrets — own role always; fascists see fellow fascists (and Hitler); Hitler sees fascists only in 5–6 player games; president sees 3 drawn cards only during their discard step; chancellor sees 2 cards only during theirs; investigation result only to the investigating president; policy-peek only to president; deck order never. Votes are hidden until all are cast, then revealed to all. Spectators/dead players get the public view.
  5. **Broadcast = loop over connections, send each its own `viewFor`**, not one shared payload. Server-side randomness (shuffle with `crypto.getRandomValues`) — never shuffle on a client.
  6. Send full (filtered) snapshots rather than diffs: state for Secret Hitler is tiny (<5 KB), so sending the whole per-player view after every action is simplest and makes reconnect resync trivial.
- **Pitfalls**:
  - Putting the whole game in one Firebase RTDB node or one Supabase row that all players subscribe to → roles visible in network tab. Security rules/RLS can only filter *whole documents/rows/paths*, so secrets must be split into per-player documents/rows (e.g. `private/{playerId}`) that only that player can read, and writes must go through a trusted function — this works but is fiddly and easy to get wrong.
  - Supabase "Postgres Changes" respects RLS per row, but Broadcast from client to client bypasses tables entirely; letting clients broadcast game moves means no server validation (cheating possible). (Inference from the authorization docs above.)
  - Leaking secrets via logs, error messages, "debug" fields, or sending the full state and hiding it in the UI.
  - Client-side shuffling or random role assignment.
  - Not making actions idempotent (double-tap on mobile sends vote twice) — include an action ID / expected phase or turn number.

### Gaps
- Could not fetch boardgame.io docs page on `playerView` / `PlayerView.STRIP_SECRETS` in this session; from prior knowledge boardgame.io provides a `playerView(G, ctx, playerID)` hook and a built-in `PlayerView.STRIP_SECRETS` helper that removes `G.secret` and other players' entries in `G.players` — verify at https://boardgame.io/documentation/#/secret-state before citing.

## 2. Comparison of backend/realtime options (cost, 2026 free tier, complexity, cold start, WebSockets, secrets)

### Takeaway
For a friends-only game with ≤10 concurrent players, every option's free tier is quantitatively more than enough; the real differentiators are (a) whether there is a natural place to keep secrets and run authoritative logic, (b) cold starts / sleeping, and (c) operational simplicity. Cloudflare Durable Objects (via PartyServer, or Workers + DO directly) is the best fit: free plan includes SQLite-backed DOs, one DO per room = one authoritative in-memory game, WebSocket hibernation, and effectively no cold-start issue. Node + Socket.IO is the most familiar but free hosting in 2026 is weak (Render sleeps after 15 min; Fly.io and Railway have no meaningful free tier). Supabase works but forces a split design (Edge Function or Postgres function as the authority + RLS-protected per-player data) and pauses free projects after 7 days of inactivity. Firebase now requires the paid Blaze plan for Cloud Functions.

### Cited Findings

**2.1 Supabase (Postgres + Realtime + Edge Functions + RLS)**
- Free plan: 200 peak concurrent Realtime connections, 2 million Realtime messages/month, 256 KB max message size (aggregator, Supabase pricing summarized for 2026) — [JetAdmin: Supabase Pricing 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/); official page: [supabase.com/pricing](https://supabase.com/pricing)
- Free projects are paused automatically after 7 days of inactivity; data retained, but project offline until manually resumed — same source [JetAdmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- Private channels + RLS on `realtime.messages` control who can send/receive Broadcast and Presence; checked at connect time — [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- Anonymous sign-ins: `signInAnonymously()` creates a real user (authenticated role) without email/PII; JWT carries `is_anonymous` claim usable in RLS; user is lost if they sign out/clear browser data/switch device — [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)

**2.2 Cloudflare Durable Objects / PartyKit / PartyServer**
- Workers Free plan: Durable Objects (SQLite-backed) are available on the Free plan; free limits 100,000 requests/day and 313,000 GB-s/day duration; 1 GB max storage per SQLite DO on Free (writes fail beyond) — [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing) / [DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits) (via search snippets)
- WebSocket billing: incoming WebSocket messages are billed at a 20:1 ratio (100 incoming messages = 5 requests); outgoing messages and protocol pings are free — [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- Hibernation: with the WebSocket Hibernation API, idle objects aren't billed for duration; objects hibernate after ~10 s without activity, in-memory state is cleared but WebSockets stay connected. Using plain `accept()` instead incurs duration charges for the whole connection time — [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- Paid plan (Workers Paid, base fee not captured here) includes 1 M DO requests/month (+$0.15/M) and 400,000 GB-s/month (+$12.50/M GB-s) — [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- Cloudflare acquired PartyKit (announced 5 April 2024); existing PartyKit users can deploy to their own Cloudflare account — [Cloudflare blog](https://blog.cloudflare.com/cloudflare-acquires-partykit); [PartyKit blog](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/)
- The `cloudflare/partykit` GitHub repo now hosts **PartyServer** ("Powered by Durable Objects, Inspired by PartyKit") plus PartySocket (client WebSocket with reconnection + buffering), y-partyserver, partysub, partysync, partywhen, hono-party — [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit)
- PartyServer provides room-based routing (`routePartykitRequest`, URL `/parties/:server/:name`), lifecycle hooks, unified API for hibernated/non-hibernated DOs, broadcast to all or selected connections. Cloudflare's Agents SDK `Agent` class extends PartyServer's `Server`, which extends `DurableObject` — i.e. PartyServer is actively used by Cloudflare's own products — [partyserver README](https://cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md); [Agents SDK agent-class docs](https://unpkg.com/agents@0.20.1/docs/agent-class.md)

**2.3 Node.js + Socket.IO on Render / Fly.io / Railway**
- Render Free web service: spins down after 15 min without inbound traffic; since 24 Feb 2026 incoming WebSocket messages on existing connections also count as traffic (previously only HTTP requests did); 750 free instance hours per workspace per month, services suspended if exhausted — [Render Free docs](https://render.com/docs/free); [Render changelog Feb 2026](https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages)
- Render spin-up from sleep: Render's docs state it can take up to about a minute (aggregator-level; exact wording not captured) — see [Render pricing explained (livemy.app)](https://livemy.app/blog/render-pricing) — flag as uncertain.
- Fly.io: free allowances were removed in 2024; 2026 pricing is pure pay-as-you-go per second; new orgs get a trial of 2 VM hours or 7 days (whichever first) (aggregator) — [kuberns: Fly.io pricing 2026](https://kuberns.com/blogs/flyio-pricing/); [costbench Fly.io free plan](https://costbench.com/software/developer-tools/flyio/free-plan)
- Railway: Trial = one-time $5 credit for 30 days, then Free plan with $1/month credit; Hobby plan $5/month including $5 usage credit — [Railway Pricing Plans docs](https://docs.railway.com/reference/pricing/plans)
- Socket.IO `connectionStateRecovery` (since v4.6.0, Feb 2023): options `maxDisconnectionDuration` (default 2 min) and `skipMiddlewares` (default true); restores socket id, rooms and missed packets after a short disconnect — [Socket.IO Connection state recovery](https://socket.io/docs/v4/connection-state-recovery); [Server options](https://socket.io/docs/v4/server-options/)

**2.4 Firebase (RTDB / Firestore + Cloud Functions)**
- Spark (free): Realtime Database 100 simultaneous connections (Blaze: 200K per database); Firestore free quotas ~50K reads/day, 20K writes/day, 20K deletes/day, 1 GB storage — [Firebase Pricing](https://firebase.google.com/pricing); [RTDB limits](https://firebase.google.com/docs/database/usage/limits) (via search snippets / [back4app summary](https://blog.back4app.com/firebase-pricing/))
- Deploying Cloud Functions requires the pay-as-you-go **Blaze** plan; Blaze includes a no-cost tier of 2 M invocations, 400,000 GB-s, 200,000 CPU-s, 5 GB egress per month — [Cloud Functions for Firebase docs](https://firebase.google.com/docs/functions). **Conflict:** some third-party blogs (e.g. [back4app](https://blog.back4app.com/firebase-pricing/)) still list Cloud Functions quotas under Spark; this is outdated — official docs say Blaze is required.

**2.5 boardgame.io**
- Latest release line 0.50.x (0.50.2 on cdnjs); repo has ~12.5k stars, 54 open issues, 13 open PRs — [GitHub](https://github.com/boardgameio/boardgame.io); [cdnjs](https://cdnjs.com/libraries/boardgame-io)
- One search aggregator reported "last updated 6 months ago" (undated context, unreliable) — [libraries.io](https://libraries.io/npm/boardgame.io)

**2.6 Other options**
- Colyseus: open-source, free to self-host; Colyseus Cloud from $15/month, no free tier, no CCU limits — [Colyseus pricing](https://www.colyseus.io/pricing); [Colyseus Cloud billing docs](https://docs.colyseus.io/cloud/pricing-billing)
- Ably Free: 6 M messages/month, 200 concurrent connections, 200 concurrent channels — [Ably Free package](https://ably.com/docs/pricing/free)
- Pusher Channels Sandbox (free): 200k messages/day, 100 concurrent connections — [Pusher Channels](https://www.pusher.com/channels) (via search snippet; [Ably comparison](https://ably.com/compare/ably-vs-pusher/pricing))
- **Vercel – correction to the brief's assumption:** Vercel launched native WebSocket support for Functions in **public beta on 22 June 2026** (requires Fluid compute, default since April 2025; connection pinned to one instance). But connections inherit the function duration limit; a hands-on test saw the connection dropped after ~5 min 10 s without a clean close — [Vercel docs: WebSockets](https://vercel.com/docs/functions/websockets); [releases.sh summary](https://releases.sh/release/rel_yNUn74KGsQqbJOSpgMBnY-vercel-launches-websocket-support-in-public-beta-for-functions); [Classmethod test](https://dev.classmethod.jp/en/articles/vercel-functions-websocket-public-beta-verification/). Also no shared in-memory room state across instances → still unsuitable as the authoritative game server; fine for hosting the static frontend.

### Inferences
Comparison matrix (synthesis):

| Option | Free tier fit for 10 players | Cold start / sleep | Where secrets live | Complexity | Verdict |
|---|---|---|---|---|---|
| **Cloudflare DO + PartyServer** (or plain Workers+DO) | Excellent (100k req/day; WS messages 20:1; hibernation) | No sleeping project; DO starts in ms on first request (no figure cited) | In-memory per room + DO SQLite storage; never in client-readable store | Low–medium (one TS class per room; Wrangler deploy) | **Best fit** |
| Node + Socket.IO on Render Free | OK capacity | Spins down after 15 min idle; first player waits for cold start (~up to a minute, uncertain); in-memory state lost on spin-down/redeploy | In process memory (persist to DB/Redis if you want survival) | Low (very familiar) | Good for dev; free tier annoying |
| Node + Socket.IO on Fly.io / Railway | No real free tier (Fly trial only; Railway $1/mo credit) | Fly can auto-stop; Railway Hobby $5/mo always-on | Process memory | Low | Fine if willing to pay ~$5/mo |
| Supabase | Capacity fine (200 conn, 2M msg/mo) | Project paused after 7 days inactivity → must manually resume before game night | Postgres tables with RLS (per-player rows) + Edge Function/RPC as authority; or private broadcast channels per player | Medium–high (RLS, SQL, Edge functions, split model) | Workable but more moving parts |
| Firebase | RTDB 100 conn on Spark is enough, but authoritative logic needs Cloud Functions → Blaze (credit card) | Cloud Functions cold starts (seconds, not cited) | Per-player docs with security rules + Functions as authority | Medium–high | Not recommended |
| boardgame.io | Library; needs a Node host (same hosting issue) | Same as host | `playerView` strips secrets | Low for game logic, but framework is slow-moving | Optional, concept worth copying |
| Colyseus | Self-host free; Cloud $15/mo | Host-dependent | Server room state with filters | Medium | Overkill for this game |
| Ably / Pusher | Plenty | none (managed) | Need your own server anyway to filter secrets; private channels per player | Medium | Only as transport, adds a second service |
| Vercel Functions WS | Beta, ~5 min disconnects observed | — | No persistent room memory | — | Not for game server; use for frontend only |

- Supabase-specific secure pattern if chosen: `games` table (public state), `player_secrets` table with RLS `auth.uid() = player_id`, all moves via a Postgres `security definer` RPC or Edge Function that validates and writes; clients subscribe via Postgres Changes (RLS applied) or a private broadcast channel per player. Free project pause after 7 days is a real gotcha for a game played every few weeks.
- Cost for this use case on Cloudflare: a 1-hour game with 10 players sending maybe ~500 incoming messages total ≈ 25 billable requests — negligible vs 100k/day free (inference from 20:1 rule).

### Gaps
- Cloudflare Workers Paid base price (historically $5/month) and Workers Free request limit (historically 100k/day) not re-verified in this session.
- Render's exact cold-start time not verified from the official page.
- Supabase free-tier numbers come from an aggregator because supabase.com was blocked; re-verify on supabase.com/pricing.
- PartyKit's original hosted platform (partykit.io, `npx partykit deploy`) current status in 2026 — no source found stating whether it is deprecated; the active development clearly moved to PartyServer in `cloudflare/partykit`. Treat PartyServer as the de facto successor (inference), but state that officially it is described as "inspired by PartyKit".
- boardgame.io exact date of last release not found; maintenance appears low-activity (inference from 0.50.x line having been current for a long time).

## 3. Reconnect handling on iOS Safari (screen lock, app switch), disconnect policy

### Takeaway
On iPhone, assume the WebSocket dies whenever Safari goes to the background or the screen locks, and that `onclose`/`onerror` may not fire reliably after longer suspension. Design for "reconnect is normal": persist a rejoin token in localStorage, reconnect on `visibilitychange`/`pageshow`/`online`, and always send a full filtered state snapshot after reconnect. Game logic should tolerate absent players (pause on turns that require them, never auto-reveal secrets).

### Cited Findings
- From iOS 15 on, WebSocket connections are closed when the user switches to another app; server sees the client going away — [Apple Developer Forums thread 696310](https://developer.apple.com/forums/thread/696310)
- On iPhone, locking the screen or minimizing Safari fires WebSocket `onclose` immediately; after longer inactivity, `onerror`/`onclose` may no longer be delivered, so the page doesn't notice the dead connection — [WebKit Bugzilla 247943](https://bugs.webkit.org/show_bug.cgi?id=247943); [Apple forum](https://developer.apple.com/forums/thread/696310)
- WebSocket questions persist for iOS 26 — [Apple Developer Forums thread 792842](https://developer.apple.com/forums/thread/792842)
- Common mitigation: listen to `visibilitychange`; when the page becomes visible, check whether the socket is alive (e.g. send a ping and wait ~1.5 s) and force a reconnect otherwise — [agentboard WebSocket connection management (deepwiki)](https://deepwiki.com/gbasin/agentboard/5.3-websocket-connection-management)
- Socket.IO connectionStateRecovery restores session within 2 min by default (`maxDisconnectionDuration`) — [Socket.IO docs](https://socket.io/docs/v4/connection-state-recovery)
- PartySocket (client lib) provides automatic reconnection and message buffering — [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit)

### Inferences
- Recommended client logic:
  - On join, server returns `{roomCode, playerId, rejoinToken}` (random 128-bit); store in `localStorage` (key per room). On page load, if a token exists, auto-rejoin.
  - Reconnect triggers: `visibilitychange` → `visible`, `pageshow` (with `event.persisted` for bfcache restores), `online`, `focus`; plus exponential backoff with jitter (e.g. 0.5 s → 8 s cap).
  - App-level heartbeat: client ping every ~20–25 s while visible, server/client consider connection dead after ~2 missed pongs; on return-to-foreground, don't trust `readyState === OPEN` — send ping and reconnect if no pong within ~1.5–2 s. (On Cloudflare DO, protocol pings are free and can be auto-answered via `setWebSocketAutoResponse` — from prior knowledge, not verified in this session.)
  - After every (re)connect: server sends the complete per-player view (snapshot) — makes Socket.IO `connectionStateRecovery` a nice-to-have, not a requirement; don't rely on it alone because iOS suspensions often exceed 2 min and recovery fails across server restarts.
  - Action messages carry `actionId`; server dedupes so a resend after reconnect isn't applied twice.
  - Screen Wake Lock API (`navigator.wakeLock.request('screen')`) can keep the phone from auto-locking during the game while the page is visible — mention as option (support in Safari from iOS 16.4 per prior knowledge; not verified here).
- Server-side disconnect policy:
  - Mark players `connected: false` with `lastSeen`; show a "reconnecting…" badge to others. Never remove a player from a running game on disconnect.
  - If the game is waiting on the disconnected player (president's nomination, legislative discard, vote), just wait; optionally after N minutes allow the host to "skip/auto-act" (e.g. vote counts as abstain is not in the rules → better: host can pause or kick and end the game). For votes, don't reveal partial results while waiting.
  - Room state must survive server restarts: persist after each action (DO storage / DB), so a cold start or redeploy doesn't wipe the game.
  - Garbage-collect rooms after e.g. 24 h of inactivity (DO alarms or cron).

### Gaps
- No official Apple/WebKit documentation found that specifies exact timing for WebSocket termination in background; evidence is from developer forums and WebKit bug reports.
- Behavior of installed PWA (Add to Home Screen) vs Safari tab regarding WebSocket suspension not researched.

## 4. Simple anonymous auth (room code + nickname + rejoin token) and recommended minimal stack

### Takeaway
No accounts needed: host creates a room, gets a short code (e.g. 4–5 uppercase letters avoiding ambiguous chars), friends join with code + nickname, server issues an opaque rejoin token stored in localStorage. Recommended minimal hobby stack: TypeScript everywhere; frontend Vite + React (or SvelteKit/Svelte in SPA mode) as a static site on Cloudflare Pages/Workers static assets (or Vercel); backend PartyServer on Cloudflare Durable Objects with PartySocket on the client; shared `game-logic` package with the pure reducer + `viewFor` and unit tests.

### Cited Findings
- Supabase alternative: anonymous sign-ins give a real JWT/user id with no PII, usable in RLS, but identity is lost if browser data is cleared — [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- PartyServer handles room naming via URL (`/parties/:server/:name`), so the room code can directly be the DO name — [partyserver README](https://cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md)
- Vercel can host the frontend; its Functions are not suitable as persistent game server (see section 2) — [Vercel docs: WebSockets](https://vercel.com/docs/functions/websockets)

### Inferences
- Auth flow: `POST /create` → server generates room code, host gets `{playerId, token}`. `join(code, nickname)` → server checks lobby phase, unique nickname, max 10 players → returns `{playerId, token}`. Reconnect: `hello(token)` → server maps token → playerId and attaches the new connection (closing the old one). Token should be random (crypto), stored hashed or plainly in DO storage (low stakes). Allow "rejoin from another device" via host action (host reassigns seat) as a fallback for cleared localStorage.
- Don't put the token in the URL (shared screenshots/links would let others hijack a seat); pass it in the first WebSocket message or as a query param only on connect over WSS.
- Game is invite-by-code only; optionally rate-limit join attempts per IP to avoid code guessing (low risk for friends).
- Frontend choice: React + Vite has the largest ecosystem/tutorials; Svelte/SvelteKit yields smaller bundles and simpler state — both fine. For mobile web: large touch targets, `100dvh` layouts, prevent accidental zoom, "hold to reveal role" UI so neighbors can't see the screen, optional PWA manifest for fullscreen.
- Monorepo layout: `/shared` (types, reducer, viewFor), `/server` (PartyServer class: onConnect, onMessage → validate → applyAction → persist → send viewFor to each conn), `/client`. Local dev with `wrangler dev`.
- Expected cost: €0 on Cloudflare Free for friend groups; fallback if outgrowing: Workers Paid (~$5/mo, unverified).

### Gaps
- Did not verify current Cloudflare Pages vs "Workers static assets" recommendation in 2026 (Cloudflare has been steering new projects toward Workers with static assets; not confirmed here).
- No benchmark data found comparing React vs Svelte on low-end phones for this use case; recommendation is qualitative.
