import { assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { inputRow } from "../../input/inputRow";
import { adaptInput } from "../../match/inputAdapter";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { AttackStyle, Character } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import type { StrikeCapsule } from "../../sim/heroMoves";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { surfaceTopZ } from "../../sim/stage";
import { beginAttack } from "../../sim/transitions";
import { BLADEMASTER_MOVES, HEAD, SWORD_LENGTH, UP_AIR_DRAWN } from "./moves";

const RAISED_STAGE = 1;
const PLATFORM = 2;
const FOE_X = 260.0;
const BLADEMASTER_Z = 30.0;
const WATCH_FRAMES = 20;
const UP_AIR = BLADEMASTER_MOVES.normals[AttackStyle.upAir];

function place(fighter: Fighter, z: number, grounded: boolean, surface: number | undefined): void {
  fighter.motion.z = z;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = grounded;
  fighter.motion.surface = surface;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function upAirHitFrame(blademasterX: number): number {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, blademasterX, 1), 3);
  copyFighterState(foe, createFighter(Character.blademaster, FOE_X, -1), 3);
  const platformZ = surfaceTopZ(RAISED_STAGE, PLATFORM, 0);
  place(blademaster, BLADEMASTER_Z, false, undefined);
  place(foe, platformZ, true, PLATFORM);
  assertLessThan(f32(BLADEMASTER_Z + f32(HEAD.z2 + HEAD.radius)), platformZ);
  state.match.phase = Phase.match;
  state.match.stageChoice = RAISED_STAGE;
  state.match.matchSeed = 506;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  beginAttack(blademaster, AttackStyle.upAir, false);
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const row = inputRow({ held: 0, pressed: 0, axisZ: 0, specialZ: 0 });
    if (row === undefined) throw new Error("empty input row");
    adaptInput(row, blademaster, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (foe.status.damage > 0.0) return tick;
  }
  return 0;
}

function squaredDistanceToStrike(x: number, z: number, strike: Readonly<StrikeCapsule>): number {
  const dx = strike.x2 - strike.x1;
  const dz = strike.z2 - strike.z1;
  const lengthSquared = dx * dx + dz * dz;
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - strike.x1) * dx + (z - strike.z1) * dz) / lengthSquared));
  const offX = x - (strike.x1 + along * dx);
  const offZ = z - (strike.z1 + along * dz);
  return offX * offX + offZ * offZ;
}

test("Blademaster's up air hits a foe standing on a platform above his head, above and in front of him, and above and behind him [k1 scenario]", () => {
  assertTrue(UP_AIR !== undefined);
  if (UP_AIR === undefined) return;
  const offset = 60.0;
  for (const blademasterX of [FOE_X, FOE_X - offset, FOE_X + offset]) {
    const frame = upAirHitFrame(blademasterX);
    assertGreaterThan(frame, UP_AIR.startupFrames - 1);
    assertLessThan(frame, UP_AIR.startupFrames + UP_AIR.activeFrames);
  }
});

test("Blademaster's up air reaches a sword length above his head, and his blade tip lies inside its hit region on every active frame [k2 property]", () => {
  assertTrue(UP_AIR !== undefined);
  if (UP_AIR === undefined) return;
  assertTrue(UP_AIR_DRAWN.length === UP_AIR.activeFrames);
  let top = 0.0;
  for (const region of UP_AIR.regions) top = Math.max(top, region.hit.maxZ);
  assertGreaterThan(top, f32(f32(HEAD.z2 + HEAD.radius) + SWORD_LENGTH));
  for (let index = 0; index < UP_AIR.activeFrames; index++) {
    const frame = UP_AIR.startupFrames + index;
    const blade = UP_AIR_DRAWN[index];
    assertTrue(blade !== undefined);
    if (blade === undefined) continue;
    let inside = false;
    for (const region of UP_AIR.regions) {
      const strike = region.hit.strike;
      if (strike === undefined || frame < region.firstFrame || frame > region.lastFrame) continue;
      if (squaredDistanceToStrike(blade[2], blade[3], strike) <= strike.radius * strike.radius) inside = true;
    }
    assertTrue(inside);
  }
});
