import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { inputRow } from "../../input/inputRow";
import { adaptInput } from "../../match/inputAdapter";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { AttackStyle, Character, HitElement } from "../codes";
import { type Fighter, createFighter } from "../fighter";
import { setWorldMotionValue } from "../motion";
import { fighterAt } from "../roster";
import { beginAttack } from "../transitions";
import { KAELTHAS_MOVES, kaelHit } from "./kaelthasMoves";

const PERCENTS = [0, 60, 120];
const GROUNDED_FOE = { kaelZ: 70.0, foeZ: 0.0, foeRise: 0.0 } as const;
const AIRBORNE_FOE = { kaelZ: 250.0, foeZ: 60.0, foeRise: 10.0 } as const;
const WATCH_FRAMES = 60;

function airborne(fighter: Fighter, z: number, vz: number): void {
  fighter.motion.z = z;
  fighter.motion.vz = vz;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function downAirFirstMove(percent: number, place: Readonly<{ kaelZ: number; foeZ: number; foeRise: number }>): number {
  const state = createReplaySnapshot();
  const kael = fighterAt(state.world, 0);
  const target = fighterAt(state.world, 1);
  copyFighterState(kael, createFighter(Character.kaelthas, 0.0, 1), 3);
  copyFighterState(target, createFighter(Character.blademaster, 6.0, -1), 3);
  target.status.damage = f32(percent);
  airborne(kael, place.kaelZ, 0.0);
  if (place.foeZ > 0.0 || place.foeRise > 0.0) airborne(target, place.foeZ, place.foeRise);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  beginAttack(kael, AttackStyle.downAir, false);
  let struck = false;
  let hitZ = 0.0;
  let firstMove = 0.0;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const row = inputRow({ held: 0, pressed: 0, axisZ: 0, specialZ: 0 });
    if (row === undefined) throw new Error("empty input row");
    adaptInput(row, kael, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (!struck && target.status.damage > percent) {
      struck = true;
      hitZ = target.motion.z;
    }
    if (!struck) continue;
    if (firstMove === 0.0) firstMove = target.motion.z - hitZ;
  }
  assertTrue(struck);
  return firstMove;
}

test("Kael'thas's down air sends a grounded or airborne foe upward at 0, 60 and 120 percent, never down [k1 scenario]", () => {
  for (const percent of PERCENTS) {
    assertGreaterThan(downAirFirstMove(percent, GROUNDED_FOE), 0.0);
    assertGreaterThan(downAirFirstMove(percent, AIRBORNE_FOE), 0.0);
  }
});

test("Kael'thas's normals and throws are arcane, and the hit helper his specials share stays fire [k2 property]", () => {
  for (const [style, move] of Object.entries(KAELTHAS_MOVES.normals)) {
    for (const region of move?.regions ?? []) {
      if (region.hit.effect.damage <= 0.0) continue;
      assertEquals(region.hit.effect.element, HitElement.arcane, `normal ${style}`);
    }
  }
  for (const [action, move] of Object.entries(KAELTHAS_MOVES.throws)) assertEquals(move?.effect.element, HitElement.arcane, `throw ${action}`);
  assertEquals(kaelHit(1.0, 35).element, HitElement.fire);
});
