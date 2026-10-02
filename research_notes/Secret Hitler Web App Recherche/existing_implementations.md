# Existing Digital Implementations of Secret Hitler (status: Oct 2026)

Research notes for a new mobile-first hobby web app (play with friends). Notes are in English; final report will be German.
Method note: secrethitler.io, secrethitler.com, boardgame.io docs site, BGA forum, Steam, top.gg and Wikipedia were blocked by the research sandbox's egress proxy, so those were covered via search snippets only. GitHub repos were inspected directly (shallow clones of cozuya/secret-hitler, ShrimpCryptid/Secret-Hitler-Online, boardgameio/boardgame.io; READMEs of others via raw.githubusercontent.com). Claims marked "(code)" were verified in the source code at the given path.

## 1. secrethitler.io (cozuya/secret-hitler): open source status, stack, architecture, hidden-info handling, features, pain points

### Takeaway
secrethitler.io is open source (GitHub `cozuya/secret-hitler`, CC BY-NC-SA 4.0), launched 2016/2017 and still actively maintained in 2026 (big tooling modernization June 2026, maintainer soliciting ideas Aug 2026). It is a single-process Node/Express/Socket.IO server holding all live games in memory, with React 16 + Redux client, MongoDB for accounts/stats and Redis for sessions. Hidden information is protected server-side by sending each socket its own filtered copy of the game object; the maintainer himself calls the code "VERY OLD" spaghetti and explicitly asks people not to self-host it.

### Cited Findings
**Repo / license / activity**
- Repo `cozuya/secret-hitler`: ~854 stars, ~202 forks, ~3,100 commits, license Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International; production at https://secrethitler.io — [GitHub repo](https://github.com/cozuya/secret-hitler); license text verified in `LICENSE` (code).
- Repo description: "originally developed in early fall 2016"; README: "Originally launched in 2017" — [GitHub repo](https://github.com/cozuya/secret-hitler)
- Recent commits (code, `git log`): 2026-06-28 "cleanup and changes to move hosts from VPS to managed hosting"; 2026-06-22 "convert to pnpm/biome/oxlint/vite/node 24, add zod on all user inputs"; Feb 2026 a burst of feature PRs (seasonal vs overall ELO revamp #2014, vote/shot accuracy tooltip #2013, Avalon-SH game mode dot commands #2016, UI tweaks) — [commits](https://github.com/cozuya/secret-hitler/commits/main)
- Issue #2030 (opened by cozuya, 29 Aug 2026, "Next update ideas/requirements"): maintainer asks players for ideas for a new pending update → project is alive in 2026 — [Issue #2030](https://github.com/cozuya/secret-hitler/issues/2030)
- README self-assessment: "The tech to make this work is VERY OLD (before react hooks!), has had almost no oversight of public pull requests leading to some giant pasta style code, and I can't recommend working on it, looking at it, or exposing it to sunlight. It does work, though." On self-hosting: "Don't. Please respect the maintainers and contributors who have given their time for free…" — [README](https://github.com/cozuya/secret-hitler/blob/main/README.md)

**Tech stack**
- Frontend: React, Redux, Sass, Semantic UI, jQuery, Socket.IO; Backend: Node, Express, Pug, Passport, MongoDB/Mongoose, Socket.IO, Redis — [README](https://github.com/cozuya/secret-hitler)
- `package.json` (code): `react 16.8.1`, `socket.io 2.4.1`, `socket.io-client 2.5.0`, `mongoose ^5.7.5`, `redis ^2.8.0`, `passport ^0.4.0`, build now via `vite ^8`; Node v24 + pnpm required — [package.json](https://github.com/cozuya/secret-hitler/blob/main/package.json)
- Since June 2026 all socket user inputs are validated with zod schemas (e.g. `routes/socket/user-events/*.schema.js`, `leaveGameSchema.safeParse(data)`) (code) — [user-events dir](https://github.com/cozuya/secret-hitler/tree/main/routes/socket/user-events)

**Architecture / hosting** (from `render.yaml`, code)
- "Single web service, ONE instance: all live game state is held in memory (the `games` object, user lists, chats) and there is no socket.io Redis adapter, so running >1 instance would split games across processes and break them." — [render.yaml](https://github.com/cozuya/secret-hitler/blob/main/render.yaml)
- "autoDeploy: false # a redeploy restarts the process and drops every live game — deploy off-peak, deliberately"; plan "starter # 512MB / 0.5 CPU"; MongoDB on Atlas; Redis used for sessions (db 10) and global settings (db 11) — [render.yaml](https://github.com/cozuya/secret-hitler/blob/main/render.yaml)

**How hidden roles are kept off clients** (code, `routes/socket/util.js`)
- The game object has a `private` sub-object (seated players' roles, per-player views, unseated chats, remake data, etc.). `secureGame()` deletes `private`, `remakeData`, `guesses`, `unsentReports` before emit — [routes/socket/util.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/util.js)
- `sendInProgressGameUpdate()` iterates the sockets in the game room, splits them into seated players vs observers (by Passport session user), and for each seated player substitutes `_game.playersState = privatePlayer.playersState` (that player's personal view: own role, known teammates), merges that player's private chats, then emits `gameUpdate` with `secureGame(_game)`; observers get the public object only — [routes/socket/util.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/util.js)
- Pattern = server-authoritative state + per-recipient projection ("player view") on every broadcast; no secrets are ever sent and hidden in the UI.

**Game features** (code: `routes/socket/user-events/create-game.js` option names, component list)
- Lobby-style: anyone creates a game listed on the home page; starts when enough players are seated; anyone can watch (spectators) — [README](https://github.com/cozuya/secret-hitler)
- Game-creation options found in code: `privatePassword` (private games), `unlistedGame`, `casualGame`, `practiceGame`, `rainbowgame` (experienced-players-only), `isVerifiedOnly`, `eloMinimum`, `isTourny` (tournaments), `timedMode` (turn timer), `blindMode` (anonymous names), `disableGamechat`, `disableObserver`, `playerChats`, `customGameSettings` (custom role/power configs), `rebalance6p/7p/9p2f`, `avalonSH` (Avalon-style variant with Merlin/Percival/Morgana), `flappyMode` (joke mini-game), `isRemade` (remake vote) — [create-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/user-events/create-game.js)
- README: adjusted veto power for online play, rebalancing for 6/7/9-player games, custom game mode — [README](https://github.com/cozuya/secret-hitler)
- Other features in code: ELO leaderboards (seasonal + overall), profiles, replays (`src/frontend-scripts/replay`), player reports, moderation panel & mod DMs, player notes, cardback store (custom card backs for "rainbow" users), claims system (`claim.js`), dark theme, chat with emotes, browser fingerprinting (`src/frontend-scripts/fingerprint.js`), banned-IP model — [repo tree](https://github.com/cozuya/secret-hitler/tree/main)
- Moderators can see player IPs on a private moderation panel "solely to guard against cheating" (statement from the MPIB fork's About page, which is based on secrethitler.io) — [Secret-Hitler vs AI About](https://secret-hitlerio-dev.chm.mpib-berlin.mpg.de/about)
- Timed mode (code): when `game.general.timedMode` is set, a server-side `setTimeout` of `timedMode * 1000` ms runs per phase and auto-resolves the action if the player does not act (`routes/socket/game/common.js`, `election-util.js`, `election.js`) — [routes/socket/game](https://github.com/cozuya/secret-hitler/tree/main/routes/socket/game)
- Leaving mid-game (code, `leave-game.js`): after roles are dealt (`isTracksFlipped`) the seat is NOT removed — the player is flagged `leftGame = true` and can come back (seat is bound to the account); before start the seat is removed. Leaving also counts as withdrawing a "remake" vote; remake requires a supermajority (`floor(n/2)+2`) — [leave-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/user-events/leave-game.js)

**Known pain points**
- Mobile UI is a long-standing weak spot: issues "ui not working completely on mobile" (#401, 2017), "Issues with touch/mobile devices" (#410), "Clicking 'ja' or 'nein' does not always register" (#273), "UI problems on mobile/touch devices" (#403), "Mobile/iPhone X Interface" (#1317, 2019), "Mobile UI redesign" (#1445, described the mobile interface as "somewhat difficult to use"; not implemented), "Option to show only chat (full page) on mobile" (#1628), "Option to disable animations" (#1725), "Votes occasionally are invisible" (#1417) — [GitHub issues search "mobile"](https://github.com/cozuya/secret-hitler/issues?q=is%3Aissue+mobile); [Issue #1445](https://github.com/cozuya/secret-hitler/issues/1445)
- Operational fragility: single in-memory process; a deploy kills all running games (see render.yaml quote above) — [render.yaml](https://github.com/cozuya/secret-hitler/blob/main/render.yaml)
- Code quality / maintainability: maintainer's own "giant pasta style code" warning — [README](https://github.com/cozuya/secret-hitler/blob/main/README.md)
- Griefing/AFK/alt accounts: the existence of player reports, ELO minimums, "verified only", "rainbow" games, IP bans, fingerprinting and timed mode in the code indicates these were real problems on a public site (inference from features; see Inferences).

### Inferences
- For a public, anonymous-stranger site most complexity is community management (moderation, ELO, reports, anti-alt). A friends-only app can skip almost all of that: no accounts, no ranking, no mod tools.
- The core security pattern (server holds full state; each client gets a projection) is exactly what a new app must copy. Never send full state and filter in UI.
- secrethitler.io's lesson on persistence: in-memory state is fine for a hobby app, but deploys/restarts drop games; cheap mitigation is snapshotting state to a DB/KV (see ShrimpCryptid below) or deploying only when no game is running.
- Timed mode with server-side auto-actions is the established answer to AFK players; for friends, an optional/longer timer or a host "skip/kick" is likely enough.

### Gaps
- Could not load secrethitler.io pages (About, rules, FAQ) — egress blocked; no first-hand info on current player counts, ToS, or mobile layout as of 2026.
- No reliable Reddit/forum sources found on devtools cheating or griefing specifically on SH.io (searches returned unrelated Among Us/GTA content). The only cheating-related fact found is moderators' IP visibility.
- Did not verify whether the claim/"cardFlinger" UI uses animations that are problematic on mobile beyond the issue titles.

## 2. Other implementations (clones, TTS, BGA, mobile apps, Discord bots, reskins, official)

### Takeaway
There is no official digital Secret Hitler and none on Board Game Arena; the CC BY-NC-SA license forbids commercial use and (per the publisher, as quoted by several projects) app-store submission, so all digital versions are free fan projects. Beyond SH.io the most relevant living web clones are secret-hitler.online (ShrimpCryptid; Java/Javalin + React; room-code lobbies; active 2025–26), several small Node/Socket.IO or Vue projects, a 2026 three.js "Secret Table" on Vercel+Supabase, a Secret Voldemort fork of the SH.io codebase, pass-and-play single-device apps, a Tabletop Simulator workshop mod, and multiple Discord bots.

### Cited Findings
**Licensing / official / BGA**
- Secret Hitler is CC BY–NC–SA 4.0: "you have to give credit for the original, you're not allowed to profit from it commercially in any way, and you have to license it under the exact same CC license. You also can't submit anything to an app store or anything like that." (quoted from the official site's license terms in the kaelri project README) — [kaelri/secret-hitler README](https://github.com/kaelri/secret-hitler)
- Board Game Arena: BGA forum threads "Game wanted - Secret Hitler" exist; search summary indicates the non-commercial license is the obstacle and it is not on BGA — [BGA forum: Game wanted](https://forum.boardgamearena.com/viewtopic.php?t=14660), [BGA forum](https://forum.boardgamearena.com/viewtopic.php?p=137043) (pages themselves could not be loaded; snippet-level evidence only). One search snippet claimed "an official online version exists" — I could not verify that and found no official digital version; treat as unconfirmed.
- Secret Voldemort: fan-made Harry Potter reskin by Reddit users; made possible by CC BY-NC-SA but no print-and-play files due to HP branding — [Tabletop Gaming, Feb 2017](https://tabletopgaming.co.uk/news/this-fan-made-harry-potter-re-skin-of-secret-hitler-swaps-fascists)

**Web clones (GitHub; stars and last push date as of 2026-10-02 from GitHub search)**
- `ShrimpCryptid/Secret-Hitler-Online` — 257★, pushed 2026-09; plays at https://secret-hitler.online. Java server split into game simulation and REST API, websocket + HTTP via Javalin; React frontend with CSS animations; assets adapted from the original or drawn in Inkscape; OFL fonts (Germania One, Montserrat); CC BY-NC-SA 4.0; lobby code or link to invite friends; up to 10 players; built-in instructions and tips for first-timers; "The game takes care of rules for you" — [README](https://github.com/ShrimpCryptid/Secret-Hitler-Online)
  - Code: backend on Fly.io (`backend/fly.toml`, `fly-deploy.yml`), frontend on Firebase Hosting (`firebase-deploy.yml`), includes `CpuPlayer.java` (bots), PWA manifest (commit "pwa app name fix", May 2025), docker-compose (Sep 2025), last commit "Bumped dependencies" Apr 2026 — [repo](https://github.com/ShrimpCryptid/Secret-Hitler-Online)
  - Code (`SecretHitlerServer.java`): lobbies kept in memory (`codeToLobby` map) with periodic timer that removes timed-out lobbies and stores a backup of active lobbies to Postgres; on startup it loads the DB backup; a shutdown hook backs up lobbies → games survive restarts/redeploys; `/ping` endpoint and ping/pong packets — [SecretHitlerServer.java](https://github.com/ShrimpCryptid/Secret-Hitler-Online/blob/development/backend/src/main/java/server/SecretHitlerServer.java)
  - Issues (pain points): "AFK Kick Button and Fascist Private Chat" (#203), "Cannot kick players" (#183), "Add a Chat Menu for Online Lobbies" (#178), mobile display bugs ("On my phone players icons are negative…" #190, "Make Icon Selection Screen Smaller" #179), and several role-leak/endgame-labeling bugs ("Hitler role sees Fascist Players" #202, "Endgame Popup says everyone is Fascist" #204, #194, #191) — [Issues](https://github.com/ShrimpCryptid/Secret-Hitler-Online/issues?q=is%3Aissue)
- `ItsJustMeChris/secrethitler.gg` ("Secret Hitler — The Table") — one responsive app for desktop/tablet/phone; 8-character table code or invite URL; ready-check; host can add AI seats (any human/AI mix up to 10); "The same browser cookie restores a seat after refresh or disconnection"; no spectators; votes shown publicly as submitted (deviation from simultaneous reveal); text chat that enforces legislative silence and dead-player silence; rematch returns to lobby; all decisions in one "On the floor" area below the boards with tap-to-select portraits + inline confirmation; investigation result in a private popup that hides when the window loses focus; "Choices use only the server's personal game view" — [README](https://github.com/ItsJustMeChris/secrethitler.gg)
- `mertertek/secret-table-game` ("Secret Table", active Sep 2026) — 3D first-person table in three.js, TypeScript strict, 1024 tests, TR/EN UI, no accounts/no install; runs on serverless functions + Postgres (Vercel + Supabase free tiers); "Hidden roles, the deck order and private hands never leave the server"; recommends each group self-host because the shared preview hits free-tier limits; "Try it solo" with 5 bots fully in-browser — [README](https://github.com/mertertek/secret-table-game)
- `ftick/secret-hitler` — Node + Socket.IO, Postgres, 5–10 players, text and (beta) voice chat, game data persisted for stats/replays; site secrethitler.online; issues disabled — [README](https://github.com/ftick/secret-hitler)
- `kaelri/secret-hitler` — Express, Vue.js, Axios, Socket.IO, Day.js, MySQL/MariaDB; Phusion Passenger support for shared hosting — [README](https://github.com/kaelri/secret-hitler)
- `iamsammak/secrethitler` — "Secret Hitler for mobile devices", Meteor.js + Handlebars + MongoDB, Heroku; cron removes rooms/players older than 8 hours; README shows mobile Lobby/Seating/Game views — [README](https://github.com/iamsammak/secrethitler)
- `vicapow/secret-hitler` — "jackbox style" implementation (Next.js): a desktop/TV "board" view plus per-player phone "hand" views (`?isHand=true&playerId=…`) — [README](https://github.com/vicapow/secret-hitler)
- `trentpiercy/secret-hitler` (secrethitler.xyz) — mobile-first Vue.js pass-and-play: one phone replaces the physical set (roles, deck, board tracking); deliberately leaves electing/voting/discussion to real-life to "maintain the spirit of the game" — [README](https://github.com/trentpiercy/secret-hitler)
- `reediculous456/secret-voldemort` — fork of the SH.io codebase rebranded to Harry Potter (same React/Redux/Socket.IO/Mongo stack, lobby style, spectators); last push Feb 2026 — [README](https://github.com/reediculous456/secret-voldemort)
- Others (small/likely abandoned): `brn-dev/SecretPalpatine` (Dart, 2021), `CJPoll/secret_hitler` (Elixir, 2020), `sheganinans/secret_hitler` (Ur/Web, 2018), `touficbatache/SecretHitlerSvelte` (Svelte, 2025), `danieljaeim/secret-h-discord-bot` (2023), `stephanie-wang/anarchist-hitler` ("Play Secret Hitler without a server", Python) — GitHub search results for "secret hitler" (543 repos total) — [GitHub topic secret-hitler](https://github.com/topics/secret-hitler?l=javascript&o=desc&s=forks)
- Research/AI: Max Planck Institute (MPIB) runs a "Secret-Hitler vs AI" platform based on cozuya/secret-hitler — [About page](https://secret-hitlerio-dev.chm.mpib-berlin.mpg.de/about); LLM benchmarks `jordan-gibbs/secret-hitler-bench` (2026), `ArmaanSethi/Secret-Hitler-LLM-Leaderboard` — [GitHub](https://github.com/jordan-gibbs/secret-hitler-bench)
- Other live sites seen in search: secrethitler.live ("digital adaptation made by Alexander Rafferty") — [secrethitler.live](https://secrethitler.live/) (could not load; snippet only)
- Docker image of an SH.io-style deploy: [addono/secret-hitler on Docker Hub](https://hub.docker.com/r/addono/secret-hitler)

**Tabletop Simulator**
- Secret Hitler exists as a free Steam Workshop mod (not DLC), main mod ID 584715565 by FragaholiC; it appeared on TTS before the physical game's release; a "Clean" community version and the 2026-active "Secret Hitler: Consolidator Edition" (`LostSavage/SecretHitlerCE`) exist; Steam's content filter on "Hitler" causes occasional issues — [Steam Workshop discussion](https://steamcommunity.com/workshop/filedetails/discussion/584715565/412446292764486164), [Steam changelog](https://steamcommunity.com/sharedfiles/filedetails/changelog/584715565?p=2), [SecretHitlerCE on GitHub](https://github.com/LostSavage/SecretHitlerCE) (Steam pages not loadable; search-snippet level)

**Discord bots**
- Several bots listed on top.gg (IDs 784642754511765575, 691007847416201217): bot assigns roles randomly and DMs each player their role and allies, guides elections/legislation, players nominate/vote/veto via commands and reactions; "Secret Hitler Prime" adds private player threads, AI voice narration and a web dashboard — [top.gg bot](https://top.gg/bot/784642754511765575), [top.gg bot 2](https://top.gg/de/bot/691007847416201217), [SH Prime](https://discord.me/sh-prime) (snippet level)

### Inferences
- License implications for the new app: must be free, non-commercial, attribute Goat, Wolf & Cabbage, be CC BY-NC-SA itself, and should not be submitted to app stores → a PWA/web app is the natural (and practically only) distribution channel. Reskins (Voldemort/Palpatine/"Secret Table") are common partly to avoid the Hitler theme (Steam filter, sensitivity).
- Three distinct UX models exist: (a) remote lobby site with chat (SH.io), (b) room-code party app for friends, one device per player (secret-hitler.online, secrethitler.gg), (c) single-device pass-and-play or Jackbox-style shared screen + phones (trentpiercy, vicapow). A "play with friends, mostly in person or on a video call" app maps best to (b), optionally with a shared "board" screen like (c).
- secret-hitler.online is the closest model to the target app and shows typical friend-app gaps: kicking AFK players, mobile layout bugs, and logic bugs leaking/mislabeling roles at game end.

### Gaps
- No verifiable data on secret-hitler.online or secrethitler.live player numbers.
- Could not confirm the full feature set or maintenance status of the Discord bots and TTS mod (pages blocked).
- No evidence of any official app or official online version from Goat, Wolf & Cabbage; one snippet claimed one exists — unverified.
- No Phoenix/Elixir implementation of note found beyond a 2020 Elixir repo; no Firebase-backed clone was inspected in detail (secret-hitler.online only uses Firebase for static hosting).

## 3. Common UX patterns

### Takeaway
The converging pattern among friend-focused clones is: create table → share short room code/link → ready-check → private role reveal → tap-to-select nominations with confirmation → Ja/Nein ballots with simultaneous reveal → private, server-dealt policy hand for president then chancellor → shared boards/tracks → event log; chat is optional (useful remote, harmful in person), and in-person groups often prefer voice/real talk with the app only handling secret information.

### Cited Findings
- Room code or link to invite friends — [secret-hitler.online README](https://github.com/ShrimpCryptid/Secret-Hitler-Online); 8-character code or invite URL + ready-check; rejoin via browser cookie — [secrethitler.gg README](https://github.com/ItsJustMeChris/secrethitler.gg)
- Public lobby list + spectating (stranger-matchmaking model) — [cozuya README](https://github.com/cozuya/secret-hitler)
- Role reveal: pass-and-play "Flip card to see your role, tap to flip back over" — [trentpiercy README](https://github.com/trentpiercy/secret-hitler); private role via DM in Discord bots — [top.gg](https://top.gg/bot/784642754511765575)
- Action area: all turn decisions in one area under the boards; select portrait then inline confirmation; private info (investigation result) in popup that hides on window blur — [secrethitler.gg README](https://github.com/ItsJustMeChris/secrethitler.gg)
- Vote display: animated "show votes" reveal — [secret-hitler.online README (show-votes gif)](https://github.com/ShrimpCryptid/Secret-Hitler-Online); secrethitler.gg deliberately shows votes as submitted (non-simultaneous) — [README](https://github.com/ItsJustMeChris/secrethitler.gg)
- Shared screen + personal phones ("board/TV" view + "hand" view) — [vicapow README](https://github.com/vicapow/secret-hitler)
- Rules help built in ("instructions… and plenty of helpful tips for first-time players") — [secret-hitler.online README](https://github.com/ShrimpCryptid/Secret-Hitler-Online)
- Chat: SH.io has game chat, observer chat, claims, option to disable chat (`disableGamechat`) — [create-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/user-events/create-game.js); secrethitler.gg chat enforces legislative silence and dead-player silence — [README](https://github.com/ItsJustMeChris/secrethitler.gg); ftick has text + beta voice chat — [README](https://github.com/ftick/secret-hitler); requested chat in secret-hitler.online (#178) — [Issues](https://github.com/ShrimpCryptid/Secret-Hitler-Online/issues?q=is%3Aissue)
- Pass-and-play keeps social decisions offline "to maintain the spirit of the game" — [trentpiercy README](https://github.com/trentpiercy/secret-hitler)
- Mobile touch reliability matters: SH.io issue "Clicking 'ja' or 'nein' does not always register" (#273), "Votes occasionally are invisible" (#1417) — [issues](https://github.com/cozuya/secret-hitler/issues?q=is%3Aissue+mobile)
- Bots/AI fill seats (secret-hitler.online `CpuPlayer.java`; secrethitler.gg AI seats; Secret Table solo mode with 5 bots) — [ShrimpCryptid repo](https://github.com/ShrimpCryptid/Secret-Hitler-Online), [secrethitler.gg](https://github.com/ItsJustMeChris/secrethitler.gg), [secret-table-game](https://github.com/mertertek/secret-table-game)

### Inferences
- For a mobile-first friends app: big Ja/Nein buttons, single "what do I need to do now" action area, explicit confirm step for irreversible actions (nominate, execute, discard), "tap to reveal / hold to peek" for role & private info (protects against shoulder-surfing when playing in the same room), and a compact event log of public facts (governments, votes, enacted policies, claims if any).
- Make chat optional (off by default for in-person/video-call play).
- Bots are a nice dev/test tool (play 5–10 seats alone) even if not a user feature.

### Gaps
- No first-hand screenshots/UX study of secrethitler.io's mobile layout in 2026 (site blocked).

## 4. boardgame.io: secret state, multiplayer server, maintenance, SH implementations

### Takeaway
boardgame.io (MIT, ~12.4k★) supports per-player hidden state via `playerView` (with built-in `PlayerView.STRIP_SECRETS`) and server-only moves (`client: false`), and ships a multiplayer server, but its last npm release is 0.50.2 from Nov 2022; 2026 repo activity is only dependency/tooling maintenance. No notable Secret Hitler implementation on boardgame.io was found.

### Cited Findings
- Docs: "use the `playerView` setting in the game object… returns a version of `G` that is stripped of any information that should be hidden from that specific player"; `playerID` may be null for spectators; clients must be associated with individual players — [boardgame.io docs: secret-state.md](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/secret-state.md)
- `PlayerView.STRIP_SECRETS` removes `G.secret` and all entries of `G.players` except the requesting player's — [secret-state.md](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/secret-state.md)
- Moves that touch secret state can be marked `client: false` so they only run on the server — [secret-state.md](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/secret-state.md)
- Repo: MIT, ~12,451 stars, 67 open issues, description "State Management and Multiplayer Networking for Turn-Based Games", topics include react/react-native/multiplayer — [GitHub](https://github.com/boardgameio/boardgame.io)
- npm release history: 0.50.0 (Oct 2022), 0.50.1 (Oct 2022), 0.50.2 (10 Nov 2022) is the latest; package.json on main still `0.50.2` — [npm registry](https://registry.npmjs.org/boardgame.io)
- 2026 commits are maintenance only (Aug 2026: ESLint 9 flat config migration, Dependabot grouping, dev-dependency bumps, nanoid 6) — [commits](https://github.com/boardgameio/boardgame.io/commits/main)
- A 2026 third-party "boardgame-io skill" for AI coding agents targets v0.50.x and warns about "outdated APIs, hidden state-management pitfalls and broken UI wiring" (translated from Chinese description) — [liangdabiao/boardgame-io-skill](https://github.com/liangdabiao/boardgame-io-skill)

### Inferences
- boardgame.io would technically fit Secret Hitler (hidden roles in `G.players[id]`, deck in `G.secret`, `client:false` for draws), but with no release in ~4 years it is effectively in maintenance mode; for a small hobby app a plain Socket.IO/WebSocket server with a hand-written reducer + per-player projection (the SH.io pattern) is about as little code and avoids framework lock-in. Using boardgame.io is still a reasonable option if its lobby/turn-order helpers are wanted.
- Whatever framework: secret moves (draw 3 policies, peek, investigate) must run server-side; the client only receives the projection.

### Gaps
- boardgame.io docs site was blocked; did not verify the current state of its Lobby API/storage adapters or React 19 compatibility.
- Did not find any public Secret Hitler implementation built on boardgame.io (GitHub search for "secret hitler" surfaced none among the top results).

## 5. Lessons learned / pitfalls reported by developers

### Takeaway
Recurring pitfalls: leaking hidden info through state sent to clients or through bugs in per-role views/end screens; losing live games on server restart; AFK/disconnected players stalling a game (needs rejoin, timers, kick); mobile touch/layout problems; codebase rot from unreviewed contributions; and free-tier hosting limits/cold starts for hobby deployments.

### Cited Findings
- Role-visibility bugs in a popular clone: "Hitler role sees Fascist Players" (#202 — in 7+ player games Hitler must not know fascists), end screens mislabeling everyone as fascist (#204, #194, #191, #201) — [secret-hitler.online issues](https://github.com/ShrimpCryptid/Secret-Hitler-Online/issues?q=is%3Aissue)
- Restart drops games in in-memory designs ("a redeploy restarts the process and drops every live game") — [cozuya render.yaml](https://github.com/cozuya/secret-hitler/blob/main/render.yaml); mitigated in secret-hitler.online via periodic DB backup + restore on startup + backup in shutdown hook — [SecretHitlerServer.java](https://github.com/ShrimpCryptid/Secret-Hitler-Online/blob/development/backend/src/main/java/server/SecretHitlerServer.java)
- Horizontal scaling impossible without shared state (no socket.io Redis adapter → single instance) — [render.yaml](https://github.com/cozuya/secret-hitler/blob/main/render.yaml)
- AFK/kicking requests (#203, #183) — [secret-hitler.online issues](https://github.com/ShrimpCryptid/Secret-Hitler-Online/issues?q=is%3Aissue); SH.io solves with server-side timed mode and remake votes (code) — [routes/socket/game](https://github.com/cozuya/secret-hitler/tree/main/routes/socket/game)
- Reconnect by cookie/session so refresh doesn't lose the seat — [secrethitler.gg](https://github.com/ItsJustMeChris/secrethitler.gg); SH.io keeps the seat bound to the account after leaving (code) — [leave-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/user-events/leave-game.js)
- Stale room cleanup needed (8-hour cron in Meteor clone; lobby timeouts in secret-hitler.online) — [iamsammak README](https://github.com/iamsammak/secrethitler), [SecretHitlerServer.java](https://github.com/ShrimpCryptid/Secret-Hitler-Online/blob/development/backend/src/main/java/server/SecretHitlerServer.java)
- Input validation added late in SH.io (zod on all user inputs, June 2026) — clients can send arbitrary socket events — [commit log](https://github.com/cozuya/secret-hitler/commits/main)
- Free-tier limits: Secret Table's shared preview "can reach its hourly guest limit or slow down when several groups open it at the same time"; recommends per-group self-hosting — [secret-table-game README](https://github.com/mertertek/secret-table-game)
- Maintainability: unreviewed PRs produced "giant pasta style code" in SH.io — [README](https://github.com/cozuya/secret-hitler/blob/main/README.md)
- Original designers' prototyping note: secret information needs physical protection (envelopes) — analog of hiding private info on screen — [Max Temkin, "Prototyping Secret Hitler" (Medium)](https://medium.com/maxistentialism-blog/prototyping-secret-hitler-4ef23ccf727b) (snippet level)

### Inferences (concrete takeaways for a small mobile-first friends app)
1. Server-authoritative game state; per-player projection on every broadcast; spectators get public view only; write unit tests for the projection per role and player count (5–6 vs 7–10 Hitler knowledge rules) and for end-game reveal.
2. No accounts: room code + display name + a random per-device token in localStorage/cookie for reconnect; keep the seat on disconnect; show "disconnected" badge; host can kick/replace.
3. Persist each room's state (KV/DB snapshot after every action) so deploys/cold starts don't kill games; auto-expire rooms after a few hours.
4. Validate every client action on the server (phase, actor, legal target) with a schema library; never trust client-side rule checks.
5. Optional turn timer only; default off for friends.
6. Mobile: large tap targets, one action area, confirm dialogs, tap-to-reveal private info, no hover-dependent UI, test on iOS Safari; avoid heavy animations (SH.io users asked to disable them).
7. Chat optional; assume groups talk via voice/in person.
8. License: free, non-commercial, CC BY-NC-SA 4.0 attribution to Goat, Wolf & Cabbage; ship as PWA, not app-store app; consider a reskin/neutral theme.
9. Add CPU/bot seats or a dev "fill with bots" mode to test 5–10 player flows alone.

### Gaps
- No detailed postmortem/blog post by a Secret Hitler web-clone developer was found; lessons above are derived from code, READMEs and issue titles.
- No sourced evidence on devtools-based cheating specifically (as opposed to role leakage bugs); the risk is inferred from architecture.
