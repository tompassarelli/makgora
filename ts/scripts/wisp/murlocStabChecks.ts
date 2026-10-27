import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const MOVES = [
  ["jab", 1500, ["n"], "first jab"],
  ["jab2", 3000, ["n", "n"], "first jab into the second jab"],
  ["ftilt", 1500, ["p+d+n"], "forward tilt"],
] as const;

const MURLOC = { x: 0, y: 230, width: 360, height: 200 };

export const murlocStabChecks = (map: string, pass: readonly Rule[]): NativeCheck[] =>
  MOVES.map(([name, waitMs, keys, move]) => ({
    id: `497-murloc-${name}`, closes: "smashcraft#497", map, session: "497-murloc",
    setup: [{ waitMs }],
    capture: [{ kind: "frames", name, client: "a", region: MURLOC, count: 24, everyMs: 33, press: { keys, holdMs: 60 } }],
    pass,
    look: `Murloc's ${move}, from the key press: a cold reader calls it a forward stab or thrust with the spear point first, not a swing, and sees no broken or impossible limb.`,
  }));
