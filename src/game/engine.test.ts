import { describe, expect, it } from "vitest";
import { applyAction, createGame, eligibleChancellorIds } from "./engine";
import { defaultConfig } from "./rules";
import type { Action, GameState, Policy, Rng, Role } from "./types";
import { viewFor } from "./view";

function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function act(s: GameState, a: Action, rng: Rng = seededRng(1)): GameState {
  const r = applyAction(s, a, rng);
  if (!r.ok) throw new Error(`${a.type} failed: ${r.error}`);
  return r.state;
}

function rejects(s: GameState, a: Action): string {
  const r = applyAction(s, a, seededRng(1));
  if (r.ok) throw new Error(`${a.type} unexpectedly succeeded`);
  return r.error;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

/** Game with players p0..p(n-1) that is past role reveal; p0 is the first president. */
function started(n: number, opts: { roles?: Role[]; deck?: Policy[] } = {}): GameState {
  let s = createGame();
  for (const id of ids(n)) s = act(s, { type: "join", playerId: id, name: `Name ${id}` });
  s = act(s, { type: "start", by: "p0" });
  if (opts.roles) s.players.forEach((p, i) => (p.role = opts.roles![i]));
  if (opts.deck) s.deck = [...opts.deck];
  // Force p0 to be the first president.
  s.rotationAnchorId = `p${n - 1}`;
  for (const id of ids(n)) s = act(s, { type: "ackRole", by: id });
  return s;
}

function voteAll(s: GameState, ja: boolean): GameState {
  for (const p of s.players.filter((p) => p.alive)) s = act(s, { type: "vote", by: p.id, ja });
  return s;
}

/** Elect president(current) + chancellor and enact the card at `enactIndex` after discarding `discardIndex`. */
function govern(s: GameState, chancellorId: string, discardIndex = 0, enactIndex = 0): GameState {
  s = act(s, { type: "nominate", by: s.presidentId!, targetId: chancellorId });
  s = voteAll(s, true);
  s = act(s, { type: "presidentDiscard", by: s.presidentId!, index: discardIndex });
  return act(s, { type: "chancellorEnact", by: chancellorId, index: enactIndex });
}

const LIB5: Role[] = ["liberal", "liberal", "liberal", "fascist", "hitler"];

describe("setup", () => {
  it.each([5, 6, 7, 8, 9, 10])("assigns official roles for %i players", (n) => {
    const s = started(n);
    const count = (r: Role) => s.players.filter((p) => p.role === r).length;
    const expected = { 5: [3, 1], 6: [4, 1], 7: [4, 2], 8: [5, 2], 9: [5, 3], 10: [6, 3] }[n]!;
    expect(count("liberal")).toBe(expected[0]);
    expect(count("fascist")).toBe(expected[1]);
    expect(count("hitler")).toBe(1);
    expect(s.deck.filter((c) => c === "L")).toHaveLength(6);
    expect(s.deck.filter((c) => c === "F")).toHaveLength(11);
  });

  it("uses the right fascist board", () => {
    expect(defaultConfig(5).fascistPowers).toEqual([null, null, "peek", "execute", "execute"]);
    expect(defaultConfig(8).fascistPowers).toEqual([null, "investigate", "specialElection", "execute", "execute"]);
    expect(defaultConfig(9).fascistPowers).toEqual([
      "investigate",
      "investigate",
      "specialElection",
      "execute",
      "execute",
    ]);
  });

  it("needs 5 to 10 players and only the host may start", () => {
    let s = createGame();
    for (const id of ids(4)) s = act(s, { type: "join", playerId: id, name: id });
    expect(rejects(s, { type: "start", by: "p0" })).toMatch(/5 bis 10/);
    s = act(s, { type: "join", playerId: "p4", name: "p4" });
    expect(rejects(s, { type: "start", by: "p1" })).toMatch(/Host/);
    expect(rejects(s, { type: "join", playerId: "x", name: "P4" })).toMatch(/vergeben/);
  });

  it("waits for everyone to see their role", () => {
    let s = createGame();
    for (const id of ids(5)) s = act(s, { type: "join", playerId: id, name: id });
    s = act(s, { type: "start", by: "p0" });
    for (const id of ids(4)) s = act(s, { type: "ackRole", by: id });
    expect(s.phase.kind).toBe("roleReveal");
    s = act(s, { type: "ackRole", by: "p4" });
    expect(s.phase.kind).toBe("nominate");
  });
});

describe("hidden information", () => {
  const roles7: Role[] = ["liberal", "liberal", "liberal", "liberal", "fascist", "fascist", "hitler"];

  it("liberals only know themselves", () => {
    const s = started(7, { roles: roles7 });
    expect(viewFor(s, "p0", new Set()).knownRoles).toEqual({ p0: "liberal" });
  });

  it("fascists know each other and Hitler", () => {
    const s = started(7, { roles: roles7 });
    expect(viewFor(s, "p4", new Set()).knownRoles).toEqual({ p4: "fascist", p5: "fascist", p6: "hitler" });
  });

  it("Hitler knows the fascists only with 5-6 players", () => {
    expect(viewFor(started(7, { roles: roles7 }), "p6", new Set()).knownRoles).toEqual({ p6: "hitler" });
    expect(viewFor(started(5, { roles: LIB5 }), "p4", new Set()).knownRoles).toEqual({
      p3: "fascist",
      p4: "hitler",
    });
  });

  it("hands are only visible to their holder", () => {
    let s = started(5, { roles: LIB5 });
    s = act(s, { type: "nominate", by: "p0", targetId: "p1" });
    s = voteAll(s, true);
    expect(viewFor(s, "p0", new Set()).hand).toHaveLength(3);
    expect(viewFor(s, "p1", new Set()).hand).toBeNull();
    expect(viewFor(s, "p2", new Set()).hand).toBeNull();
    s = act(s, { type: "presidentDiscard", by: "p0", index: 0 });
    expect(viewFor(s, "p0", new Set()).hand).toBeNull();
    expect(viewFor(s, "p1", new Set()).hand).toHaveLength(2);
  });

  it("votes stay secret until everyone voted", () => {
    let s = started(5, { roles: LIB5 });
    s = act(s, { type: "nominate", by: "p0", targetId: "p1" });
    s = act(s, { type: "vote", by: "p2", ja: false });
    const v = viewFor(s, "p3", new Set());
    expect(v.players.find((p) => p.id === "p2")!.hasVoted).toBe(true);
    expect(v.myVote).toBeNull();
    expect(JSON.stringify(v)).not.toContain('"p2":false');
    expect(viewFor(s, "p2", new Set()).myVote).toBe(false);
  });
});

describe("elections", () => {
  it("applies term limits to the last elected government", () => {
    let s = started(7);
    s = govern(s, "p1");
    // p1 is president now; p0 (last president) and p1 (last chancellor) are limited.
    expect(s.presidentId).toBe("p1");
    const eligible = eligibleChancellorIds(s);
    expect(eligible).not.toContain("p0");
    expect(eligible).not.toContain("p1");
    expect(eligible).toContain("p2");
  });

  it("only limits the last chancellor with five players alive", () => {
    let s = started(5, { roles: LIB5 });
    s = govern(s, "p2");
    expect(s.presidentId).toBe("p1");
    const eligible = eligibleChancellorIds(s);
    expect(eligible).toContain("p0");
    expect(eligible).not.toContain("p2");
  });

  it("ties fail and three failures cause chaos without power and reset term limits", () => {
    let s = started(6, { deck: ["L", "L", "L", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "L", "L"] });
    s = govern(s, "p3"); // enacts L (discard L, enact L)
    expect(s.lastElected).toEqual({ presidentId: "p0", chancellorId: "p3" });
    for (let i = 0; i < 3; i++) {
      s = act(s, { type: "nominate", by: s.presidentId!, targetId: eligibleChancellorIds(s)[0] });
      // 3 ja / 3 nein = tie -> fails
      s.players.forEach((p, idx) => (s = act(s, { type: "vote", by: p.id, ja: idx < 3 })));
    }
    expect(s.lastEnacted).toMatchObject({ policy: "F", chaos: true });
    expect(s.fascistPolicies).toBe(1);
    expect(s.electionTracker).toBe(0);
    expect(s.lastElected).toBeNull();
    expect(s.phase.kind).toBe("nominate");
  });
});

describe("powers", () => {
  it("special election returns to the rotation after the caller", () => {
    // 7 players: 2nd fascist policy = investigate, 3rd = special election
    let s = started(7, { deck: Array(17).fill("F") });
    s = govern(s, "p3"); // F #1, p0 president
    s = govern(s, "p4"); // F #2 -> investigate, p1 president
    s = act(s, { type: "investigate", by: "p1", targetId: "p5" });
    s = act(s, { type: "ackPower", by: "p1" });
    s = govern(s, "p6"); // p2 president, F #3 -> special election
    expect(s.phase).toMatchObject({ kind: "power", power: "specialElection" });
    s = act(s, { type: "specialElection", by: "p2", targetId: "p3" });
    expect(s.presidentId).toBe("p3");
    s = act(s, { type: "nominate", by: "p3", targetId: "p0" });
    s = voteAll(s, false);
    expect(s.presidentId).toBe("p3"); // regular rotation continues after p2 -> p3 again
  });

  it("investigation shows party only to the president and only once per target", () => {
    const roles: Role[] = ["liberal", "liberal", "liberal", "liberal", "fascist", "fascist", "hitler"];
    let s = started(7, { roles, deck: Array(17).fill("F") });
    s = govern(s, "p3");
    s = govern(s, "p4");
    s = act(s, { type: "investigate", by: "p1", targetId: "p6" });
    expect(viewFor(s, "p1", new Set()).investigation).toEqual({ targetId: "p6", party: "fascist" });
    expect(viewFor(s, "p0", new Set()).investigation).toBeNull();
    expect(viewFor(s, "p0", new Set()).knownParties).toEqual({});
    s = act(s, { type: "ackPower", by: "p1" });
    expect(viewFor(s, "p1", new Set()).knownParties).toEqual({ p6: "fascist" });
    expect(s.players[6].investigated).toBe(true);
  });

  it("policy peek shows the top three cards only to the president", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s = govern(s, "p1");
    s = govern(s, "p2");
    s = govern(s, "p3");
    expect(s.phase).toMatchObject({ kind: "power", power: "peek" });
    expect(viewFor(s, "p2", new Set()).peek).toEqual(s.deck.slice(0, 3));
    expect(viewFor(s, "p0", new Set()).peek).toBeNull();
  });

  it("executing Hitler wins for the liberals", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s = govern(s, "p1");
    s = govern(s, "p2");
    s = govern(s, "p3");
    s = act(s, { type: "ackPower", by: "p2" });
    s = govern(s, "p0"); // p3 president, F #4 -> execution
    s = act(s, { type: "execute", by: "p3", targetId: "p4" });
    expect(s.phase).toMatchObject({ kind: "gameOver", winner: "liberal" });
  });

  it("executed players can't vote or be nominated", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s = govern(s, "p1");
    s = govern(s, "p2");
    s = govern(s, "p3");
    s = act(s, { type: "ackPower", by: "p2" });
    s = govern(s, "p0");
    s = act(s, { type: "execute", by: "p3", targetId: "p1" });
    expect(s.presidentId).toBe("p4");
    expect(eligibleChancellorIds(s)).not.toContain("p1");
    s = act(s, { type: "nominate", by: "p4", targetId: "p2" });
    expect(rejects(s, { type: "vote", by: "p1", ja: true })).toMatch(/Tote/);
  });
});

describe("win conditions and veto", () => {
  it("Hitler elected chancellor after three fascist policies wins", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s = govern(s, "p1");
    s = govern(s, "p2");
    s = govern(s, "p3");
    s = act(s, { type: "ackPower", by: "p2" });
    s = act(s, { type: "nominate", by: "p3", targetId: "p4" });
    s = voteAll(s, true);
    expect(s.phase).toMatchObject({ kind: "gameOver", winner: "fascist" });
  });

  it("a non-Hitler chancellor in the Hitler zone is confirmed", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s = govern(s, "p1");
    s = govern(s, "p2");
    s = govern(s, "p3");
    s = act(s, { type: "ackPower", by: "p2" });
    s = act(s, { type: "nominate", by: "p3", targetId: "p0" });
    s = voteAll(s, true);
    expect(s.players[0].confirmedNotHitler).toBe(true);
  });

  it("five liberal policies win", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("L") });
    const chancellors = ["p1", "p2", "p3", "p4", "p0"];
    for (let i = 0; i < 5; i++) s = govern(s, chancellors[i]);
    expect(s.phase).toMatchObject({ kind: "gameOver", winner: "liberal" });
  });

  it("veto: unlocked after five fascist policies, advances the tracker", () => {
    let s = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    s.fascistPolicies = 5;
    s = act(s, { type: "nominate", by: "p0", targetId: "p1" });
    s = voteAll(s, true);
    s = act(s, { type: "presidentDiscard", by: "p0", index: 0 });
    s = act(s, { type: "proposeVeto", by: "p1" });
    s = act(s, { type: "vetoResponse", by: "p0", accept: false });
    expect(rejects(s, { type: "proposeVeto", by: "p1" })).toMatch(/abgelehnt/);
    s = act(s, { type: "chancellorEnact", by: "p1", index: 0 });
    expect(s.phase).toMatchObject({ kind: "gameOver", winner: "fascist" });

    let t = started(5, { roles: LIB5, deck: Array(17).fill("F") });
    t.fascistPolicies = 5;
    t = act(t, { type: "nominate", by: "p0", targetId: "p1" });
    t = voteAll(t, true);
    t = act(t, { type: "presidentDiscard", by: "p0", index: 0 });
    t = act(t, { type: "proposeVeto", by: "p1" });
    t = act(t, { type: "vetoResponse", by: "p0", accept: true });
    expect(t.electionTracker).toBe(1);
    expect(t.discard).toHaveLength(3);
    expect(t.presidentId).toBe("p1");
  });

  it("veto is not available before five fascist policies", () => {
    let s = started(5, { roles: LIB5 });
    s = act(s, { type: "nominate", by: "p0", targetId: "p1" });
    s = voteAll(s, true);
    s = act(s, { type: "presidentDiscard", by: "p0", index: 0 });
    expect(rejects(s, { type: "proposeVeto", by: "p1" })).toMatch(/freigeschaltet/);
  });
});

describe("deck", () => {
  it("reshuffles the discard pile when fewer than three cards remain", () => {
    let s = started(5, { roles: LIB5 });
    s.deck = ["L", "L", "L", "F", "F"];
    s.discard = ["F", "F", "F"];
    s = govern(s, "p1");
    expect(s.deck.length + s.discard.length + s.liberalPolicies + s.fascistPolicies).toBe(8);
    expect(s.discard).toHaveLength(0);
    expect(s.deck.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------- randomized play: invariants and leak checks ----------

function randomAction(s: GameState, rng: Rng): Action | null {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const alive = s.players.filter((p) => p.alive);
  const pres = s.presidentId!;
  const others = alive.filter((p) => p.id !== pres);
  switch (s.phase.kind) {
    case "roleReveal":
      return { type: "ackRole", by: s.players.find((p) => !p.seenRole)!.id };
    case "nominate":
      return { type: "nominate", by: pres, targetId: pick(eligibleChancellorIds(s)) };
    case "vote": {
      const votes = s.phase.votes;
      return { type: "vote", by: alive.find((p) => !(p.id in votes))!.id, ja: rng() < 0.65 };
    }
    case "presidentDiscard":
      return { type: "presidentDiscard", by: pres, index: Math.floor(rng() * 3) };
    case "chancellorEnact":
      if (s.fascistPolicies >= 5 && !s.phase.vetoDenied && rng() < 0.4) {
        return { type: "proposeVeto", by: s.chancellorId! };
      }
      return { type: "chancellorEnact", by: s.chancellorId!, index: Math.floor(rng() * 2) };
    case "vetoProposed":
      return { type: "vetoResponse", by: pres, accept: rng() < 0.5 };
    case "power": {
      const ph = s.phase;
      if (ph.power === "peek") return { type: "ackPower", by: pres };
      if (ph.power === "investigate") {
        if (ph.investigation) return { type: "ackPower", by: pres };
        return { type: "investigate", by: pres, targetId: pick(others.filter((p) => !p.investigated)).id };
      }
      return { type: ph.power, by: pres, targetId: pick(others).id };
    }
    default:
      return null;
  }
}

describe("randomized games", () => {
  it("keep card counts consistent and never leak secrets", () => {
    let finished = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(seed);
      const n = 5 + (seed % 6);
      let s = createGame();
      for (const id of ids(n)) s = act(s, { type: "join", playerId: id, name: id }, rng);
      s = act(s, { type: "start", by: "p0" }, rng);
      for (let step = 0; step < 500; step++) {
        const a = randomAction(s, rng);
        if (!a) break;
        s = act(s, a, rng);

        const inHand = "hand" in s.phase ? s.phase.hand.length : 0;
        expect(s.deck.length + s.discard.length + s.liberalPolicies + s.fascistPolicies + inHand).toBe(17);

        if (s.phase.kind === "gameOver") continue;
        for (const p of s.players) {
          const v = viewFor(s, p.id, new Set());
          const others = Object.keys(v.knownRoles).filter((id) => id !== p.id);
          if (p.role === "liberal" || (p.role === "hitler" && n > 6)) expect(others).toEqual([]);
          if (v.hand) expect([s.presidentId, s.chancellorId]).toContain(p.id);
          if (v.peek || v.investigation) expect(p.id).toBe(s.presidentId);
          // The serialized view must not contain the deck order.
          expect(JSON.stringify(v)).not.toContain('"deck":[');
        }
      }
      if (s.phase.kind === "gameOver") finished++;
    }
    expect(finished).toBe(200);
  }, 60_000);
});

describe("bots", () => {
  it("can play complete games on their own", async () => {
    const { botAction } = await import("./bots");
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seededRng(seed);
      const n = 5 + (seed % 6);
      let s = createGame();
      for (const id of ids(n)) s = act(s, { type: "join", playerId: id, name: id, bot: true }, rng);
      s = act(s, { type: "start", by: "p0" }, rng);
      for (let step = 0; step < 500 && s.phase.kind !== "gameOver"; step++) {
        const a = botAction(s, rng);
        expect(a).not.toBeNull();
        s = act(s, a!, rng);
      }
      expect(s.phase.kind).toBe("gameOver");
    }
  });

  it("wait for humans", async () => {
    const { botAction } = await import("./bots");
    let s = started(5, { roles: LIB5 });
    s.players[1].bot = true;
    expect(botAction(s, seededRng(1))).toBeNull(); // p0 (human) must nominate
    s = act(s, { type: "nominate", by: "p0", targetId: "p2" });
    expect(botAction(s, seededRng(1))).toMatchObject({ type: "vote", by: "p1" });
  });
});

describe("seat handover", () => {
  it("lets a bot take over a seat and hands the host role on", () => {
    let s = started(5, { roles: LIB5 });
    s = act(s, { type: "setBot", by: "p1", targetId: "p0", bot: true }); // host's own seat
    expect(s.players[0].bot).toBe(true);
    expect(s.hostId).toBe("p1");
    expect(rejects(s, { type: "setBot", by: "p2", targetId: "p3", bot: true })).toMatch(/Host/);
    s = act(s, { type: "setBot", by: "p1", targetId: "p0", bot: false });
    expect(s.players[0].bot).toBe(false);
  });
});
