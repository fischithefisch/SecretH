import { z } from "zod";
import { MAX_NAME_LENGTH } from "./rules";
import type { PlayerView } from "./view";

const id = z.string().min(1).max(64);

/** Actions a client may send. The server adds `by` from the connection. */
export const clientActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("kick"), targetId: id }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("ackRole") }),
  z.object({ type: z.literal("nominate"), targetId: id }),
  z.object({ type: z.literal("vote"), ja: z.boolean() }),
  z.object({ type: z.literal("presidentDiscard"), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal("chancellorEnact"), index: z.number().int().min(0).max(1) }),
  z.object({ type: z.literal("proposeVeto") }),
  z.object({ type: z.literal("vetoResponse"), accept: z.boolean() }),
  z.object({ type: z.literal("investigate"), targetId: id }),
  z.object({ type: z.literal("specialElection"), targetId: id }),
  z.object({ type: z.literal("execute"), targetId: id }),
  z.object({ type: z.literal("ackPower") }),
  z.object({ type: z.literal("backToLobby") }),
]);
export type ClientAction = z.infer<typeof clientActionSchema>;

export const clientMessageSchema = z.discriminatedUnion("t", [
  /** Rejoin with a stored token, or join the lobby with a name. */
  z.object({
    t: z.literal("hello"),
    token: z.string().max(128).optional(),
    name: z.string().max(MAX_NAME_LENGTH * 4).optional(),
  }),
  z.object({ t: z.literal("action"), action: clientActionSchema }),
  z.object({ t: z.literal("ping") }),
  /** Host only, lobby only: fill the room with server-controlled test players. */
  z.object({ t: z.literal("addBots") }),
  /** During a game: ask to take over an offline (or bot) seat on this device. */
  z.object({ t: z.literal("claimSeat"), playerId: id }),
  /** Host (or anyone, if the host's seat is claimed) answers a seat request. */
  z.object({ t: z.literal("resolveClaim"), claimId: id, allow: z.boolean() }),
  /** Let a bot play for an offline player. */
  z.object({ t: z.literal("replaceWithBot"), playerId: id }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** A device asking to take over a seat during a running game. */
export interface SeatClaim {
  id: string;
  playerId: string;
}

export type ServerMessage =
  | { t: "welcome"; playerId: string; token: string }
  /** No (valid) token and no name given: the client should ask for a name. */
  | { t: "needName"; gameRunning: boolean }
  | { t: "state"; view: PlayerView; claims: SeatClaim[] }
  | { t: "claimPending"; playerId: string }
  | { t: "claimDenied" }
  | { t: "error"; message: string }
  | { t: "pong" };
