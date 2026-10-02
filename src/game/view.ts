import { eligibleChancellorIds } from "./engine";
import type { GameConfig, GameState, LogEntry, Party, Policy, Power, Role, Team } from "./types";

/**
 * What one player is allowed to see. This is the ONLY game data that leaves
 * the server, so anything secret must be filtered out here.
 */
export interface PlayerView {
  you: { id: string; name: string; role: Role | null; isHost: boolean; alive: boolean } | null;
  players: {
    id: string;
    name: string;
    alive: boolean;
    connected: boolean;
    isHost: boolean;
    investigated: boolean;
    confirmedNotHitler: boolean;
    seenRole: boolean;
    hasVoted: boolean;
  }[];
  phase:
    | { kind: "lobby" }
    | { kind: "roleReveal" }
    | { kind: "nominate"; eligibleIds: string[] }
    | { kind: "vote" }
    | { kind: "presidentDiscard" }
    | { kind: "chancellorEnact"; vetoDenied: boolean }
    | { kind: "vetoProposed" }
    | { kind: "power"; power: Power; investigatedId: string | null }
    | { kind: "gameOver"; winner: Team; reason: string };
  config: GameConfig | null;
  presidentId: string | null;
  chancellorId: string | null;
  lastElected: GameState["lastElected"];
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number;
  deckCount: number;
  discardCount: number;
  lastVote: GameState["lastVote"];
  lastEnacted: GameState["lastEnacted"];
  /** Roles this player knows (own team knowledge; everyone at game end). */
  knownRoles: Record<string, Role>;
  /** Parties this player learned by investigating. */
  knownParties: Record<string, Party>;
  /** Cards currently in this player's hand (president or chancellor). */
  hand: Policy[] | null;
  /** Top three cards, only for the president using Policy Peek. */
  peek: Policy[] | null;
  /** Investigation result waiting for the president to continue. */
  investigation: { targetId: string; party: Party } | null;
  myVote: boolean | null;
  log: LogEntry[];
  seq: number;
  gameNumber: number;
}

const LOG_IN_VIEW = 60;

export function viewFor(s: GameState, viewerId: string | null, connectedIds: ReadonlySet<string>): PlayerView {
  const me = s.players.find((p) => p.id === viewerId) ?? null;
  const phase = s.phase;
  const over = phase.kind === "gameOver";

  const knownRoles: Record<string, Role> = {};
  if (me?.role) {
    knownRoles[me.id] = me.role;
    const seesFascists = me.role === "fascist" || (me.role === "hitler" && s.config?.hitlerKnowsFascists);
    if (seesFascists) {
      for (const p of s.players) {
        if (p.role === "fascist" || p.role === "hitler") knownRoles[p.id] = p.role;
      }
    }
  }
  if (over) {
    for (const p of s.players) if (p.role) knownRoles[p.id] = p.role;
  }

  const isPresident = me !== null && me.id === s.presidentId;
  const isChancellor = me !== null && me.id === s.chancellorId;

  let hand: Policy[] | null = null;
  if (phase.kind === "presidentDiscard" && isPresident) hand = phase.hand;
  if ((phase.kind === "chancellorEnact" || phase.kind === "vetoProposed") && isChancellor) hand = phase.hand;

  const peek = phase.kind === "power" && phase.power === "peek" && isPresident ? s.deck.slice(0, 3) : null;
  const investigation =
    phase.kind === "power" && phase.investigation && isPresident ? phase.investigation : null;

  const votes = phase.kind === "vote" ? phase.votes : null;

  let publicPhase: PlayerView["phase"];
  switch (phase.kind) {
    case "nominate":
      publicPhase = { kind: "nominate", eligibleIds: eligibleChancellorIds(s) };
      break;
    case "vote":
      publicPhase = { kind: "vote" };
      break;
    case "presidentDiscard":
      publicPhase = { kind: "presidentDiscard" };
      break;
    case "chancellorEnact":
      publicPhase = { kind: "chancellorEnact", vetoDenied: phase.vetoDenied };
      break;
    case "vetoProposed":
      publicPhase = { kind: "vetoProposed" };
      break;
    case "power":
      // Who was investigated is public; the result is not.
      publicPhase = { kind: "power", power: phase.power, investigatedId: phase.investigation?.targetId ?? null };
      break;
    default:
      publicPhase = phase;
  }

  return {
    you: me && {
      id: me.id,
      name: me.name,
      role: me.role,
      isHost: me.id === s.hostId,
      alive: me.alive,
    },
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      connected: connectedIds.has(p.id),
      isHost: p.id === s.hostId,
      investigated: p.investigated,
      confirmedNotHitler: p.confirmedNotHitler,
      seenRole: p.seenRole,
      hasVoted: votes !== null && p.id in votes,
    })),
    phase: publicPhase,
    config: s.config,
    presidentId: s.presidentId,
    chancellorId: s.chancellorId,
    lastElected: s.lastElected,
    liberalPolicies: s.liberalPolicies,
    fascistPolicies: s.fascistPolicies,
    electionTracker: s.electionTracker,
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    lastVote: s.lastVote,
    lastEnacted: s.lastEnacted,
    knownRoles,
    knownParties: (me && s.knowledge[me.id]) ?? {},
    hand,
    peek,
    investigation,
    myVote: votes && me && me.id in votes ? votes[me.id] : null,
    log: s.log.slice(-LOG_IN_VIEW),
    seq: s.seq,
    gameNumber: s.gameNumber,
  };
}

