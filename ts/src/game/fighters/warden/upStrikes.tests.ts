import { assertGreaterThan, assertLessThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { inputRow } from "../../input/inputRow";
import { adaptInput } from "../../match/inputAdapter";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { AttackStyle, Character } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { setWorldMotionValue } from "../../sim/motion";
import { fighterAt } from "../../sim/roster";
import { mainDeckZAt, surfaceTopZ } from "../../sim/stage";
import { beginAttack } from "../../sim/transitions";
import { WARDEN_MOVES } from "./moves";

const RAISED_STAGE = 1;
const PLATFORM = 2;
const FOE_X = 260.0;
const WATCH_FRAMES = 30;

function place(fighter: Fighter, z: number, surface: number): void {
  fighter.motion.z = z;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = true;
  fighter.motion.surface = surface;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function hitFrame(style: AttackStyle, maievX: number): number {
  const state = createReplaySnapshot();
  const maiev = fighterAt(state.world, 0);
  const foe = fighterAt(state.world, 1);
  copyFighterState(maiev, createFighter(Character.warden, maievX, 1), 3);
  copyFighterState(foe, createFighter(Character.warden, FOE_X, -1), 3);
  const groundZ = mainDeckZAt(RAISED_STAGE, maievX);
  const platformZ = surfaceTopZ(RAISED_STAGE, PLATFORM, 0);
  place(maiev, groundZ, 0);
  place(foe, platformZ, PLATFORM);
  assertLessThan(f32(groundZ + HERO_REFERENCE_HEIGHT), platformZ);
  state.match.phase = Phase.match;
  state.match.stageChoice = RAISED_STAGE;
  state.match.matchSeed = 508;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  beginAttack(maiev, style, false);
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const row = inputRow({ held: 0, pressed: 0, axisZ: 0, specialZ: 0 });
    if (row === undefined) throw new Error("empty input row");
    adaptInput(row, maiev, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (foe.status.damage > 0.0) return tick;
  }
  return 0;
}

for (const [name, style] of [["up smash", AttackStyle.upSmash], ["up tilt", AttackStyle.upTilt]] as const) {
  test(`Maiev's ${name} hits a foe standing on a platform above her head within its active frames [k1 scenario]`, () => {
    const move = WARDEN_MOVES.normals[style];
    if (move === undefined) throw new Error(`Maiev has no ${name}`);
    for (const maievX of [FOE_X - 10.0, FOE_X, FOE_X + 10.0]) {
      const frame = hitFrame(style, maievX);
      assertGreaterThan(frame, move.startupFrames - 1);
      assertLessThan(frame, move.startupFrames + move.activeFrames);
    }
  });
}
