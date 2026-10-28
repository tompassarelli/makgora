import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { originalClip } from "../../generated/clips/fighterOriginalClipInfo";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { advanceFighterPose, createFighterPose } from "./fighterPose";
import { CROUCH_KEY, crouchClip, crouchLoops } from "./crouchPose";
import { FRAME_SECONDS } from "./frameClock";

const PRESS = 31;
const RELEASE = PRESS + 120;
const SHUFFLE = [0, 30, -30, 45, -45, 20, -20, 0] as const;

interface Frame { readonly tick: number; readonly crouching: boolean; readonly animation: string; readonly clip: number | undefined; readonly time: number; readonly serial: number }

function heldCrouch(character: Character, jumpTick: number): readonly Frame[] {
  const state = createReplaySnapshot();
  const fighter = fighterAt(state.world, 0);
  copyFighterState(fighter, createFighter(character, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.peon, 900.0, -1), 3);
  state.match.phase = Phase.match;
  state.match.matchSeed = 1;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const pose = createFighterPose();
  const down = maskOf(Action.moveDown);
  const frames: Frame[] = [];
  for (let tick = 1; tick <= RELEASE + 40; tick++) {
    const held = tick >= PRESS && tick < RELEASE;
    const axisX = SHUFFLE[imod(idiv(tick, 6), SHUFFLE.length)] ?? 0;
    const jump = tick === jumpTick ? maskOf(Action.jump) : 0;
    const row = inputRow(held ? { held: down, pressed: tick === PRESS ? down : 0, axisX, axisZ: -127 } : { held: jump, pressed: jump, released: tick === RELEASE ? down : 0 });
    if (row === undefined) throw new Error("crouch input row");
    adaptInput(row, fighter, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    advanceFighterPose(pose, fighter, state.world, state.controls.inputs[0], false, false, false, false);
    frames.push({ tick, crouching: fighter.motion.crouching, animation: pose.animation, clip: pose.clipIndex, time: pose.clipTime, serial: pose.selectionSerial });
  }
  return frames;
}

for (const jumpTick of [0, PRESS - 4]) test(`Every fighter holding down plays its crouch without a restart while the stick shuffles in the down zone, a one-shot crouch holding its last pose and a looping crouch looping, and stands on the release frame${jumpTick > 0 ? ", also when down is held through a landing" : ""} [k1 scenario]`, () => {
  for (const character of Object.values(Character)) {
    const probe = createFighter(character, 0.0, 1);
    const clip = crouchClip(probe);
    if (clip === undefined) continue;
    const original = originalClip(character, clip.index);
    if (original !== undefined) assertEquals(Math.abs(f32(original.endSeconds - original.startSeconds) - clip.seconds) < FRAME_SECONDS, true, `fighter ${character}: the crouch maps to a clip of its own length`);
    const frames = heldCrouch(character, jumpTick);
    const start = frames.find((frame) => frame.animation === CROUCH_KEY)?.tick ?? RELEASE;
    assertEquals(start < RELEASE - 60, true, `fighter ${character}: crouches while down is held, from tick ${start}`);
    const held = frames.filter((frame) => frame.tick > start && frame.tick < RELEASE);
    const loops = crouchLoops(probe, clip);
    const first = held[0];
    if (first === undefined) throw new Error("no held frames");
    for (let index = 0; index < held.length; index++) {
      const frame = held[index];
      if (frame === undefined) continue;
      const at = `fighter ${character} tick ${frame.tick}`;
      assertEquals(frame.crouching, true, `${at}: still crouching`);
      assertEquals(frame.animation, CROUCH_KEY, `${at}: crouch key`);
      assertEquals(frame.clip, clip.index, `${at}: crouch clip`);
      assertEquals(frame.serial, first.serial, `${at}: the crouch clip never restarts`);
      const before = held[index - 1];
      if (loops) continue;
      assertEquals(frame.time < clip.seconds, true, `${at}: the crouch holds before its clip end`);
      if (before !== undefined) assertEquals(frame.time >= before.time, true, `${at}: crouch time never runs back`);
    }
    if (!loops) assertEquals(held[held.length - 1]?.time, f32(clip.seconds - FRAME_SECONDS), `fighter ${character}: the held crouch rests on its last pose`);
    const released = frames.find((frame) => frame.tick === RELEASE);
    assertEquals(released?.crouching, false, `fighter ${character}: stands on the release frame`);
    assertEquals(released?.animation === CROUCH_KEY, false, `fighter ${character}: leaves the crouch clip on the release frame`);
  }
});
