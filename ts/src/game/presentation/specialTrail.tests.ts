import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot, type ReplayState } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { CHARGED_AIM_FRAMES, FOLLOW_UP_FORM } from "../sim/specials/schema";
import { THUNDER_LEAP_DIVE_FRAME } from "../fighters/mountain-king/specials";
import { SPECIAL_TRAIL_FRAMES, emptyTrailLine, specialTrail } from "./specialTrail";

const STICK = 127;
const DIVE_WATCH = 12;

const DIRECTIONS = [
  { name: "up", x: 0, z: 1 }, { name: "up-right", x: 1, z: 1 }, { name: "right", x: 1, z: 0 }, { name: "down-right", x: 1, z: -1 },
  { name: "down", x: 0, z: -1 }, { name: "down-left", x: -1, z: -1 }, { name: "left", x: -1, z: 0 }, { name: "up-left", x: -1, z: 1 },
] as const;

function step(state: ReplayState, king: Fighter, tick: number, x: number, z: number, special: boolean, upSpecial = false): void {
  const held = (x < 0 ? maskOf(Action.moveLeft) : x > 0 ? maskOf(Action.moveRight) : 0) | (z < 0 ? maskOf(Action.moveDown) : z > 0 ? maskOf(Action.moveUp) : 0)
    | (special ? maskOf(Action.special) : 0);
  const row = inputRow({ held, pressed: special ? maskOf(Action.special) : 0, axisX: x * STICK, axisZ: z * STICK, specialZ: upSpecial ? 1 : 0 });
  if (row === undefined) throw new Error("Mountain King input row");
  adaptInput(row, king, tick, state.controls.inputs[0], state.controls.commands[0]);
  stepMatch(state.match, state.world, state.controls, tick);
}

function diveMatch(): { state: ReplayState; king: Fighter } {
  const state = createReplaySnapshot();
  const king = fighterAt(state.world, 0);
  copyFighterState(king, createFighter(Character.mountainKing, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, 400.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 577;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  return { state, king };
}

test("Each of the eight Hammerfall dives draws its trail from his body back along the line he travels, never ahead of him or level on a slanted dive (#577) [k1 scenario]", () => {
  const line = emptyTrailLine();
  for (const direction of DIRECTIONS) {
    const { state, king } = diveMatch();
    let tick = 1;
    const aim = direction.x === 0 && direction.z === 1 ? { x: 1, z: 1 } : { x: 0, z: 1 };
    step(state, king, tick, aim.x, aim.z, true, true);
    assertEquals(king.special.action, SpecialAction.heroUp, `${direction.name}: Thunder Leap starts`);
    assertEquals(specialTrail(king, line), false, `${direction.name}: the leap draws no trail`);
    while (king.special.frame < THUNDER_LEAP_DIVE_FRAME - 1) {
      const aiming = king.special.frame <= CHARGED_AIM_FRAMES;
      step(state, king, ++tick, aiming ? aim.x : 0, aiming ? aim.z : 0, false);
    }
    step(state, king, ++tick, direction.x, direction.z, false);
    assertEquals(king.special.form >= FOLLOW_UP_FORM, true, `${direction.name}: the held change starts a dive`);
    let drawn = 0;
    for (let n = 0; n < DIVE_WATCH && !king.motion.grounded; n++) {
      const x = king.motion.x;
      const z = king.motion.z;
      step(state, king, ++tick, 0, 0, false);
      const travelX = f32(king.motion.x - x);
      const travelZ = f32(king.motion.z - z);
      if (!specialTrail(king, line) || (travelX === 0.0 && travelZ === 0.0)) continue;
      drawn++;
      const trailX = f32(line.x2 - line.x1);
      const trailZ = f32(line.z2 - line.z1);
      assertEquals(line.x1, king.motion.x, `${direction.name}: the trail starts on him`);
      assertEquals(Math.sign(trailX) === -Math.sign(travelX) || (Math.abs(trailX) < 1.0 && Math.abs(travelX) < 1.0), true, `${direction.name}: trail ${trailX} runs against travel ${travelX} sideways`);
      assertEquals(Math.sign(trailZ) === -Math.sign(travelZ) || (Math.abs(trailZ) < 1.0 && Math.abs(travelZ) < 1.0), true, `${direction.name}: trail ${trailZ} runs against travel ${travelZ} up or down`);
      assertEquals(Math.abs(trailX) <= f32(f32(SPECIAL_TRAIL_FRAMES * Math.abs(travelX)) + 1.0) && Math.abs(trailZ) <= f32(f32(SPECIAL_TRAIL_FRAMES * Math.abs(travelZ)) + 1.0), true, `${direction.name}: the trail reaches back at most ${SPECIAL_TRAIL_FRAMES} frames of travel`);
    }
    assertEquals(drawn >= 8, true, `${direction.name}: the trail shows on ${drawn} dive frames`);
  }
});
