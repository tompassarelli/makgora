import type { NativeCheck, Rule } from "wisp/scripts/wisp/accept";

export const hudChecks = (pass: readonly Rule[]): NativeCheck[] => [
  { id: "570-damage-hud", closes: "smashcraft#570 box 3 (Classic)", map: "presentation", capture: [{ kind: "frames", name: "panels", client: "a", count: 6, everyMs: 50 }],
    setup: [{ waitMs: 3000 }, { chat: "-dev percent 1 37" }, { chat: "-dev percent 2 124" }, { chat: "-dev lives 1 3" }, { chat: "-dev lives 2 1" }, { waitMs: 500 }],
    pass, look: "Both damage panels across the bottom, the right one mirrored: P1 reads 37% in light yellow with three stock icons under its name, P2 reads 124% in red with one stock icon and holds still with no hit; no tenths digit on either." },
  { id: "574-fighter-marker", closes: "smashcraft#574 box 3 (Classic)", map: "presentation", capture: [{ kind: "frames", name: "markers", client: "a", count: 6, everyMs: 50 }],
    setup: [{ waitMs: 3000 }, { chat: "-dev percent 1 37" }, { chat: "-dev percent 2 162" }, { chat: "-dev beside 1 2" }, { waitMs: 300 }],
    pass, look: "The two fighters stand on top of each other; above them two markers stay clear of each other and of both bodies: P1's reads 37% in light yellow with a dark outline over its player name and a red triangle, P2's reads 162% in dark red with a light outline over its name and a blue triangle, holding still with no hit. The bottom panels' numbers carry the same outlines." },
  { id: "meter-hud-2p-ultimate", closes: "smashcraft HUD meter display (Tom 2026-10-28)", map: "presentation", session: "meter-hud-2p", capture: [{ kind: "frames", name: "panels", client: "a", count: 2, everyMs: 50 }],
    setup: [{ waitMs: 3000 }, { chat: "-dev percent 1 37" }, { chat: "-dev percent 2 124" }, { chat: "-dev meter 60" }, { waitMs: 500 }],
    pass, look: "Two damage panels across the bottom, the right one mirrored. Each shows a small square EX cell right of its percent sign, empty and unlit, and a long thin gold bar under the damage number filled to 60%. The cell and the bar are different shapes, colours and places; nothing overlaps the stocks or the name." },
  { id: "meter-hud-2p-full", closes: "smashcraft HUD meter display (Tom 2026-10-28)", map: "presentation", session: "meter-hud-2p", after: "meter-hud-2p-ultimate", capture: [{ kind: "frames", name: "panels", client: "a", count: 6, everyMs: 120 }],
    setup: [{ chat: "-dev meter 100" }, { waitMs: 500 }],
    pass, look: "Both meters full on both panels: the EX cell is solid bright blue inside a blue halo, the gold bar is full and breathes between gold and orange across the frames; neither is mistaken for the other and neither overlaps the stocks or the name." },
  { id: "meter-hud-4p-ultimate", closes: "smashcraft HUD meter display (Tom 2026-10-28)", map: "presentation", session: "meter-hud-4p", capture: [{ kind: "frames", name: "panels", client: "a", count: 2, everyMs: 50 }],
    setup: [{ chat: "-dev reset" }, { chat: "-dev slots 1 14" }, { chat: "-dev quick cpu wren expert" }, { waitMs: 8000 }, { chat: "-dev percent 1 8" }, { chat: "-dev percent 2 37" }, { chat: "-dev percent 3 124" }, { chat: "-dev percent 4 162" }, { chat: "-dev meter 60" }, { waitMs: 500 }],
    pass, look: "Four damage panels across the bottom, the two right ones mirrored. Each shows a small square EX cell right of its percent sign, empty and unlit, and a long thin gold bar under the damage number filled to 60%, readable at four across; nothing overlaps the stocks or the name." },
  { id: "meter-hud-4p-full", closes: "smashcraft HUD meter display (Tom 2026-10-28)", map: "presentation", session: "meter-hud-4p", after: "meter-hud-4p-ultimate", capture: [{ kind: "frames", name: "panels", client: "a", count: 6, everyMs: 120 }],
    setup: [{ chat: "-dev meter 100" }, { waitMs: 500 }],
    pass, look: "Both meters full on all four panels: bright blue EX cells with halos, full gold bars breathing between gold and orange across the frames." },
];
