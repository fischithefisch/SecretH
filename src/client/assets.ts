import type { Party, Policy, Role } from "../game/types";

const a = (name: string) => `/assets/${name}.webp`;

export const IMG = {
  boardLiberal: a("board-liberal"),
  boardFascist: { "5-6": a("board-fascist-5-6"), "7-8": a("board-fascist-7-8"), "9-10": a("board-fascist-9-10") },
  tileLiberal: a("board-policy-liberal"),
  tileFascist: a("board-policy-fascist"),
  tracker: a("board-tracker"),
  membershipBack: a("party-membership"),
  ja: a("vote-yes"),
  nein: a("vote-no"),
};

export function policyImg(p: Policy) {
  return a(p === "L" ? "policy-liberal" : "policy-fascist");
}

export function membershipImg(p: Party) {
  return a(p === "liberal" ? "party-membership-liberal" : "party-membership-fascist");
}

/** Picks a stable card artwork per player so neighbours get different pictures. */
export function roleImg(role: Role, playerId: string) {
  if (role === "hitler") return a("role-hitler");
  const hash = [...playerId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return role === "fascist" ? a(`role-fascist-${(hash % 3) + 1}`) : a(`role-liberal-${(hash % 6) + 1}`);
}

export const ROLE_LABEL: Record<Role, string> = {
  liberal: "Liberaler",
  fascist: "Faschist",
  hitler: "Hitler",
};
