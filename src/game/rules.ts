import type { GameConfig, Power } from "./types";

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const MAX_NAME_LENGTH = 16;

const BOARD_5_6: (Power | null)[] = [null, null, "peek", "execute", "execute"];
const BOARD_7_8: (Power | null)[] = [null, "investigate", "specialElection", "execute", "execute"];
const BOARD_9_10: (Power | null)[] = [
  "investigate",
  "investigate",
  "specialElection",
  "execute",
  "execute",
];

/** Official rules (Secret Hitler rulebook) for the given player count. */
export function defaultConfig(playerCount: number): GameConfig {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Unsupported player count ${playerCount}`);
  }
  const fascistCount = playerCount <= 6 ? 1 : playerCount <= 8 ? 2 : 3;
  const board = playerCount <= 6 ? BOARD_5_6 : playerCount <= 8 ? BOARD_7_8 : BOARD_9_10;
  return {
    fascistPowers: [...board],
    liberalPoliciesToWin: 5,
    fascistPoliciesToWin: 6,
    hitlerZoneFrom: 3,
    vetoFrom: 5,
    deck: { liberal: 6, fascist: 11 },
    fascistCount,
    hitlerKnowsFascists: playerCount <= 6,
  };
}

export function boardName(playerCount: number): "5-6" | "7-8" | "9-10" {
  return playerCount <= 6 ? "5-6" : playerCount <= 8 ? "7-8" : "9-10";
}

export const POWER_LABEL: Record<Power, string> = {
  investigate: "Loyalität untersuchen",
  peek: "Gesetze ansehen",
  specialElection: "Sonderwahl",
  execute: "Hinrichtung",
};
