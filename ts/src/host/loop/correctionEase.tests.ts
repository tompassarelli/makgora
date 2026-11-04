import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import type { Roster } from "../../game/sim/roster";
import { EASE_RETAIN, EASE_SNAP_UNITS, type EasedTick, createCorrectionEase, easeCorrections, noteEaseBefore } from "./correctionEase";

function world(): { readonly roster: Roster; readonly motion: { x: number; z: number }; readonly status: { out: boolean } } {
  const motion = { x: 0, z: 0 };
  const status = { out: false };
  const roster = { active: [true, false, false, false], fighters: [{ motion, status }] } as unknown as Roster;
  return { roster, motion, status };
}

function tick(ease: ReturnType<typeof createCorrectionEase>, roster: Roster, jump: number, motion: { x: number }): EasedTick {
  const out: EasedTick = { pop: 0, visible: 0 };
  noteEaseBefore(ease, roster);
  motion.x += jump;
  easeCorrections(ease, roster, jump !== 0, out);
  return out;
}

test("a correction keeps the drawn body where it was and eases it onto the corrected spot, each tick's drawn jump at most the rest of the offset times 1 - retain, and a still fighter settles there within 15 ticks [k2 property]", () => {
  for (const jump of [24, 60, 100, -150]) {
    const ease = createCorrectionEase();
    const { roster, motion } = world();
    const first = tick(ease, roster, jump, motion);
    assertEquals(first.pop, Math.abs(jump));
    assertEquals(first.visible, Math.floor(Math.abs(jump) * (1 - EASE_RETAIN)));
    let drawn = motion.x + (ease.x[0] ?? 0);
    assertTrue(Math.abs(drawn - (motion.x - jump * EASE_RETAIN)) < 1 / 1024);
    for (let settle = 0; settle < 15; settle++) {
      const step = tick(ease, roster, 0, motion);
      const next = motion.x + (ease.x[0] ?? 0);
      assertTrue(Math.abs(next - drawn) <= step.visible + 1);
      drawn = next;
    }
    assertEquals(ease.x[0], 0);
  }
});

test("a correction past the snap distance, or a fighter that left the stage, draws at the simulation's spot at once [k2 property]", () => {
  const ease = createCorrectionEase();
  const { roster, motion, status } = world();
  const snapped = tick(ease, roster, EASE_SNAP_UNITS + 1, motion);
  assertEquals(snapped.visible, EASE_SNAP_UNITS + 1);
  assertEquals(ease.x[0], 0);
  tick(ease, roster, 50, motion);
  assertTrue((ease.x[0] ?? 0) !== 0);
  status.out = true;
  tick(ease, roster, 0, motion);
  assertEquals(ease.x[0], 0);
});
