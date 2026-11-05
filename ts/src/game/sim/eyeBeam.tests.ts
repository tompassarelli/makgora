import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../input/actions";
import { fighter, frame, scene } from "../match/padScene";
import { Character, ProjectileKind, SpecialAction } from "./codes";
import { EYE_BEAM_AIR_FRAMES, EYE_BEAM_AIR_SHOT, EYE_BEAM_DAMAGE, EYE_BEAM_GROUND_FRAMES, EYE_BEAM_GROUND_SHOT } from "./eyeBeam";

const FRAME_LIMIT = 120;

interface Shot {
  readonly shotFrame: number;
  readonly duration: number;
  readonly damage: number;
}

/** Presses neutral special on frame 1 (in the air from a full jump's apex when `air`) and records the special frame the beam appears on. */
function fireEyeBeam(air: boolean): Shot {
  const s = scene(0, [{ character: Character.demonHunter, x: 0.0, facing: 1 }, { character: Character.blademaster, x: 1800.0, facing: -1 }]);
  const user = fighter(s);
  if (air) {
    frame(s, [Action.jump]);
    for (let tick = 0; tick < FRAME_LIMIT && (user.motion.grounded || user.motion.vz > 0.0); tick++) frame(s, [Action.jump]);
  }
  frame(s, [Action.special]);
  const duration = user.special.duration;
  for (let tick = 0; tick < FRAME_LIMIT && user.special.action === SpecialAction.demonHunterEyeBeam; tick++) {
    const beam = user.projectiles.find((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.eyeBeam);
    if (beam !== undefined) return { shotFrame: user.special.frame, duration, damage: f32(EYE_BEAM_DAMAGE * beam.damageMultiplier) };
    frame(s, []);
  }
  return { shotFrame: 0, duration, damage: 0.0 };
}

test("Eye Beam fires on frame 23 and lasts 57 frames standing, fires on frame 13 and lasts 42 frames in the air, as Falco's Blaster does [k4 reference melee]", () => {
  const ground = fireEyeBeam(false);
  assertEquals(ground.shotFrame, EYE_BEAM_GROUND_SHOT);
  assertEquals(ground.duration, EYE_BEAM_GROUND_FRAMES);
  assertEquals([EYE_BEAM_GROUND_SHOT, EYE_BEAM_GROUND_FRAMES].join(" "), "23 57");
  const air = fireEyeBeam(true);
  assertEquals(air.shotFrame, EYE_BEAM_AIR_SHOT);
  assertEquals(air.duration, EYE_BEAM_AIR_FRAMES);
  assertEquals([EYE_BEAM_AIR_SHOT, EYE_BEAM_AIR_FRAMES].join(" "), "13 42");
});

