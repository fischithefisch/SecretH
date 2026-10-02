# Mobile UX, iOS Web-App (PWA) Capabilities and Data Usage for a Mobile-First "Secret Hitler" Web App (as of Oct 2026)

Research note: many primary sources (webkit.org, firt.dev, socket.io, HTTP Archive, MDN-like hosts, bugs.webkit.org) were blocked by the research environment's egress proxy, so several findings rely on search-engine snippets of those pages rather than full-page reads. Where a finding comes from a snippet, the URL is still the original page. Version-dependent claims are flagged. Current shipping versions at research time: iOS 26.x / Safari 26.x; Safari 27 announced at WWDC 2026 (likely shipping with iOS 27 in autumn 2026, not verified in detail).

## 1. What iOS Safari / Home-Screen Web Apps Can and Cannot Do in 2026

### Takeaway
A home-screen web app on iOS 26 is good enough for a turn-based party game: standalone mode, web push ("your turn" alerts, home-screen only), Screen Wake Lock (fixed for home-screen apps since iOS 18.4), and generous storage all work. Hard limits remain: no install prompt (manual "Share > Add to Home Screen"), no Vibration API, WebSockets die when the app is backgrounded or the screen locks (must design for reconnect), audio needs a user gesture, and pull-to-refresh/overscroll cannot be reliably disabled. The EU DMA scare of iOS 17.4 (removal of home-screen web apps) was reversed before release.

### Cited Findings

**Install flow / standalone / manifest**
- iOS has no `beforeinstallprompt` event and no standardized install prompt; users add web apps via Safari's Share button > "Add to Home Screen". — [frontendchecklist.io (snippet)](https://frontendchecklist.io/rules/html/pwa-installability)
- On iOS/iPadOS only `display: standalone` is supported; `minimal-ui` falls back to a browser shortcut and `fullscreen` falls back to standalone. — [web.dev / search snippet](https://web.dev/learn/pwa/installation?authuser=8)
- An `apple-touch-icon` link element, if present, overrides manifest icons on iOS. — [frontendchecklist.io (snippet)](https://frontendchecklist.io/rules/html/pwa-installability)
- One snippet claims iOS "doesn't honor `display: standalone` from the manifest" and requires `<meta name="apple-mobile-web-app-capable">`. This is contradicted by the iOS 26 behaviour below and by long-standing manifest support since iOS 11.3; treat it as outdated. — [frontendchecklist.io (snippet)](https://frontendchecklist.io/rules/html/pwa-installability); contradicted by [heise (snippet)](https://heise.de/-10749652)
- **iOS 26 change:** every website added to the Home Screen now opens as a web app (standalone) by default; the "Add to Home Screen" sheet has an "Open as Web App" toggle (on by default). If toggled off, a plain bookmark is created regardless of manifest/meta tags. Previously, standalone behaviour depended on the site's manifest/meta tags. — [heise.de, iOS 26 web-app behaviour (snippet)](https://heise.de/-10749652); [iThinkDiff](https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/); [mjtsai.com, Oct 3 2025](https://mjtsai.com/blog/?p=49472)

**EU / Digital Markets Act**
- In the iOS 17.4 betas (Feb 2024) Apple removed Home Screen web apps in the EU, citing DMA requirements (it would need an "entirely new integration architecture" for alternative browser engines). — [Slashdot/9to5Mac](https://apple.slashdot.org/story/24/02/15/2217201/apple-confirms-ios-174-removes-home-screen-web-apps-in-the-eu); [TechRadar](https://www.techradar.com/phones/say-goodbye-to-web-apps-ios-174-removes-useful-feature-on-iphones-in-the-eu)
- Apple reversed this on ~1 March 2024: Home Screen web apps continue in the EU, "built directly on WebKit and its security architecture", returning with the iOS 17.4 release. — [iMore](https://www.imore.com/ios/apple-backtracks-ios-174-web-app-changes-in-eu-just-weeks-after-citing-security-and-privacy-concerns); [ComputerBase](https://www.computerbase.de/2024-03/dma-apple-deaktiviert-progressive-web-apps-mit-ios-17-4-doch-nicht/)
- Consequence (inferred from Apple's statement): in the EU, home-screen web apps still always run on WebKit even if the user's default browser uses another engine.

**Web Push ("your turn" notifications)**
- Web Push and app badges arrived with iOS 16.4 (March 2023), **only for web apps added to the Home Screen**; not supported inside a Safari tab. — [MagicBell guide (snippet)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide); [Pushpad (snippet)](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)
- Permission (`Notification.requestPermission()`) must be triggered by a user gesture (e.g. button tap), not on page load. — [Pushpad (snippet)](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)
- Developers report push subscriptions on iOS sometimes "disappear without obvious reasons". — [MagicBell guide (snippet)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- **Declarative Web Push** (Safari 18.4 / iOS & iPadOS 18.4, home-screen web apps): subscription and visible notifications without a service worker; the declarative payload is shown as fallback if optional SW processing fails; backward compatible with classic Web Push. — [WebKit: Meet Declarative Web Push (snippet)](https://webkit.org/?p=16535); [WebKit Features in Safari 18.4 (snippet)](https://webkit.org/?p=16574)

**Screen Wake Lock (keep screen on)**
- Screen Wake Lock works in iOS Safari 16.4+, but a long-standing bug (WebKit #254545) broke it in home-screen web apps until Apple fixed it in **iOS 18.4**. — [Progressier (snippet)](https://progressier.com/pwa-capabilities/screen-wake-lock); [WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)

**Storage / eviction**
- Since Safari 17 / iOS 17: origin quota up to 60 % of disk for browser apps, up to 15 % for other apps (incl. web apps/WebViews); overall quota up to 80 % / 20 %. — [WebKit "Updates to Storage Policy" (snippet)](https://webkit.org/?p=14403)
- ITP 7-day cap (2020): after 7 days of Safari use without user interaction on a site, all script-writable storage (JS cookies, LocalStorage, IndexedDB, SessionStorage, service-worker registrations and caches) is deleted. — [Search Engine Land](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519); [Didomi](https://docs.didomi.io/releases-and-announcements/announcements/apple-implements-7-day-cap-on-script-writable-storage)
- Home Screen web apps are effectively exempt for their own domain: only JS-created cookies and CNAME-cloaked 3rd-party cookies are 7-day capped; server-set cookies and HTML storage should not be deleted. — [Search Engine Land / WebKit statement](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519)
- One secondary source says non-installed sites get ~50 MB across Cache Storage + IndexedDB; this conflicts with WebKit's Safari 17 policy above and is likely outdated. — [MagicBell (snippet)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) vs. [WebKit](https://webkit.org/?p=14403)

**Vibration / haptics**
- WebKit does not implement the Vibration API (removed from WebKit 11 May 2017); `navigator.vibrate` does nothing on iPhone; Apple has given no indication of support as of 2026. — [Bugnet blog](https://bugnet.io/blog/fix-web-game-vibrate-api-not-available-ios-safari); [Progressier](https://progressier.com/pwa-capabilities/vibration-api) (note: Bugnet says the function "exists but returns false"; other sources say it is simply absent/ignored — feature-detect either way)
- Workaround: `<input type="checkbox" switch>` (Safari 17.4+) triggers the Taptic Engine when toggled; libraries (e.g. web_haptics) inject a hidden switch + `<label>` and click the label. — [azukiazusa.dev](https://azukiazusa.dev/en/blog/ios-safari-web-haptics); [pub.dev web_haptics](https://pub.dev/documentation/web_haptics/latest/)
- **Flag:** two sources say programmatic triggering worked iOS 17.4–26.4 but Apple patched it in **iOS 26.5**, so JS-triggered haptics may no longer work; haptics on a genuine user tap of a real switch presumably still work. Not verified first-hand. — [Bugnet](https://bugnet.io/blog/fix-web-game-vibrate-api-not-available-ios-safari); [web-haptics browser support](https://www.mintlify.com/lochie/web-haptics/advanced/browser-support)

**Audio**
- iOS Safari requires a real user gesture to start audio; muted/no-audio video may autoplay; unmuting without a gesture pauses playback. — [WebKit "New video Policies for iOS"](https://webkit.org/blog/6784/)
- Web Audio defaults to the "ambient" session and is muted by the ring/silent switch, while HTML `<audio>` keeps playing; `navigator.audioSession.type = "playback"` (Safari 17+) prevents muting. — [WebKit bug 264473 (snippet)](https://bugs.webkit.org/show_bug.cgi?id=264473); [swevans/unmute](https://github.com/swevans/unmute)

**Background / WebSocket lifetime (critical for a multiplayer game)**
- Since iOS 15, WebSocket connections get closed when the user switches apps; typically ~1 minute after backgrounding; also on screen lock/unlock, both in Safari and home-screen apps. After long inactivity `onclose`/`onerror` may not fire, leaving a dead socket that looks open. — [Apple Developer Forums thread 696310](https://developer.apple.com/forums/thread/696310); [Bubble forum](https://forum.bubble.io/t/re-establishing-web-socket-for-pwa/249335); [SharpTools community](https://community.sharptools.io/t/background-network-disconnected-reload/13815)

**Pull-to-refresh / overscroll / viewport**
- `overscroll-behavior` is listed as supported since Safari 16, but WebKit bug 275947 reports `overscroll-behavior: none/contain` does not disable pull-to-refresh on iOS Safari. In home-screen web apps there is no pull-to-refresh at all (which can be a problem if the app gets stuck). — [WebKit bug 275947](https://bugs.webkit.org/show_bug.cgi?id=275947); [TMS support thread](https://support.tmssoftware.com/t/pull-to-refresh-again/26279)

### Inferences
- **Recommend "install" but don't require it.** Joining via link in Safari must work fully; offer an "Add to Home Screen" coach-mark (iOS-only, detect `navigator.standalone`/`display-mode: standalone`) for players who want push and wake-lock-in-standalone. Since iOS 26 every added site opens standalone by default, so a correct manifest + `apple-touch-icon` suffices.
- **Push for "your turn" is viable but optional**: only works after home-screen install + explicit tap-to-enable; subscriptions may silently vanish. Since friends are usually in the same room/call, push is a nice-to-have, not core. Server must not rely on it.
- **Wake Lock**: request on game start (needs secure context, re-request on `visibilitychange`), works in Safari tab (16.4+) and standalone (18.4+). This also mitigates the WebSocket-dies-on-lock problem.
- **Design for reconnects as the normal case**: server-authoritative state, idempotent "resync full state" on reconnect, reconnect on `visibilitychange`/`pageshow`/`online`, stable player identity via a token in localStorage/cookie (rejoin same seat), and a visible "reconnecting…" banner.
- **Haptics**: treat as decoration only; do not depend on them (Vibration API absent, switch hack possibly patched in 26.5). Use visual + optional sound cues instead.
- **Audio**: unlock on first tap ("Join game" button), set `navigator.audioSession.type = "playback"` only if sounds matter even in silent mode — for a social game it is arguably more polite to respect the silent switch (default ambient).
- **Viewport (from general platform knowledge, not re-verified here)**: use `viewport-fit=cover` + `env(safe-area-inset-*)` for notch/Dynamic Island/home indicator; use `100dvh`/`100svh` (Safari 15.4+) instead of `100vh`; prevent double-tap zoom with `touch-action: manipulation`; inputs ≥16px font to avoid auto-zoom on focus; avoid `user-scalable=no` for accessibility (iOS ignores it anyway since iOS 10).

### Gaps
- Could not read firt.dev's iOS PWA compatibility table or WebKit blog posts in full (egress blocked); exact Safari 26/27 PWA additions (e.g., any new manifest fields in Safari 26/27) not verified.
- Exact iOS 26.5 haptics patch details could not be confirmed against a primary Apple/WebKit source.
- No source found on whether iOS 27 (autumn 2026) changes background WebSocket behaviour or push reliability.
- Safe-area/dvh/zoom facts in Inferences are from general knowledge; caniuse/MDN pages were not fetched.

## 2. UX Patterns for Hidden-Role Party Games on Phones

### Takeaway
The proven pattern (Jackbox, werewolf/mafia narrator apps) is: join via short room code/link with no app install, each phone shows private info only to its owner, the app acts as narrator/moderator and tracks state. For Secret Hitler on phones, the key screens are: lobby/join, private role reveal (tap-and-hold, auto-hide), simultaneous Ja/Nein voting with dramatic reveal, private legislative hand (President discards 1 of 3, Chancellor enacts 1 of 2), a persistent "what's happening / who are we waiting for" status bar, and a board/log view. Assume players talk by voice (same room or call); text chat is optional.

### Cited Findings
- Jackbox's core differentiator: players use their own smartphone as controller by entering a shared room code on a web page — "no additional app to download". — [Built In: Jackbox design principles (snippet)](https://builtin.com/media-gaming/jackbox-games-design-party-pack)
- Phone-as-controller limits UI complexity ("you can't feasibly cram a dozen buttons… on an iPhone"), and constraints drive design. — [Built In (snippet)](https://builtin.com/media-gaming/jackbox-games-design-party-pack)
- Phones enable private, per-player information that a shared controller can't — e.g. Jackbox "Push the Button" secretly assigns alien roles via phones; quote: "You can't do that on the PlayStation controller, because you can't assign player roles like that. That's just the kind of game that only works on a phone." — [Built In (snippet)](https://builtin.com/media-gaming/jackbox-games-design-party-pack)
- Jackbox separates the shared game screen (hosted/streamed) from personal controllers; this works for remote play via screen sharing. — [thewearify.com](https://thewearify.com/can-you-play-jackbox-online/)
- Werewolf/Mafia apps use two models: pass-and-play on one phone (e.g. Wolvesville Classic: "pass the phone, assign players") and host-deals-roles-to-everyone's-device with the app tracking state (timers, deaths, reveals). — [Wolvesville Classic listing](https://spark.mwm.ai/en/apps/wolvesville-classic/1322989325); search snippet summarizing companion apps
- Narrator apps (Werewords, Mafia Moderator) automate night-phase scripts, timers, role assignment, phase announcements and voting so nobody sits out as moderator; reviewers note the app solves the problem of reading scripts with eyes closed without revealing yourself by voice (cited re Avalon). — [Werewords app](https://spark.mwm.ai/en/apps/werewords/1243586902); [Mafia Moderator (App Store)](https://apps.apple.com/app/id1139338408); [Werewolf – Narrator (App Store)](https://apps.apple.com/app/id1505233252)
- Official Secret Hitler has a companion app (Wil Wheaton narration) for iOS/Android, a browser version with private lobbies, and Discord bots that handle setup, role assignment, policy enactment and vote tracking. — [Wikipedia: Secret Hitler](https://en.wikipedia.org/wiki/Secret_Hitler); [top.gg Secret Hitler bot](https://top.gg/bot/784642754511765575)
- In online Secret Hitler sessions players mix phones and laptops. — [Mechanics of Magic critical play](https://mechanicsofmagic.com/2021/04/08/critical-play-secret-hitler/)
- Accessibility: the physical game never uses colour as the primary information channel — policies carry large iconography and text, Liberal/Fascist boards differ in art style, and roles are distinguished by artwork (people vs. anthropomorphic animals); Meeple Like Us "strongly recommends" it for colourblind players. — [Meeple Like Us accessibility teardown](https://www.meeplelikeus.co.uk/secret-hitler-2016-accessibility-teardown/)

### Inferences (design recommendations; not individually sourced)
- **Join**: 4–5 character room code (unambiguous alphabet, no 0/O/1/I), share link via Web Share API (`navigator.share`, works in iOS Safari) to WhatsApp/Signal, and a QR code on the host's screen for in-room joins. Nickname only, no account. Reconnect token so a player who closes Safari rejoins their seat.
- **Role reveal / anti-shoulder-surfing**: card face-down by default; "press and hold to peek" (shows while finger is down, hides on release), auto-hide after a few seconds and when app goes to background; fascists additionally see teammates (and Hitler in 5–6 player games — per rules). Avoid persistent role colour in UI chrome (e.g., background tint) — a classic leak when someone glances at a neighbour's phone. Keep the same screen layout/timing for every role so the act of peeking doesn't leak information.
- **Voting**: two big Ja!/Nein! cards (thumb zone, ≥44pt targets per Apple HIG), selectable and changeable until everyone voted, show "7/9 voted" without revealing who voted what, then simultaneous reveal animation on all phones plus result summary. Keep vote-pending indication neutral.
- **Legislative session**: President sees 3 policy cards, taps one to discard (confirm step to prevent misclicks), Chancellor sees 2, taps one to enact; Veto option once unlocked (5 fascist policies). Everyone else sees "President is choosing…" / "Chancellor is choosing…" — no timing hints beyond that. Discarded cards never sent to other clients (server-side secrecy; also an anti-cheat requirement since browser devtools expose everything received).
- **Status clarity**: persistent top bar "Phase: Election — Waiting for: Anna, Ben" + role-specific call to action highlighted when it's *your* action; subtle sound/haptic only when it's your turn.
- **Board/log**: compact tracks (Liberal 5 slots, Fascist 6 slots, election tracker 3), player list with president/chancellor placards and term-limit markers, dead players greyed, scrollable game log (who nominated whom, vote results per player — votes are public in Secret Hitler after reveal, policies enacted, executive actions, claims are *verbal* and not tracked by the app unless an optional "claim" feature is added).
- **Chat**: assume same room or voice call (Discord/WhatsApp); text chat on a phone competes with the core social interaction and keyboard covers half the screen. Optional: quick emoji reactions or preset "claims" (e.g., "I got 3 fascist") for remote groups.
- **Colours/accessibility**: never encode Liberal/Fascist by colour alone — pair blue/red-orange with icons (dove/eagle-skull equivalents, avoiding original copyrighted art) and text labels; test with deuteranopia/protanopia simulators; support Dynamic Type-ish scaling (rem units), sufficient contrast, VoiceOver labels for cards (but caution: screen readers announce secret info aloud — warn users).
- **One-hand portrait layout**: primary actions in bottom third, no landscape requirement, avoid hover-dependent interactions, avoid small tap targets for player selection (list rows, not tiny avatars around a circle on 5.4–6.9" screens).

### Gaps
- Could not fetch first-hand UX writeups of secrethitler.io's mobile layout, Codenames online, or official Avalon/Secret Hitler companion apps; no reliable user research on hidden-role reveal patterns was found — recommendations above are design inference.
- No published Jackbox latency/UX metrics found.

## 3. Pass-and-Play vs. Own Phone vs. Shared Board + Phone Controllers

### Takeaway
For 5–10 friends who each have an iPhone (in the same room or remote), "each player on own phone" is the best default; an optional shared "board" view (TV/tablet/laptop, or a screen-shared tab on a call) is a cheap and valuable add-on. Pass-and-play is a poor fit for Secret Hitler because of frequent private actions by different players.

### Cited Findings
- Pass-and-play works for simple role dealing (Wolvesville Classic "pass the phone, assign players"). — [Wolvesville Classic](https://spark.mwm.ai/en/apps/wolvesville-classic/1322989325)
- Own-device model: host deals roles to everyone's device; the app tracks game state. — search snippet on companion apps (see Section 2 sources)
- Jackbox shared-screen + phone controller model: no install, room code, private info per phone, and works remotely by screen-sharing the main screen. — [Built In](https://builtin.com/media-gaming/jackbox-games-design-party-pack); [thewearify.com](https://thewearify.com/can-you-play-jackbox-online/)

### Inferences
| Model | Pros | Cons |
|---|---|---|
| Pass-and-play (1 phone) | No connectivity/server needed; trivial to start | Secret Hitler needs private input every round (votes by all, President/Chancellor hands, investigations, peeks) — constant passing is slow and leaks info (timing, reflections); votes in the physical game are simultaneous; unusable remotely |
| Own phone each (server-synced) | Perfect privacy, simultaneous voting, works in-room and remote, app can enforce rules/term limits | Every player needs connectivity and battery; iOS backgrounding drops sockets; onboarding 5–10 people (link/QR mitigates) |
| Shared board + phones (Jackbox-style) | Big public board for tracks/log/animations, phones stay simple (private info + buttons), great in-room atmosphere | Requires a second screen; remote players need screen share; extra "board" client to build — but can be the same web app in a `/board` view |

- Recommended: own-phone as core; every phone also shows a compact public board; add optional `/board/:room` read-only view for TV/laptop (cast or screen share). Unlike Jackbox, Secret Hitler should not require the shared screen.

### Gaps
- No quantitative studies comparing these modes for hidden-role games were found.

## 4. Data Usage Estimate per Game

### Takeaway
A well-built game uses roughly **0.3–1.5 MB per player for the first game** (dominated by the one-time app download) and **~0.1–0.5 MB per subsequent game** with cached assets; even a pessimistic implementation stays under ~3–5 MB per 45-minute game. That is less than 5–10 minutes of a WhatsApp voice call (≈0.3–0.5 MB/min) and less than one minute of a video call (≈5 MB/min). If players are simultaneously on a voice/video call, the call dominates data use by 10–100×.

### Cited Findings
- HTTP Archive Web Almanac 2025: median mobile home page ≈ 2,164 KB (another source cites ~2.56 MB); median mobile JS ≈ 632 KB; median page makes ~24 JS requests vs 18 images. — [Web Almanac 2025 Page Weight (snippet)](https://almanac.httparchive.org/nl/2025/page-weight); [CaptainDNS summary](https://www.captaindns.com/en/blog/median-web-page-weight-2025)
- Socket.IO server defaults: `pingInterval` 25,000 ms, `pingTimeout` 20,000 ms, `maxHttpBufferSize` 1 MB. — [Socket.IO server options (snippet)](https://socket.io/zh-CN/docs/v4/server-options/); [django-sio docs](https://django-sio.readthedocs.io/en/latest/topics/configuration.html)
- Engine.IO v4 heartbeat: server sends packet type "2" (ping), client answers "3" (pong); each packet is its own WebSocket frame. Payload is thus 1 byte each. — [Engine.IO protocol](https://socket.io/docs/v4/engine-io-protocol/)
- permessage-deflate on short JSON messages: compression ratio ~0.30 with context takeover vs ~0.84 without; costs ~300 KB extra server memory per connection. — [IETF hybi list, permessage-deflate statistics](https://mailarchive.ietf.org/arch/msg/hybi/F9t4uPufVEy8KBLuL36cZjCmM_Y/); [igvita.com](https://www.igvita.com/2013/11/27/configuring-and-optimizing-websocket-compression/)
- WhatsApp voice ≈ 0.3–0.5 MB/min (≈18–30 MB/h); video ≈ 5 MB/min (≈300 MB/h, up to ~480 MB/h HD). — [Firsty, 2026](https://www.firsty.app/help/general/how-much-data-does-whatsapp-use); [BreezeSIM](https://breezesim.com/blogs/news/whatsapp-call-data-usage)
- iOS closes WebSockets on backgrounding/lock → reconnects (each with fresh handshake + state resync) are expected. — [Apple Developer Forums](https://developer.apple.com/forums/thread/696310)

### Inferences (calculation with explicit assumptions)

**A. Initial app download (one-time, cached by service worker / HTTP cache afterwards)**
| Component | Assumption | Size (Brotli/compressed) |
|---|---|---|
| HTML + JS bundle | Svelte/Preact/Solid ≈ 40–80 KB; React + router + Socket.IO client ≈ 120–200 KB | 40–200 KB |
| CSS | utility or hand-written | 5–20 KB |
| Fonts | 1–2 WOFF2 subsets (Latin) | 20–60 KB |
| Card/board/role art | SVG icons/illustrations 50–200 KB; or raster WebP for ~10 role/policy cards at 2× retina ≈ 20–50 KB each → 200–500 KB | 50–500 KB |
| Sounds (optional) | 5–10 short Opus/AAC clips ≈ 5–20 KB each | 0–150 KB |
| Manifest + icons | apple-touch-icon 180px + manifest icons | 10–40 KB |
| **Total** | | **≈ 0.15–1 MB** (well below the 2.2 MB median page) |

**B. Connection setup**: TLS 1.3 handshake incl. certificate chain ≈ 4–6 KB; Socket.IO handshake (HTTP long-polling open + WebSocket upgrade) ≈ 2–4 KB incl. HTTP headers → ≈ 5–10 KB per (re)connect.

**C. Heartbeat**: 1-byte ping + 1-byte pong; per message add WebSocket frame header (2 B server→client, 6 B client→server incl. mask), TLS 1.3 record overhead (~22 B), TCP/IP headers (~52–66 B) + TCP ACKs → ≈ 250–350 B per ping/pong exchange. 45 min / 25 s = 108 exchanges → **≈ 30–40 KB per game** (≈ 40–50 KB/h). Negligible.

**D. Game events** (Secret Hitler: typically ~6–12 legislative rounds; per round: nomination, 5–10 votes, vote reveal, draw/discard/enact, sometimes executive action → ~15–30 server broadcasts per client per round plus ~1–3 client actions):
- Event/diff protocol (≈100–300 B JSON each, ~0.3 compression ratio with deflate or not compressed): 12 rounds × 30 msgs × ~250 B + per-packet TCP/TLS overhead (~100 B) ≈ **~130 KB**.
- Naive full-state broadcast (≈2–5 KB JSON for 10 players with log, sent on each change): 12 × 30 × 4 KB ≈ **~1.5 MB** uncompressed, ~0.4–0.6 MB with permessage-deflate.

**E. Reconnects** (iOS backgrounding/lock): assume 5–20 per player per game × (5–10 KB handshake + 2–5 KB full state resync) ≈ **35–300 KB**. Plus optional HTML/manifest revalidation on resume (few KB).

**F. Optional push notifications**: ~1–4 KB each incl. APNs overhead (estimate) — negligible.

**Totals per player per 30–45 min game**
| Scenario | First game | Repeat game (assets cached) |
|---|---|---|
| Lean (diffs, SVG, few reconnects) | ≈ 0.3–0.5 MB | ≈ 0.1–0.2 MB |
| Typical (React, WebP art, ~10 reconnects) | ≈ 0.8–1.5 MB | ≈ 0.2–0.5 MB |
| Pessimistic (full-state broadcasts uncompressed, heavy art, many reconnects, no caching) | ≈ 3–5 MB | ≈ 2–3 MB |

- Comparison: a 45-min WhatsApp voice call ≈ 14–23 MB; a 45-min video call ≈ 225 MB (≈5 MB/min). So the game itself ≈ the data of 1–3 minutes of voice call, or well under one minute of video call. For the whole group of 10 players, server egress is ~10× the per-player figure (≈ 2–15 MB per game for the typical case) — trivial for any hosting.
- Design levers: send event diffs not full state; enable Brotli for static assets and long cache headers with hashed filenames; precache via service worker; SVG for board/cards; keep Socket.IO default heartbeat (or plain WebSocket with app-level ping ≥25 s); compress only if messages are large (deflate memory cost per connection).

### Gaps
- No measured data from an actual Secret Hitler implementation (e.g., secrethitler.io network traces) was available; all game-traffic numbers are modelled estimates.
- Exact TLS/TCP overhead varies (IPv6 adds 20 B/packet; HTTP/2 vs HTTP/1.1 upgrade; mobile carrier proxies); the HTTP Archive full chapter could not be fetched to confirm per-resource-type medians (CSS/fonts/images) for 2025.
- Number of reconnects per game on iOS is an assumption (depends on whether players lock their phones; Wake Lock reduces it).
