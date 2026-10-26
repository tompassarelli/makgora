import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";
import { QUICK_HERO_COMMAND } from "../../src/game/session/devSettings";

const KOBOLD_SPECIALS = [
  { move: "wick-flick", keys: "u", look: "Wick Flick: a candle flame leaves his hand at chest height and travels ahead as a small fireball, its hit circle riding the fireball" },
  { move: "mine", keys: "e+u", look: "Mine!: he sweeps the pick low at both ankles at once, dust and shards at his feet, a hit area low on each side of him on the active frames" },
  { move: "candle-escape", keys: "space+u", look: "Candle Escape: he springs straight up under red flame at his feet, the tall hit area running from his feet over his head while he rises, then falls helpless" },
] as const;

export const specialStripMaps = (presentation: string) => ({
  "hero-kobold-hit-areas": { describe: "development map rebuilt from this checkout, every human plays Kobold with hit areas shown", path: presentation, rebuild: "main", quick: `${QUICK_HERO_COMMAND}kobold hit-areas` },
});

export const specialStripChecks = (rules: readonly Rule[]): NativeCheck[] => (["right", "left"] as const).flatMap((facing) => KOBOLD_SPECIALS.map(({ move, keys, look }): NativeCheck => ({
  id: `405-kobold-${move}-${facing}`,
  closes: "smashcraft#405 box 1",
  map: "hero-kobold-hit-areas",
  session: "405-kobold",
  setup: [{ waitMs: 2500 }, { keys: [facing === "right" ? "r" : "w"], client: "a" }, { waitMs: 900 }, { keys: [keys], client: "a" }],
  capture: [{ kind: "frames", name: move, client: "a", count: 24, everyMs: 25 }],
  pass: [...rules],
  look: `Facing ${facing}. ${look}. A cold reader shown the strip without the move name says what it does and where it hits, and the effect covers the drawn hit area on the active frames.`,
})));
