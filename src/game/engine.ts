import { defaultConfig, MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, POWER_LABEL } from "./rules";
import type {
  Action,
  ActionResult,
  GameState,
  Party,
  PlayerState,
  Policy,
  Rng,
  Role,
  Team,
} from "./types";

const MAX_LOG = 150;

export function createGame(): GameState {
  return {
    players: [],
    hostId: null,
    config: null,
    phase: { kind: "lobby" },
    deck: [],
    discard: [],
    liberalPolicies: 0,
    fascistPolicies: 0,
    electionTracker: 0,
    presidentId: null,
    chancellorId: null,
    lastElected: null,
    rotationAnchorId: null,
    specialElectionPresidentId: null,
    lastVote: null,
    lastEnacted: null,
    knowledge: {},
    log: [],
    seq: 0,
    gameNumber: 0,
  };
}

/** Thrown inside handlers for invalid actions; turned into { ok: false }. */
class RuleError extends Error {}

function fail(message: string): never {
  throw new RuleError(message);
}

export function applyAction(state: GameState, action: Action, rng: Rng): ActionResult {
  const next = structuredClone(state);
  next.seq += 1;
  try {
    handle(next, action, rng);
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, state: next };
}

// ---------- helpers ----------

export function partyOf(role: Role): Party {
  return role === "liberal" ? "liberal" : "fascist";
}

function player(s: GameState, id: string): PlayerState {
  return s.players.find((p) => p.id === id) ?? fail("Unbekannter Spieler.");
}

function name(s: GameState, id: string | null): string {
  return s.players.find((p) => p.id === id)?.name ?? "?";
}

function log(s: GameState, text: string) {
  s.log.push({ seq: s.seq, text });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => p.alive);
}

function nextAliveAfter(s: GameState, id: string): PlayerState {
  const start = s.players.findIndex((p) => p.id === id);
  for (let i = 1; i <= s.players.length; i++) {
    const p = s.players[(start + i) % s.players.length];
    if (p.alive) return p;
  }
  return fail("Keine lebenden Spieler.");
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Players the current president may nominate as chancellor. */
export function eligibleChancellorIds(s: GameState): string[] {
  const alive = alivePlayers(s);
  return alive
    .filter((p) => {
      if (p.id === s.presidentId) return false;
      if (!s.lastElected) return true;
      if (p.id === s.lastElected.chancellorId) return false;
      // With five or fewer players alive only the last chancellor is term-limited.
      if (alive.length > 5 && p.id === s.lastElected.presidentId) return false;
      return true;
    })
    .map((p) => p.id);
}

function requirePhase<K extends GameState["phase"]["kind"]>(
  s: GameState,
  kind: K,
): Extract<GameState["phase"], { kind: K }> {
  if (s.phase.kind !== kind) fail("Das geht gerade nicht.");
  return s.phase as Extract<GameState["phase"], { kind: K }>;
}

function requirePresident(s: GameState, by: string) {
  if (s.presidentId !== by) fail("Nur der Präsident kann das tun.");
}

function requireOtherAlive(s: GameState, by: string, targetId: string): PlayerState {
  const target = player(s, targetId);
  if (target.id === by) fail("Du kannst dich nicht selbst wählen.");
  if (!target.alive) fail("Dieser Spieler ist tot.");
  return target;
}

function endGame(s: GameState, winner: Team, reason: string) {
  s.phase = { kind: "gameOver", winner, reason };
  log(s, `${winner === "liberal" ? "Die Liberalen" : "Die Faschisten"} gewinnen: ${reason}`);
}

function startRound(s: GameState) {
  if (s.specialElectionPresidentId) {
    s.presidentId = s.specialElectionPresidentId;
    s.specialElectionPresidentId = null;
  } else {
    const next = nextAliveAfter(s, s.rotationAnchorId!);
    s.presidentId = next.id;
    s.rotationAnchorId = next.id;
  }
  s.chancellorId = null;
  s.phase = { kind: "nominate" };
}

/** Shuffle the discard pile back in when fewer than three policies remain. */
function reshuffleIfNeeded(s: GameState, rng: Rng) {
  if (s.deck.length >= 3) return;
  s.deck = shuffle([...s.deck, ...s.discard], rng);
  s.discard = [];
  log(s, "Der Ablagestapel wird neu in den Stapel gemischt.");
}

function enact(s: GameState, policy: Policy, chaos: boolean, rng: Rng) {
  const config = s.config!;
  s.electionTracker = 0;
  s.lastEnacted = { policy, chaos, seq: s.seq };
  if (policy === "L") s.liberalPolicies += 1;
  else s.fascistPolicies += 1;
  log(
    s,
    `${chaos ? "Chaos! Das oberste Gesetz wird erlassen: " : "Erlassen: "}${
      policy === "L" ? "liberales" : "faschistisches"
    } Gesetz.`,
  );

  if (s.liberalPolicies >= config.liberalPoliciesToWin) {
    return endGame(s, "liberal", `${config.liberalPoliciesToWin} liberale Gesetze erlassen.`);
  }
  if (s.fascistPolicies >= config.fascistPoliciesToWin) {
    return endGame(s, "fascist", `${config.fascistPoliciesToWin} faschistische Gesetze erlassen.`);
  }

  reshuffleIfNeeded(s, rng);

  if (chaos) {
    s.lastElected = null; // term limits are forgotten after chaos
    return startRound(s);
  }
  const power = policy === "F" ? config.fascistPowers[s.fascistPolicies - 1] : null;
  if (power) {
    s.phase = { kind: "power", power };
    log(s, `Präsidentenmacht für ${name(s, s.presidentId)}: ${POWER_LABEL[power]}.`);
  } else {
    startRound(s);
  }
}

/** A failed election or an accepted veto moves the election tracker. */
function advanceTracker(s: GameState, rng: Rng) {
  s.electionTracker += 1;
  if (s.electionTracker >= 3) {
    const top = s.deck.shift()!;
    enact(s, top, true, rng);
  } else {
    startRound(s);
  }
}

// ---------- action handling ----------

function handle(s: GameState, a: Action, rng: Rng) {
  switch (a.type) {
    case "join": {
      requirePhase(s, "lobby");
      const trimmed = a.name.trim().replace(/\s+/g, " ");
      if (!trimmed) fail("Bitte gib einen Namen ein.");
      if (trimmed.length > MAX_NAME_LENGTH) fail(`Name ist zu lang (max. ${MAX_NAME_LENGTH}).`);
      if (s.players.length >= MAX_PLAYERS) fail(`Der Raum ist voll (max. ${MAX_PLAYERS}).`);
      if (s.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
        fail("Dieser Name ist schon vergeben.");
      }
      if (s.players.some((p) => p.id === a.playerId)) fail("Du bist schon im Raum.");
      s.players.push({
        id: a.playerId,
        name: trimmed,
        bot: a.bot ?? false,
        alive: true,
        role: null,
        seenRole: false,
        investigated: false,
        confirmedNotHitler: false,
      });
      s.hostId ??= a.playerId;
      log(s, `${trimmed} ist beigetreten.`);
      return;
    }

    case "leave":
    case "kick": {
      requirePhase(s, "lobby");
      const targetId = a.type === "leave" ? a.by : a.targetId;
      if (a.type === "kick" && a.by !== s.hostId) fail("Nur der Host kann Spieler entfernen.");
      const target = player(s, targetId);
      s.players = s.players.filter((p) => p.id !== targetId);
      if (s.hostId === targetId) s.hostId = s.players[0]?.id ?? null;
      log(s, a.type === "leave" ? `${target.name} hat den Raum verlassen.` : `${target.name} wurde entfernt.`);
      return;
    }

    case "start": {
      requirePhase(s, "lobby");
      if (a.by !== s.hostId) fail("Nur der Host kann das Spiel starten.");
      const n = s.players.length;
      if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
        fail(`Ihr braucht ${MIN_PLAYERS} bis ${MAX_PLAYERS} Spieler.`);
      }
      const config = defaultConfig(n);
      const roles: Role[] = shuffle(
        [
          "hitler",
          ...Array<Role>(config.fascistCount).fill("fascist"),
          ...Array<Role>(n - config.fascistCount - 1).fill("liberal"),
        ],
        rng,
      );
      s.players.forEach((p, i) => {
        p.role = roles[i];
        p.alive = true;
        p.seenRole = false;
        p.investigated = false;
        p.confirmedNotHitler = false;
      });
      s.config = config;
      s.deck = shuffle(
        [
          ...Array<Policy>(config.deck.liberal).fill("L"),
          ...Array<Policy>(config.deck.fascist).fill("F"),
        ],
        rng,
      );
      s.discard = [];
      s.liberalPolicies = 0;
      s.fascistPolicies = 0;
      s.electionTracker = 0;
      s.lastElected = null;
      s.specialElectionPresidentId = null;
      s.lastVote = null;
      s.lastEnacted = null;
      s.knowledge = {};
      s.gameNumber += 1;
      // The first president is random; startRound moves on from the anchor.
      const first = s.players[Math.floor(rng() * n)];
      s.rotationAnchorId = s.players[(s.players.indexOf(first) - 1 + n) % n].id;
      s.presidentId = null;
      s.chancellorId = null;
      s.phase = { kind: "roleReveal" };
      log(s, `Spiel ${s.gameNumber} startet mit ${n} Spielern.`);
      return;
    }

    case "ackRole": {
      requirePhase(s, "roleReveal");
      player(s, a.by).seenRole = true;
      if (s.players.every((p) => p.seenRole)) {
        startRound(s);
        log(s, `${name(s, s.presidentId)} ist der erste Präsidentschaftskandidat.`);
      }
      return;
    }

    case "nominate": {
      requirePhase(s, "nominate");
      requirePresident(s, a.by);
      if (!eligibleChancellorIds(s).includes(a.targetId)) fail("Dieser Spieler kann nicht Kanzler werden.");
      s.chancellorId = a.targetId;
      s.phase = { kind: "vote", votes: {} };
      log(s, `${name(s, a.by)} nominiert ${name(s, a.targetId)} als Kanzler.`);
      return;
    }

    case "vote": {
      const phase = requirePhase(s, "vote");
      const voter = player(s, a.by);
      if (!voter.alive) fail("Tote stimmen nicht ab.");
      phase.votes[a.by] = a.ja; // changing your vote is allowed until everyone voted
      const alive = alivePlayers(s);
      if (!alive.every((p) => p.id in phase.votes)) return;

      const ja = alive.filter((p) => phase.votes[p.id]).length;
      const passed = ja > alive.length / 2;
      s.lastVote = {
        presidentId: s.presidentId!,
        chancellorId: s.chancellorId!,
        votes: { ...phase.votes },
        passed,
        seq: s.seq,
      };
      log(s, `Abstimmung: ${ja} Ja, ${alive.length - ja} Nein – ${passed ? "Regierung gewählt" : "gescheitert"}.`);
      if (!passed) {
        s.chancellorId = null;
        return advanceTracker(s, rng);
      }

      const chancellor = player(s, s.chancellorId!);
      if (s.fascistPolicies >= s.config!.hitlerZoneFrom) {
        if (chancellor.role === "hitler") {
          return endGame(s, "fascist", "Hitler wurde zum Kanzler gewählt.");
        }
        chancellor.confirmedNotHitler = true;
        log(s, `${chancellor.name} ist nachweislich nicht Hitler.`);
      }
      s.lastElected = { presidentId: s.presidentId!, chancellorId: chancellor.id };
      s.phase = { kind: "presidentDiscard", hand: s.deck.splice(0, 3) };
      return;
    }

    case "presidentDiscard": {
      const phase = requirePhase(s, "presidentDiscard");
      requirePresident(s, a.by);
      if (!(a.index >= 0 && a.index < phase.hand.length)) fail("Ungültige Karte.");
      const hand = [...phase.hand];
      s.discard.push(...hand.splice(a.index, 1));
      s.phase = { kind: "chancellorEnact", hand, vetoDenied: false };
      log(s, `${name(s, a.by)} gibt zwei Gesetze an ${name(s, s.chancellorId)} weiter.`);
      return;
    }

    case "chancellorEnact": {
      const phase = requirePhase(s, "chancellorEnact");
      if (a.by !== s.chancellorId) fail("Nur der Kanzler kann das tun.");
      if (!(a.index >= 0 && a.index < phase.hand.length)) fail("Ungültige Karte.");
      const hand = [...phase.hand];
      const [policy] = hand.splice(a.index, 1);
      s.discard.push(...hand);
      return enact(s, policy, false, rng);
    }

    case "proposeVeto": {
      const phase = requirePhase(s, "chancellorEnact");
      if (a.by !== s.chancellorId) fail("Nur der Kanzler kann ein Veto vorschlagen.");
      if (s.fascistPolicies < s.config!.vetoFrom) fail("Das Veto ist noch nicht freigeschaltet.");
      if (phase.vetoDenied) fail("Der Präsident hat das Veto bereits abgelehnt.");
      s.phase = { kind: "vetoProposed", hand: phase.hand };
      log(s, `${name(s, a.by)} möchte ein Veto einlegen.`);
      return;
    }

    case "vetoResponse": {
      const phase = requirePhase(s, "vetoProposed");
      requirePresident(s, a.by);
      if (!a.accept) {
        s.phase = { kind: "chancellorEnact", hand: phase.hand, vetoDenied: true };
        log(s, `${name(s, a.by)} lehnt das Veto ab.`);
        return;
      }
      s.discard.push(...phase.hand);
      log(s, `${name(s, a.by)} stimmt dem Veto zu. Beide Gesetze werden abgelegt.`);
      reshuffleIfNeeded(s, rng);
      return advanceTracker(s, rng);
    }

    case "investigate": {
      const phase = requirePhase(s, "power");
      requirePresident(s, a.by);
      if (phase.power !== "investigate" || phase.investigation) fail("Das geht gerade nicht.");
      const target = requireOtherAlive(s, a.by, a.targetId);
      if (target.investigated) fail("Dieser Spieler wurde schon untersucht.");
      target.investigated = true;
      const party = partyOf(target.role!);
      (s.knowledge[a.by] ??= {})[target.id] = party;
      phase.investigation = { targetId: target.id, party };
      log(s, `${name(s, a.by)} untersucht die Parteizugehörigkeit von ${target.name}.`);
      return;
    }

    case "specialElection": {
      const phase = requirePhase(s, "power");
      requirePresident(s, a.by);
      if (phase.power !== "specialElection") fail("Das geht gerade nicht.");
      const target = requireOtherAlive(s, a.by, a.targetId);
      s.specialElectionPresidentId = target.id;
      log(s, `${name(s, a.by)} ruft eine Sonderwahl aus: ${target.name} wird Präsidentschaftskandidat.`);
      return startRound(s);
    }

    case "execute": {
      const phase = requirePhase(s, "power");
      requirePresident(s, a.by);
      if (phase.power !== "execute") fail("Das geht gerade nicht.");
      const target = requireOtherAlive(s, a.by, a.targetId);
      target.alive = false;
      log(s, `${name(s, a.by)} richtet ${target.name} hin.`);
      if (target.role === "hitler") {
        return endGame(s, "liberal", "Hitler wurde hingerichtet.");
      }
      return startRound(s);
    }

    case "ackPower": {
      const phase = requirePhase(s, "power");
      requirePresident(s, a.by);
      if (phase.power === "investigate" && !phase.investigation) fail("Wähle zuerst einen Spieler.");
      if (phase.power !== "investigate" && phase.power !== "peek") fail("Das geht gerade nicht.");
      if (phase.power === "peek") log(s, `${name(s, a.by)} hat sich die obersten drei Gesetze angesehen.`);
      return startRound(s);
    }

    case "backToLobby": {
      requirePhase(s, "gameOver");
      if (a.by !== s.hostId) fail("Nur der Host kann eine neue Runde starten.");
      s.phase = { kind: "lobby" };
      s.config = null;
      s.presidentId = null;
      s.chancellorId = null;
      s.deck = [];
      s.discard = [];
      s.liberalPolicies = 0;
      s.fascistPolicies = 0;
      s.electionTracker = 0;
      s.lastElected = null;
      s.lastVote = null;
      s.lastEnacted = null;
      s.knowledge = {};
      s.players.forEach((p) => {
        p.role = null;
        p.alive = true;
        p.seenRole = false;
        p.investigated = false;
        p.confirmedNotHitler = false;
      });
      log(s, "Zurück in der Lobby.");
      return;
    }
  }
}
