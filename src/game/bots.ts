import { eligibleChancellorIds } from "./engine";
import type { Action, GameState, Policy, Rng } from "./types";

export const BOT_NAMES = ["Anton", "Berta", "Cäsar", "Dora", "Emil", "Frieda", "Gustav", "Hedwig", "Ida", "Kurt"];

/**
 * The next move of any bot that is currently expected to act, or null.
 * Bots play simply: they favour their own team's policies and vote mostly Ja.
 */
export function botAction(s: GameState, rng: Rng): Action | null {
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  const bots = s.players.filter((p) => p.bot);
  if (bots.length === 0) return null;
  const isBot = (id: string | null) => !!id && bots.some((b) => b.id === id);
  const president = s.players.find((p) => p.id === s.presidentId);
  const chancellor = s.players.find((p) => p.id === s.chancellorId);
  const alive = s.players.filter((p) => p.alive);
  const prefers = (id: string): Policy =>
    s.players.find((p) => p.id === id)?.role === "liberal" ? "L" : "F";
  /** Index of the card to get rid of: one the bot doesn't like, if any. */
  const unwanted = (hand: Policy[], id: string) => {
    const idx = hand.findIndex((c) => c !== prefers(id));
    return idx >= 0 && rng() < 0.85 ? idx : Math.floor(rng() * hand.length);
  };

  switch (s.phase.kind) {
    case "roleReveal": {
      const bot = bots.find((b) => !b.seenRole);
      return bot ? { type: "ackRole", by: bot.id } : null;
    }
    case "nominate":
      if (!isBot(s.presidentId)) return null;
      return { type: "nominate", by: s.presidentId!, targetId: pick(eligibleChancellorIds(s)) };
    case "vote": {
      const votes = s.phase.votes;
      const bot = bots.find((b) => b.alive && !(b.id in votes));
      return bot ? { type: "vote", by: bot.id, ja: rng() < 0.7 } : null;
    }
    case "presidentDiscard":
      if (!isBot(s.presidentId)) return null;
      return { type: "presidentDiscard", by: president!.id, index: unwanted(s.phase.hand, president!.id) };
    case "chancellorEnact": {
      if (!isBot(s.chancellorId)) return null;
      const hand = s.phase.hand;
      const keep = hand.findIndex((c) => c === prefers(chancellor!.id));
      const index = keep >= 0 && rng() < 0.85 ? keep : Math.floor(rng() * hand.length);
      return { type: "chancellorEnact", by: chancellor!.id, index };
    }
    case "vetoProposed":
      if (!isBot(s.presidentId)) return null;
      return { type: "vetoResponse", by: president!.id, accept: rng() < 0.5 };
    case "power": {
      if (!isBot(s.presidentId)) return null;
      const by = president!.id;
      const others = alive.filter((p) => p.id !== by);
      switch (s.phase.power) {
        case "peek":
          return { type: "ackPower", by };
        case "investigate":
          if (s.phase.investigation) return { type: "ackPower", by };
          return { type: "investigate", by, targetId: pick(others.filter((p) => !p.investigated)).id };
        case "specialElection":
          return { type: "specialElection", by, targetId: pick(others).id };
        case "execute":
          return { type: "execute", by, targetId: pick(others).id };
      }
    }
    // falls through
    default:
      return null;
  }
}
