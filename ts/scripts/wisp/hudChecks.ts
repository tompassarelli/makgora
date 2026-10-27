import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

export const hudChecks = (pass: readonly Rule[]): NativeCheck[] => [
  { id: "570-damage-hud", closes: "smashcraft#570 box 3 (Classic)", map: "presentation", capture: [{ kind: "frames", name: "panels", client: "a", count: 6, everyMs: 50 }],
    setup: [{ waitMs: 3000 }, { chat: "-dev percent 1 37" }, { chat: "-dev percent 2 124" }, { chat: "-dev lives 1 3" }, { chat: "-dev lives 2 1" }, { waitMs: 500 }],
    pass, look: "Both damage panels across the bottom, the right one mirrored: P1 reads 37% in light yellow with three stock icons under its name, P2 reads 124% in red with one stock icon and holds still with no hit; no tenths digit on either." },
  { id: "574-fighter-marker", closes: "smashcraft#574 box 3 (Classic)", map: "presentation", capture: [{ kind: "frames", name: "markers", client: "a", count: 6, everyMs: 50 }],
    setup: [{ waitMs: 3000 }, { chat: "-dev percent 1 37" }, { chat: "-dev percent 2 162" }, { chat: "-dev beside 1 2" }, { waitMs: 300 }],
    pass, look: "The two fighters stand on top of each other; above them two markers stay clear of each other and of both bodies: P1's reads 37% in light yellow with a dark outline over its player name and a red triangle, P2's reads 162% in dark red with a light outline over its name and a blue triangle, holding still with no hit. The bottom panels' numbers carry the same outlines." },
];
