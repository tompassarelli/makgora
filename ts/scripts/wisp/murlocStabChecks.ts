import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const MOVES = [
  ["jab", 1500, ["n"], "first jab"],
  ["jab2", 3000, ["n", "n"], "second jab"],
  ["ftilt", 1500, ["p+d+n"], "forward tilt"],
] as const;

export const murlocStabChecks = (map: string, pass: readonly Rule[]): NativeCheck[] =>
  MOVES.map(([name, waitMs, keys, move]) => ({
    id: `497-murloc-${name}`, closes: "smashcraft#497", map, session: "497-murloc",
    setup: [{ waitMs }, { keys, client: "a", holdMs: 60 }],
    capture: [{ kind: "frames", name, client: "a", count: 16, everyMs: 33 }],
    pass,
    look: `Murloc's ${move}: a cold reader calls it a forward stab or thrust with the spear point first, not a swing, and sees no broken or impossible limb.`,
  }));
