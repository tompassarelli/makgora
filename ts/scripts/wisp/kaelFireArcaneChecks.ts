import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

const SETUP = [{ chat: "-dev reset" }, { chat: "-dev quick pair Kael'thas Sunstrider / Dreadlord" }, { waitMs: 4000 }, { keys: ["d"], holdMs: 400, client: "a" }] as const;

export const kaelFireArcaneChecks = (pass: readonly Rule[]): NativeCheck[] => [
  {
    id: "360-kael-arcane-normal", closes: "smashcraft#360 (arcane normals)", map: "presentation", session: "360-kael-fire-arcane",
    setup: [...SETUP, { keys: ["n"], client: "a" }, { waitMs: 60 }],
    capture: [{ kind: "frames", name: "jab", client: "a", count: 12, everyMs: 50 }],
    pass,
    look: "Kael'thas jabs player 2's Dreadlord at match size: three green spheres orbit him and one flies out to the jab's hit area, with a violet spark on contact; no red or gold fire anywhere in the frames.",
  },
  {
    id: "360-kael-fire-special", closes: "smashcraft#360 (fire specials)", map: "presentation", session: "360-kael-fire-arcane",
    setup: [...SETUP, { keys: ["d+u"], client: "a" }, { waitMs: 400 }],
    capture: [{ kind: "frames", name: "flame-strike", client: "a", count: 14, everyMs: 120 }],
    pass,
    look: "Kael'thas casts Flame Strike at match size: the rune, the pillar and the burn are red and gold Warcraft fire, clearly different from the green spheres that orbit him.",
  },
];
