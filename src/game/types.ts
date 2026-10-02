export type Role = "liberal" | "fascist" | "hitler";
export type Party = "liberal" | "fascist";
export type Policy = "L" | "F";
export type Power = "investigate" | "peek" | "specialElection" | "execute";
export type Team = "liberal" | "fascist";

/**
 * Everything that can differ between games. The default comes from the
 * official rules (see rules.ts); custom games can later override fields.
 */
export interface GameConfig {
  /** Power granted by the n-th fascist policy (index 0 = first policy). */
  fascistPowers: (Power | null)[];
  liberalPoliciesToWin: number;
  fascistPoliciesToWin: number;
  /** Hitler elected chancellor wins once this many fascist policies are enacted. */
  hitlerZoneFrom: number;
  /** Veto is available once this many fascist policies are enacted. */
  vetoFrom: number;
  deck: { liberal: number; fascist: number };
  fascistCount: number;
  hitlerKnowsFascists: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  alive: boolean;
  role: Role | null;
  /** Has confirmed seeing their role card at game start. */
  seenRole: boolean;
  /** Has been investigated already (can't be investigated twice). */
  investigated: boolean;
  /** Was elected chancellor inside the Hitler zone and the game went on. */
  confirmedNotHitler: boolean;
}

export type Phase =
  | { kind: "lobby" }
  | { kind: "roleReveal" }
  | { kind: "nominate" }
  | { kind: "vote"; votes: Record<string, boolean> }
  | { kind: "presidentDiscard"; hand: Policy[] }
  | { kind: "chancellorEnact"; hand: Policy[]; vetoDenied: boolean }
  | { kind: "vetoProposed"; hand: Policy[] }
  | {
      kind: "power";
      power: Power;
      /** Investigation result, shown to the president until they continue. */
      investigation?: { targetId: string; party: Party };
    }
  | { kind: "gameOver"; winner: Team; reason: string };

export interface LogEntry {
  seq: number;
  text: string;
}

export interface GameState {
  players: PlayerState[]; // in seat order
  hostId: string | null;
  config: GameConfig | null;
  phase: Phase;
  deck: Policy[];
  discard: Policy[];
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number;
  presidentId: string | null;
  /** Nominee during the vote, then the sitting chancellor. */
  chancellorId: string | null;
  /** Last *elected* government, used for term limits. Cleared by chaos. */
  lastElected: { presidentId: string; chancellorId: string } | null;
  /** Seat the regular presidential rotation continues from. */
  rotationAnchorId: string | null;
  /** Set by a special election; becomes the next president. */
  specialElectionPresidentId: string | null;
  lastVote: {
    presidentId: string;
    chancellorId: string;
    votes: Record<string, boolean>;
    passed: boolean;
    seq: number;
  } | null;
  lastEnacted: { policy: Policy; chaos: boolean; seq: number } | null;
  /** What each player privately learned through investigations: viewer -> target -> party. */
  knowledge: Record<string, Record<string, Party>>;
  log: LogEntry[];
  /** Increases with every applied action; lets clients detect fresh events. */
  seq: number;
  gameNumber: number;
}

export type Action =
  | { type: "join"; playerId: string; name: string }
  | { type: "leave"; by: string }
  | { type: "kick"; by: string; targetId: string }
  | { type: "start"; by: string }
  | { type: "ackRole"; by: string }
  | { type: "nominate"; by: string; targetId: string }
  | { type: "vote"; by: string; ja: boolean }
  | { type: "presidentDiscard"; by: string; index: number }
  | { type: "chancellorEnact"; by: string; index: number }
  | { type: "proposeVeto"; by: string }
  | { type: "vetoResponse"; by: string; accept: boolean }
  | { type: "investigate"; by: string; targetId: string }
  | { type: "specialElection"; by: string; targetId: string }
  | { type: "execute"; by: string; targetId: string }
  | { type: "ackPower"; by: string }
  | { type: "backToLobby"; by: string };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Returns a float in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;
