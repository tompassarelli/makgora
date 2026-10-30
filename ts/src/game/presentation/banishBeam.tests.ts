import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { BANISH_BEAM, BANISH_BEAM_FRAMES, BANISH_DELAY_FRAMES } from "../fighters/kaelthas/specials";
import { BANISH_SWIRL_COUNT } from "../fighters/kaelthas/look";
import { type BanishSwirl, banishSwirl } from "./banishBeam";

const cast = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1 });

function swirlsEachFrame(facing: 1 | -1): { live: number[]; fighter: Fighter; spread: BanishSwirl[] } {
  const kael = createFighter(Character.kaelthas, 0.0, facing);
  const target = createFighter(Character.rifleman, facing * 900.0, -facing);
  const { world } = duelPair(kael, target);
  const live: number[] = [];
  const spread: BanishSwirl[] = [];
  const out: BanishSwirl = { x: 0.0, z: 0.0 };
  for (let frame = 1; frame <= BANISH_DELAY_FRAMES + BANISH_BEAM_FRAMES + 8; frame++) {
    stepDuel(world, frame === 1 ? cast : controls());
    if (banishSwirl(kael, 0, out)) {
      live.push(frame);
      if (spread.length === 0) for (let index = 0; index < BANISH_SWIRL_COUNT; index++) {
        banishSwirl(kael, index, out);
        spread.push({ x: f32(out.x - kael.motion.x), z: f32(out.z - kael.motion.z) });
      }
    }
  }
  return { live, fighter: kael, spread };
}

test("Banish's swirls draw only on the beam's six live frames and run from Kael's hand to the beam's far end, facing right and left [k1 scenario]", () => {
  for (const facing of [1, -1] as const) {
    const { live, spread } = swirlsEachFrame(facing);
    assertEquals(live.length, BANISH_BEAM_FRAMES);
    assertEquals((live[BANISH_BEAM_FRAMES - 1] ?? 0) - (live[0] ?? 0), BANISH_BEAM_FRAMES - 1);
    assertTrue((live[0] ?? 0) >= BANISH_DELAY_FRAMES - 1 && (live[0] ?? 0) <= BANISH_DELAY_FRAMES + 1);
    assertEquals(spread.length, BANISH_SWIRL_COUNT);
    assertEquals(spread[0]?.x, f32(facing * BANISH_BEAM.x1));
    assertEquals(spread[BANISH_SWIRL_COUNT - 1]?.x, f32(facing * BANISH_BEAM.x2));
    assertTrue(spread.every(point => point.z === BANISH_BEAM.z1));
  }
  const idle = createFighter(Character.kaelthas, 0.0, 1);
  assertFalse(banishSwirl(idle, 0, { x: 0.0, z: 0.0 }));
});
