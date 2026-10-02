# Secret Hitler – Complete Official Rules (Implementation Spec) + Variants

Research notes, 2026-10-02. Source situation (important for the report writer):
- The official rules PDF (https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf) and its mirrors (nastol.io, lot.ahml.info), Wikipedia, BGG and secrethitler.io were all **blocked by this session's egress proxy** for direct fetching. Official-PDF wording below therefore comes from (a) search-engine extracts that index the official PDF, and (b) the rules page of the open-source secrethitler.io implementation, which is close to a copy of the official text and which I read in full from its GitHub source (`views/page-rules.pug`) and its GitHub wiki (`Rules.md`).
- The secrethitler.io game engine source (github.com/cozuya/secret-hitler, branch `main`, commit 7e3a201, June 2026) was read directly and is cited for exact implemented behavior. It is a fan implementation, not official ("this site and code is not an official version or associated with the original creators of the board game" — [About wiki](https://github.com/cozuya/secret-hitler/wiki/About-Secret-Hitler)).
- Abbreviations: "SH.io rules" = https://secrethitler.io/rules (same text: [wiki Rules](https://github.com/cozuya/secret-hitler/wiki/Rules), [page-rules.pug](https://github.com/cozuya/secret-hitler/blob/main/views/page-rules.pug)); "Official PDF" = https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf (via search extracts).

## Q1. Player counts, roles, and who knows whom

### Takeaway
5–10 players; Fascists = 1+Hitler (5–6), 2+Hitler (7–8), 3+Hitler (9–10); Liberals are the rest. Fascists always know each other and Hitler; Hitler knows the Fascist(s) only in 5–6 player games.

### Cited Findings
- Role table (players → Liberals / Fascists / Hitler knows Fascists?): 5 → 3 / 1+H / Yes; 6 → 4 / 1+H / Yes; 7 → 4 / 2+H / No; 8 → 5 / 2+H / No; 9 → 5 / 3+H / No; 10 → 6 / 3+H / No — [SH.io rules](https://secrethitler.io/rules); identical in [page-rules.pug](https://github.com/cozuya/secret-hitler/blob/main/views/page-rules.pug)
- "Fascists know the identities of the other Fascists and Hitler. Hitler plays for the Fascist team, but doesn't know who the other Fascists are and must work to figure them out." (general statement; the table gives the 5–6p exception) — [SH.io rules](https://secrethitler.io/rules)
- Engine constants: 5–6p `fascistCount=1, hitKnowsFas=true`; 7–8p `fascistCount=2, hitKnowsFas=false`; 9–10p `fascistCount=3, hitKnowsFas=false`; game "type" = floor((players−5)/2) — [start-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/start-game.js)
- Official night-phase script, 5–6 players: "Everybody close your eyes." → "Fascist and Hitler, open your eyes and acknowledge each other." → "Everyone close your eyes and put your hands down." → "Everyone can open your eyes." — Official PDF via search extract ([nastol.io mirror](https://nastol.io/storage/games/files/secret_hitler/931249/Secret_Hitler_Rules.pdf), [tuni.fi](https://www.tuni.fi/playlab/?p=1757))
- Official night-phase script, 7–10 players: "Everybody close your eyes and extend your hand into a fist in front of you." → "All Fascists who are NOT Hitler should open their eyes and acknowledge each other." → "Hitler – keep your eyes closed but put your thumb out into a thumbs-up gesture." → "Fascists, take note of who has an extended thumb – that player is Hitler." → "Everyone close your eyes and put your hands down." → open eyes — same sources as above.
- Each player has two hidden cards: a **Secret Role** card (Liberal / Fascist / Hitler) and a **Party Membership** card (Liberal / Fascist; Hitler's shows Fascist). Investigation reveals only the Party Membership card — [SH.io rules](https://secrethitler.io/rules) ("not the secret role card that also reveals whether the player is Hitler or not, just whether he's a Liberal or Fascist")
- Credits/licence: designed by Max Temkin, Mike Boxleiter, Tommy Maranges, illustrated by Mackenzie Schubert; licensed CC BY-NC-SA 4.0 — [About wiki](https://github.com/cozuya/secret-hitler/wiki/About-Secret-Hitler)

### Inferences
- Digital "night phase" = per-player private reveal: Liberal sees only self; Fascist sees all Fascists + Hitler; Hitler sees Fascist(s) iff playerCount ≤ 6.
- Liberals always have a strict majority of seats (3/5, 4/6, 4/7, 5/8, 5/9, 6/10), but not always a majority at 7 and 9 relative to "voting power" after executions.

### Gaps
- Could not read the official PDF directly to confirm exact verbatim of the night-phase script (taken from search extracts).

## Q2. Setup: deck, reshuffle, discard pile

### Takeaway
Policy deck = 17 tiles (6 Liberal, 11 Fascist), shuffled. Whenever fewer than 3 tiles remain in the draw pile (checked at the end of each Legislative Session and after a chaos top-deck), the remaining draw pile is shuffled together with the discard pile into a new deck; enacted policies never return. Discarded/unused tiles are never revealed.

### Cited Findings
- "The 11 Fascist Policy tiles and the 6 Liberal Policy tiles are shuffled into a single Policy deck." — [SH.io rules](https://secrethitler.io/rules)
- "If there are fewer than three tiles remaining in the Policy deck at the end of a Legislative Session, they are shuffled with the Discard pile to create a new Policy deck. Unused Policy tiles are not revealed." — [SH.io rules](https://secrethitler.io/rules)
- Same check after chaos: "If there are fewer than three tiles remaining in the Policy deck at this point, they are shuffled with the Discard pile to create a new Policy deck." — [SH.io rules](https://secrethitler.io/rules)
- Engine: reshuffle rebuilds the deck as (6 − enacted liberals) Liberal + (11 − enacted fascists) Fascist tiles, i.e. everything not on the tracks; triggered when `undrawnPolicyCount < 3` at start of each election, before Policy Peek, and after chaos/veto-chaos — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js), [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js), [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)
- Engine announces "Deck shuffled: X liberal and Y fascist policies." to all players (public info, since composition is derivable from the tracks) — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js)
- Physical components (boards): one Liberal board and three Fascist boards (5–6, 7–8, 9–10 players); election tracker lives on the Liberal board — [SH.io rules](https://secrethitler.io/rules) (board variants), [start-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/start-game.js) (power layouts)

### Inferences
- Because the check runs after every session/chaos, the deck always holds ≥3 tiles when a President draws or peeks; "deck runs out during Policy Peek" cannot happen under correct rules. A defensive implementation should still reshuffle before peek (as SH.io does).
- Simplest faithful model: `drawPile`, `discardPile`, `liberalTrack`, `fascistTrack`; reshuffle = `drawPile = shuffle(drawPile ∪ discardPile)`, `discardPile = []`.
- 17 tiles / 3 per session → first reshuffle normally after the 5th legislative session (17 − 15 = 2 < 3), earlier if chaos top-decks occurred.

### Gaps
- No official statement on whether players may count/know the deck size; physically it is visible, so treat draw-pile and discard-pile counts as public.

## Q3. Turn structure: presidency rotation, nomination, eligibility, voting, legislative session, communication

### Takeaway
Round = Election → Legislative Session → (optional) Executive Action. Presidency passes to the next living player; President nominates an eligible Chancellor; everyone alive votes Ja/Nein simultaneously; strict majority of Ja needed (tie fails). President draws 3, discards 1 face down, passes 2; Chancellor discards 1, enacts 1. No communication between them during the session.

### Cited Findings
- First President chosen randomly (physical game); afterwards "At the beginning of a new round, the President placard moves ... to the next player, who is the new Presidential Candidate." SH.io says "moves right"; official-PDF extracts describe the placard "pass[ing] to the left" (clockwise). — [SH.io rules](https://secrethitler.io/rules); [search extract of Official PDF/ultraboardgames](https://www.ultraboardgames.com/secret-hitler/game-rules.php) (direction wording differs; irrelevant for digital = "next seat index").
- Engine: next president = next seat index, skipping dead players, wrapping around — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js)
- Nomination: "The Presidential Candidate chooses a Chancellor Candidate by selecting any other eligible player." — [SH.io rules](https://secrethitler.io/rules)
- Eligibility: "The last elected President and Chancellor are 'term-limited', and ineligible to be nominated as Chancellor Candidate." Clarifications: term limits apply to the last **elected** pair, not last nominated; they only affect Chancellor nominations ("anyone can be President, even someone who was just Chancellor"); "If there are only five players left in the game, only the last elected Chancellor is ineligible to be Chancellor Candidate; the last President may be nominated." — [SH.io rules](https://secrethitler.io/rules)
- Engine eligibility filter: not self, not dead, and if `livingPlayerCount > 5` not in `previousElectedGovernment` [pres, chanc], else only not the previous Chancellor — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js)
- Engine sets `previousElectedGovernment = [president, chancellor]` as soon as a government is elected (before policies are played) — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- Voting: "All players, including the President and Chancellor Candidate, vote on the proposed government. Once everyone has cast their vote, the Ballot cards are revealed simultaneously." "If the vote is a tie, or if a majority of players votes no: The vote fails ... the President placard moves to the next player. The Election Tracker is advanced by one." — [SH.io rules](https://secrethitler.io/rules)
- Engine majority: passes iff (Ja votes of living players) / livingPlayerCount > 0.5 — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- Players may discuss the proposed government before voting; individual votes are public once revealed (ballots shown face up) — [SH.io rules](https://secrethitler.io/rules)
- Legislative session: "The President draws the top three tiles from the Policy deck, looks at them in secret, and discards one tile face down into the Discard pile. The remaining two tiles go to the Chancellor, who in secret discards one Policy tile face down, and enacts the remaining Policy by placing the tile face up on the corresponding track." — [SH.io rules](https://secrethitler.io/rules)
- Communication (official): "Verbal and nonverbal communication between the President and Chancellor is forbidden"; they "may not pick Policies to play at random, shuffle the tiles before discarding one, or do anything else clever to avoid secretly and intentionally selecting a Policy"; the President should hand both Policies over at the same time; discarded tiles are never revealed; players rely on the word of President/Chancellor "who are free to lie." — Official PDF via search extract ([secrethitler.com PDF](https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf), [officialgamerules.org](https://officialgamerules.org/game-rules/secret-hitler/))
- SH.io implements this as: "The chat for the President and Chancellor is disabled during the Legislative Session." — [SH.io rules](https://secrethitler.io/rules)
- "You can always lie about hidden knowledge in Secret Hitler." (policies seen, investigation results) — [SH.io rules](https://secrethitler.io/rules)

### Inferences
- State machine: `NOMINATE → VOTE → (fail: tracker++ → chaos? → next president) | (pass: Hitler check → PRES_DISCARD → CHANC_DISCARD [→ VETO step if unlocked] → ENACT → win check → POWER? → next president)`.
- Majority is over **living** players (dead don't vote); abstention isn't in the rules — a digital version should require every living player to vote (or use a timer default).
- After a policy is enacted, players (outside the session) typically "claim" what they saw; SH.io offers structured claim buttons, a site feature not an official rule.

### Gaps
- First-president selection: official text not retrieved verbatim (commonly "randomly pick the first Presidential Candidate"); SH.io picks randomly.

## Q4. Election tracker and chaos

### Takeaway
Each failed vote (and each veto) advances the tracker. On the 3rd consecutive failure the top deck tile is enacted immediately ("chaos"): its presidential power is ignored, the tracker resets, all term limits are cleared. Any policy enactment (for any reason) resets the tracker.

### Cited Findings
- "If the group rejects three governments in a row, the country is thrown into chaos. The next Policy on the top of the deck is revealed and enacted. Any power granted by this Policy is ignored, but the Election Tracker resets, and any existing term-limits are forgotten." "Any time a new Policy is enacted for any reason, the Election Tracker is reset." — [SH.io rules](https://secrethitler.io/rules)
- Official (search extract): "Whenever three consecutive elections have failed, the policy from the top of the draw pile is enacted without oversight by the President or the Chancellor ... the Election Tracker is also reset when a new policy is enacted by the Chancellor." — [search extract, SH rules/rulespal](https://rulespal.com/secret-hitler/rulebook)
- Engine: `failedElection` → `electionTrackerCount++`; if ≥3 → `previousElectedGovernment = []`, top policy enacted, power suppressed (powers only granted when `electionTrackerCount <= 2`), reshuffle if <3 left; tracker reset to 0 on enactment — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- Veto also advances tracker and can trigger chaos (see Q6) — [SH.io rules](https://secrethitler.io/rules), [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)

### Inferences
- Chaos policy still counts toward win conditions (5th Liberal / 6th Fascist ends the game), unlocks veto if it is the 5th Fascist, and moves the game into "Hitler zone" if it is the 3rd Fascist — all follow from "enacted" with only the power ignored. SH.io's `enactPolicy` runs the same win checks.
- After chaos, the presidency continues with the next player in normal rotation (the failed candidate's successor).
- A successful election resets nothing by itself; only an enactment resets the tracker. Thus "vote passes, then veto" leaves the tracker incremented (not reset).

### Gaps
- None material.

## Q5. Fascist boards and presidential powers

### Takeaway
Powers by fascist-policy slot (1–5; slot 6 = Fascist win): 5–6p: –, –, Policy Peek, Execution, Execution(+Veto). 7–8p: –, Investigate, Special Election, Execution, Execution(+Veto). 9–10p: Investigate, Investigate, Special Election, Execution, Execution(+Veto). Powers are mandatory, single-use, used by the President who enacted that Fascist policy.

### Cited Findings
- Engine power arrays (index = fascist policy number − 1): 5–6p `[null, null, "deckpeek", "bullet", "bullet"]`; 7–8p `[null, "investigate", "election", "bullet", "bullet"]`; 9–10p `["investigate", "investigate", "election", "bullet", "bullet"]`; `hitlerZone = 3`, `vetoZone = 5` — [start-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/start-game.js)
- "If the newly-enacted Fascist Policy grants a Presidential Power, the President must use it before the next round can begin ... Gameplay cannot continue until the President uses the power. Presidential Powers are used only once; they don't stack or roll over to future turns." — [SH.io rules](https://secrethitler.io/rules)
- **Investigate Loyalty**: President chooses a player; that player shows their Party Membership card to the President only; President may share or lie; "No player may be investigated twice in the same game." Official wording: the President investigates "another player who has not yet been investigated" by saying "I formally investigate [player name]"; the card is checked in secret and returned. — [SH.io rules](https://secrethitler.io/rules); official wording via [search extract](https://ultraboardgames.com/secret-hitler/game-rules.php)
- Engine: investigate targets = not self, not dead, not `wasInvestigated` — [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)
- **Call Special Election**: "The President chooses any other player at the table to be the next Presidential Candidate. Any player can become President—even players that are term-limited. The new President nominates an eligible player as Chancellor Candidate and the Election proceeds as usual." "A Special Election does not skip any players. After a Special Election, the President placard returns to the [next player after] the President who enacted the Special Election." "If the President passes the presidency to the next player in the rotation, that player would get to run for President twice in a row." — [SH.io rules](https://secrethitler.io/rules)
- Engine: stores `specialElectionFormerPresidentIndex`; next regular president = next living seat after the former president (not after the special-election president) — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js), [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)
- **Policy Peek**: the President secretly looks at the top three tiles and returns them in the same order; no obligation to share or be truthful — [SH.io rules](https://secrethitler.io/rules); [search extract of official text](https://groupgames101.com/secret-hitler-game-rules/)
- **Execution**: "The President executes one player at the table by saying 'I formally execute [player name].'" "If that player is Hitler, the game ends in a Liberal victory. If the executed player is not Hitler, the table does not learn whether a Fascist or a Liberal has been killed." "Executed players are removed from the game and may not speak, vote, or run for office." — [SH.io rules](https://secrethitler.io/rules); official wording via [search extract](https://howdoyouplayit.com/secret-hitler-rules-how-do-you-play-the-secret-hitler-board-game/)
- Engine: special-election and execution targets = any living player except the President — [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)

### Inferences
- Self-targeting: official texts say "another player"/"any other player" for investigate and special election; for execution the text is "one player at the table" — common interpretation (and SH.io) forbids self-execution. Recommend forbidding self-targets for all powers.
- The special-election President is subject to normal eligibility rules for their Chancellor pick (term limits from the last *elected* government still apply). If that special government fails, the tracker advances and rotation resumes after the original President.
- Investigation of a dead player is pointless/forbidden in SH.io; investigation results are private to the President.
- Execution with 7–8 or 9–10 players reduces living count; once ≤5 living, the 5-player term-limit exception kicks in.
- Under official rules nothing stops a Fascist President from executing Hitler (it just loses the game); SH.io blocks it by default (see Q8).

### Gaps
- Exact official PDF verbatim for Policy Peek ("returns them … without changing the order") seen only via secondary extract.

## Q6. Veto power

### Takeaway
After the 5th Fascist policy is enacted, every subsequent Legislative Session may end in a veto: the Chancellor proposes, the President consents → both remaining tiles are discarded, nothing is enacted, election tracker +1 (can trigger chaos). If the President refuses, the Chancellor must enact one of the two.

### Cited Findings
- Official procedure: the Chancellor may say "I wish to veto this agenda"; if the President consents ("I agree to the veto"), both Policies are discarded and the presidency passes as usual; if the President does not consent, the Chancellor must enact one of the two policies. — Official PDF via [search extract](https://www.secrethitler.com/assets/Secret_Hitler_Rules.pdf) / [ultraboardgames](https://www.ultraboardgames.com/secret-hitler/game-rules.php)
- "The Veto Power is a permanent special rule that comes into effect after five Fascist Policies have been enacted. For all Legislative Sessions after the fifth Fascist Policy is enacted, the Executive branch gains a permanent new ability to discard all three Policy tiles if both the Chancellor and President agree." "Each use of the Veto Power represents an inactive government and advances the Election Tracker by one." — [SH.io rules](https://secrethitler.io/rules)
- SH.io alteration: "Veto power is slightly adjusted so that chancellors need to select a policy prior to saying yes or no to vetoing that policy." Chancellor picks a policy, then votes veto; then President votes; both must agree — [About wiki](https://github.com/cozuya/secret-hitler/wiki/About-Secret-Hitler), [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- Engine: on successful veto `electionTrackerCount++`; if ≥3 → term limits cleared, top deck enacted (chaos) and reshuffle if <3; else next election — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)

### Inferences
- Veto becomes available in the session *after* the 5th Fascist policy is enacted (not in the session that enacts it). Engine sets `isVetoEnabled` at start of each election when fascist count ≥ vetoZone.
- In a vetoed round the elected President/Chancellor remain the "last elected government" for term limits (SH.io keeps `previousElectedGovernment`), unless the veto caused chaos.
- President's 1st discard has already happened (3 tiles drawn → 1 discard + 2 vetoed = all 3 go to discard pile).
- The 5th Fascist slot also grants Execution; the order is: enact 5th Fascist → execution power → next round with veto available.
- Official order: Chancellor *proposes* veto (President cannot initiate). Digital: either follow official (Chancellor "request veto" button before choosing, President accept/decline; on decline Chancellor must enact) or SH.io variant.

### Gaps
- Whether the official rules allow a veto to be requested only once per session (implied: President's refusal is final, Chancellor "must enact").

## Q7. Win conditions and "confirmed not Hitler"

### Takeaway
Liberals win on 5 Liberal policies or Hitler's execution. Fascists win on 6 Fascist policies or Hitler being elected Chancellor when ≥3 Fascist policies are already enacted. A Chancellor elected in that zone who doesn't end the game is publicly confirmed not-Hitler.

### Cited Findings
- "Players on the Liberal team win if either: Five Liberal Policies are enacted OR Hitler is assassinated. Players on the Fascist team win if either: Six Fascist Policies are enacted OR Hitler is elected Chancellor any time after the third Fascist Policy has been enacted." — [SH.io rules](https://secrethitler.io/rules)
- "If three or more Fascist Policies have been enacted and a majority of players vote yes: If the new Chancellor is Hitler, the game is over and the Fascists win. If the game didn't end, other players will know for sure the Chancellor is not Hitler." — [SH.io rules](https://secrethitler.io/rules)
- Engine checks `fascistPolicyCount >= hitlerZone (3)` immediately when the vote passes, before the legislative session — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- One secondary source claims the Chancellor is "asked if he is Hitler ... Otherwise, a 'Not Hitler' card is given" — [groupgames101/search extract](https://groupgames101.com/secret-hitler-game-rules/) (UNVERIFIED; not in the SH.io/official text I could read; treat as optional UI marker).
- Ending reveals: SH.io flips all secret role cards at game end — [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)

### Inferences
- Hitler as *President* never wins; Hitler elected Chancellor with ≤2 Fascist policies is harmless (but the 3-policy check uses the count at election time, so a chaos top-deck that makes it 3 counts for subsequent elections).
- Order of checks on enactment: win check (5L / 6F) before power; a 6th Fascist policy ends the game without power. Liberal 5th policy ends immediately.
- "Confirmed not Hitler" should be stored as public per-player state (`confirmedNotHitler = true`) once such a Chancellor is elected.

### Gaps
- No official text found on simultaneous conditions (cannot actually co-occur except via ordering above).

## Q8. Edge cases, rule differences, house rules, online variants

### Takeaway
Most edge cases are resolved by the rule texts above; SH.io adds a well-known set of optional variants (rebalance 6/7/9p, custom fascist track, no-topdecking, timed mode, Avalon/Monarchist roles, etc.) which must be labeled as non-official.

### Cited Findings (edge cases)
- Executed players "may not chat, vote, or run for office" (SH.io wording; official: "may not speak, vote, or run for office") — [SH.io rules](https://secrethitler.io/rules)
- 5-alive exception uses living players (`livingPlayerCount > 5`) — [common.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/common.js)
- Special election chosen = next in rotation → that player is President twice in a row — [SH.io rules](https://secrethitler.io/rules)
- Policy Peek reshuffle safeguard (`undrawnPolicyCount < 3 → shuffle`) — [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)
- SH.io-only restriction: a Fascist (non-Hitler) President cannot execute Hitler unless custom option `fasCanShootHit` is on — [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)
- SH.io custom-game safety ends: if no Liberal is alive → Fascist win; if ≤2 players alive → game ends (only reachable with custom tracks) — [policy-powers.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/policy-powers.js)

### Cited Findings (SH.io variants — NOT official)
- Rebalance (optional per game): "6p games have a fascist policy already enacted, and 7p and 9p games start with one less fascist policy in the deck" (UI tooltip); engine: 6p `trackState.fas = 1`, 7p `deckState.fas = 10`, 9p (`rebalance9p2f`) `deckState.fas = 10` — [Creategame.jsx](https://github.com/cozuya/secret-hitler/blob/main/src/frontend-scripts/components/section-main/Creategame.jsx), [start-game.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/start-game.js)
- CONFLICT: the SH.io rules page and wiki still say 9p rebalance = "9 Fascist Policies in the deck" (2 fewer) — [SH.io rules](https://secrethitler.io/rules), [About wiki](https://github.com/cozuya/secret-hitler/wiki/About-Secret-Hitler) ("9p starts with 2 less fascist policies"); game-summary code also knows legacy modes `rebalance9p` (start with 1 Liberal enacted, 16-card deck) and `rerebalance9p`, and computes a 15-card deck for `rebalance9p2f` — [buildTurns.js](https://github.com/cozuya/secret-hitler/blob/main/models/game-summary/buildTurns.js). Conclusion: the 9p rebalance changed over time; current live engine = 10 Fascist tiles.
- Rationale: "Players (and results from analyzing statistics) have noted that these game modes are the worst balanced and not fun to play with the original ruleset." — [About wiki](https://github.com/cozuya/secret-hitler/wiki/About-Secret-Hitler)
- SH.io rating model's assumed win-rate bias for standard games (used for Elo): 5p Fascist +4 pp, 6p Liberal +7 pp, 7p Fascist +2 pp, 8p Liberal +4 pp, 9p Fascist +8 pp, 10p Fascist +4 pp; rebalanced 6p Fascist +3, 7p Fascist +1, 9p Fascist +7 — [routes/socket/util.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/util.js)
- Custom game (SH.io): free choice of power per fascist slot 1–5 from {none, investigate, deckpeek, election, bullet, peekdrop, reverseinv, …}; Hitler Zone 1–5 (default 3); Veto Zone 1–5 (default 5); number of Fascists 1–3; "Hitler sees fascists" toggle; "Fascists can shoot Hitler" toggle; deck Liberal 5–8, Fascist 10–19; starting enacted Liberal/Fascist 0–2 — [Creategame.jsx](https://github.com/cozuya/secret-hitler/blob/main/src/frontend-scripts/components/section-main/Creategame.jsx)
- Other SH.io modes: "No topdecking – Topdecking results in a fascist win" (options: TDing / No TDing / No Double TDing); Timed mode (random action on timeout); Speed mode; Blind mode (anonymous animal names); Player chat disabled (claims only); Rainbow (experienced-only); Private-only; Avalon SH (Merlin/Percival/Morgana-style roles, casual only); Monarchist mode ("custom fascist role that wins on 6 fascist policies or executing hitler") — [Creategame.jsx](https://github.com/cozuya/secret-hitler/blob/main/src/frontend-scripts/components/section-main/Creategame.jsx), [election.js](https://github.com/cozuya/secret-hitler/blob/main/routes/socket/game/election.js)
- Secret Hitler XL: free, open-source fan/official-adjacent expansion adding Communists and more players (up to ~16–20) — [makerworld/search extract](https://makerworld.com/models/777316); details not retrieved.
- Community conventions (SH.io glossary, strategy, not rules): "Order" meta, claims (RRB etc.), Hitler Zone, Force, Gunpoint, Powerplay, Cucu — [SH.io rules](https://secrethitler.io/rules)

### Inferences
- Recommended digital defaults: official rules with optional toggles "Rebalance 6/7/9p" (6p: 1 Fascist pre-enacted; 7p and 9p: 10 Fascist tiles) and possibly "No top-decking"; label clearly as house rules.
- Online adaptation of "no communication": disable private/public chat for President & Chancellor between election and enactment.

### Gaps
- Could not verify whether physical rule-book revisions (2016 retail vs. Kickstarter print) differ; I found no source documenting text changes between editions. Secret Hitler XL rule details not retrieved.

## Q9. Game length

### Takeaway
Box: 5–10 players, 13+, ~45 minutes. Structurally a game has at most 10 enacted policies (4 L + 5 F before the deciding one) and at most 2 failed elections/vetoes between enactments.

### Cited Findings
- "designed for ages 13 and up, accommodates 5-10 players, and has a game length of 45 minutes"; published 2016; nominated for 2016 Golden Geek Best Party Game — [Board Game Bliss / retailer listing](https://www.boardgamebliss.com/products/secret-hitler)
- Kickstarter-funded (raised far above goal); publisher Goat, Wolf & Cabbage LLC — [Chicagoist 2017](https://chicagoist.com/2017/09/08/secret_hitler.php)

### Inferences
- Shortest possible game: Fascists can win in round 4 (3 Fascist policies via sessions/chaos, then Hitler elected); Liberals need ≥5 sessions (or an execution, earliest at Fascist policy 4). Upper bound: 10 enactments × up to 3 election attempts ≈ 30 elections.
- Online with timers, SH.io games commonly run ~15–30 minutes (not sourced — treat as estimate).

### Gaps
- No authoritative statistics on average number of rounds found.
