import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { setWorldMotionValue } from "../sim/motion";
import { fighterAt } from "../sim/roster";
import { FOLLOW_UP_FORM } from "../sim/specials/schema";
import { BLADEMASTER_CLIPS } from "../fighters/blademaster/clips";
import { advanceFighterPose, createFighterPose } from "./fighterPose";

const AIR_HEIGHT = 3000.0;
const HELD_TICKS = 60;
const AFTER_RELEASE = 30;
const STANCE_SECONDS = BLADEMASTER_CLIPS.neutralSpecial.held;

interface Frame { readonly tick: number; readonly cutting: boolean; readonly clip: number | undefined; readonly time: number; readonly rate: number }

function heldQuickdraw(airborne: boolean): readonly Frame[] {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.blademaster, 600.0, -1), 3);
  if (airborne) {
    blademaster.motion.z = AIR_HEIGHT;
    blademaster.motion.vz = 0.0;
    blademaster.motion.grounded = false;
    blademaster.motion.surface = undefined;
    setWorldMotionValue(blademaster.motion.meleeZ, blademaster.motion.z);
    setWorldMotionValue(blademaster.motion.meleeVelocityZ, blademaster.motion.vz);
  }
  state.match.phase = Phase.match;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  const special = maskOf(Action.special);
  const frames: Frame[] = [];
  for (let tick = 1; tick <= HELD_TICKS + AFTER_RELEASE; tick++) {
    const row = inputRow(tick <= HELD_TICKS ? { held: special, pressed: tick === 1 ? special : 0 } : {});
    if (row === undefined) throw new Error("Quickdraw input row");
    adaptInput(row, blademaster, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, blademaster, state.world, state.controls.inputs[0], false, false, false, false);
    if (blademaster.special.action === SpecialAction.heroNeutral) {
      frames.push({ tick, cutting: blademaster.special.form >= FOLLOW_UP_FORM, clip: pose.clipIndex, time: pose.clipTime, rate: pose.rate });
    }
  }
  return frames;
}

for (const airborne of [false, true]) {
  test(`Holding Quickdraw ${airborne ? "in the air " : ""}keeps the blademaster on one still draw pose with no swing frames, and the cut plays only after release [k1 scenario]`, () => {
    const frames = heldQuickdraw(airborne);
    const stance = frames.filter((frame) => !frame.cutting);
    const cut = frames.filter((frame) => frame.cutting);
    assertTrue(stance.length >= HELD_TICKS - 1);
    for (const frame of stance) {
      assertEquals(frame.time, STANCE_SECONDS, `tick ${frame.tick}: the stance holds its draw frame`);
      assertEquals(frame.rate, 0.0, `tick ${frame.tick}: the stance is scrubbed, not free-running`);
    }
    assertTrue(cut.length > 0);
    assertTrue(cut.every((frame) => frame.tick > (stance[stance.length - 1]?.tick ?? 0)));
    assertTrue(cut.some((frame) => frame.time > (STANCE_SECONDS ?? 0)));
  });
}
