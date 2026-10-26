import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const MOVES = [
  ["jab2", 3000, ["n", "n"], "second jab"],
  ["ftilt", 1500, ["p+d+n"], "forward tilt"],
  ["ftilt-up", 1500, ["p+d+w+n"], "up-angled forward tilt"],
] as const;

export const koboldDirectionChecks = (map: string, pass: readonly Rule[]): NativeCheck[] =>
  MOVES.map(([name, waitMs, keys, move]) => ({
    id: `403-kobold-${name}`, closes: "smashcraft#403", map, session: "403-kobold",
    setup: [{ waitMs }, { keys, client: "a", holdMs: 60 }],
    capture: [{ kind: "frames", name, client: "a", count: 16, everyMs: 33 }],
    pass,
    look: `Kobold's ${move}: a cold reader names the direction it strikes, and the second jab, forward tilt and up-angled forward tilt each get a different direction.`,
  }));
