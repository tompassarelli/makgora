import { assertEquals, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { inputRow } from "../input/inputRow";
import { adaptInput } from "../match/inputAdapter";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { AttackStyle, Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Capsule, hurtCapsule, placeCapsule } from "./geometry/contactGeometry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { attackActiveFrames, attackStartupFrames } from "./moves";
import { setWorldMotionValue } from "./motion";
import { fighterAt } from "./roster";
import { beginAttack } from "./transitions";

const TAN_25_DEGREES = f32(0.466307658);
const TAN_40_DEGREES = f32(0.839099631);
const ORIGIN_X = 300.0;
const ORIGIN_Z = 200.0;

function airborne(fighter: Fighter, z: number): void {
  fighter.motion.z = z;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

test("Illidan's down air strikes once along his legs tilted about 30 degrees off vertical, feet leading down and toward his facing, for either facing [k3 measure #512]", () => {
  const body = hurtCapsule(Character.demonHunter);
  const lowQuarter = f32(f32(body.z1 + body.z2) * 0.25);
  const startup = attackStartupFrames(AttackStyle.downAir);
  const region = emptyHitRegion();
  const placed: Capsule = { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
  assertEquals(authoredHitRegionCount(AttackStyle.downAir), 1);
  for (const facing of [1, -1]) {
    for (let frame = startup; frame < startup + attackActiveFrames(AttackStyle.downAir); frame++) {
      authoredHitRegion(region, Character.demonHunter, AttackStyle.downAir, frame, 0, 0);
      assertEquals(region.window, 1);
      assertTrue(region.strike !== undefined);
      if (region.strike === undefined) return;
      placeCapsule(placed, region.strike, ORIGIN_X, ORIGIN_Z, facing);
      const feetFirst = placed.z2 < placed.z1;
      const footX = feetFirst ? placed.x2 : placed.x1;
      const footZ = feetFirst ? placed.z2 : placed.z1;
      const hipX = feetFirst ? placed.x1 : placed.x2;
      const hipZ = feetFirst ? placed.z1 : placed.z2;
      const forward = f32(f32(footX - hipX) * facing);
      const down = f32(hipZ - footZ);
      assertTrue(down > 0.0 && forward > 0.0);
      assertTrue(forward >= f32(down * TAN_25_DEGREES) && forward <= f32(down * TAN_40_DEGREES));
      assertLessThan(f32(footZ - ORIGIN_Z), lowQuarter);
    }
  }
});

test("Illidan's down air lands a single spiking hit on a foe at his feet [k3 measure #512]", () => {
  const state = createReplaySnapshot();
  const illidan = fighterAt(state.world, 0);
  const target = fighterAt(state.world, 1);
  copyFighterState(illidan, createFighter(Character.demonHunter, 0.0, 1), 3);
  copyFighterState(target, createFighter(Character.blademaster, 45.0, -1), 3);
  airborne(illidan, 300.0);
  airborne(target, 220.0);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 512;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  beginAttack(illidan, AttackStyle.downAir, false);
  let hits = 0;
  let damage = 0.0;
  let launchZ = 0.0;
  for (let tick = 1; tick <= 40; tick++) {
    const row = inputRow({ held: 0, pressed: 0, axisZ: 0, specialZ: 0 });
    if (row === undefined) throw new Error("empty input row");
    adaptInput(row, illidan, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (target.status.damage > damage) {
      hits++;
      damage = target.status.damage;
      launchZ = target.launch.knockbackZ;
    }
  }
  assertEquals(hits, 1);
  assertEquals(damage, 9.0);
  assertLessThan(launchZ, 0.0);
});
