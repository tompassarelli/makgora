import { assertEquals, test } from "wisp/src/runtime/testing";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "../match/inputAdapter";
import { inputRow, type InputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { createReplaySnapshot } from "../replay/snapshot";
import { copyFighterState } from "../../generated/state/fighterState";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GroundAction, SpecialAction } from "./codes";
import type { Fighter } from "./fighter";
import { createFighter } from "./fighter";
import { setWorldMotionValue } from "./motion";
import { fighterAt } from "./roster";

const SHINES = [
  { name: "Maiev's Fan of Knives", character: Character.warden, action: SpecialAction.heroDown },
  { name: "Illidan's Immolate", character: Character.demonHunter, action: SpecialAction.demonHunterImmolate },
] as const;
const AIR_HEIGHT = 300.0;
const FOE_X = 600.0;
const TURN_TICK = 3;
const JUMP_TICK = 6;

type Press = "shine" | "shineBack" | "back" | "forward" | "jump" | "strongUp" | "none";

function row(press: Press): InputRow {
  const fields = press === "shine" ? { held: maskOf(Action.moveDown, Action.special), pressed: maskOf(Action.special), axisZ: -127, specialZ: -1 }
    : press === "shineBack" ? { held: maskOf(Action.moveDown, Action.moveLeft, Action.special), pressed: maskOf(Action.special), axisX: -127, axisZ: -127, specialX: -1, specialZ: -1 }
    : press === "back" ? { held: maskOf(Action.moveLeft), axisX: -127 }
    : press === "forward" ? { held: maskOf(Action.moveRight), axisX: 127 }
    : press === "jump" ? { held: maskOf(Action.jump), pressed: maskOf(Action.jump) }
    : press === "strongUp" ? { held: maskOf(Action.moveUp, Action.strong), pressed: maskOf(Action.moveUp, Action.strong), axisZ: 127 }
    : {};
  const built = inputRow(fields);
  if (built === undefined) throw new Error(`${press} input row`);
  return built;
}

function lift(fighter: Fighter): void {
  fighter.motion.z = AIR_HEIGHT;
  fighter.motion.vz = 0.0;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  setWorldMotionValue(fighter.motion.meleeVelocityZ, fighter.motion.vz);
}

function shineScene(character: Character, airborne: boolean, foeX = FOE_X) {
  const state = createReplaySnapshot();
  const user = fighterAt(state.world, 0);
  copyFighterState(user, createFighter(character, 0.0, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  if (airborne) lift(user);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 513;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const step = (tick: number, press: Press): void => {
    adaptInput(row(press), user, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
  };
  return { user, step };
}

for (const shine of SHINES) {
  for (const airborne of [false, true]) {
    const where = airborne ? "air" : "ground";

    test(`${shine.name} on the ${where} starts facing back when the stick is held away on the press frame [k1 scenario]`, () => {
      const { user, step } = shineScene(shine.character, airborne);
      step(1, "shineBack");
      assertEquals(user.special.action, shine.action, "the down special starts");
      assertEquals(user.facing, -1, "it starts facing the held side");
      const frame = user.special.frame;
      step(2, "none");
      assertEquals(user.special.action, shine.action, "it runs on");
      assertEquals(user.special.frame, frame + 1, "it advances a frame");
      assertEquals(user.facing, -1, "it keeps the new facing");
    });

    test(`${shine.name} on the ${where} turns around mid-move without restarting, and its jump cancel faces the new way [k1 scenario]`, () => {
      const { user, step } = shineScene(shine.character, airborne);
      step(1, "shine");
      assertEquals(user.special.action, shine.action, "the down special starts");
      assertEquals(user.facing, 1, "a straight-down press keeps the facing");
      let frame = user.special.frame;
      for (let tick = 2; tick <= JUMP_TICK; tick++) {
        step(tick, tick === TURN_TICK ? "back" : tick === JUMP_TICK ? "jump" : "none");
        if (tick === JUMP_TICK) break;
        assertEquals(user.special.action, shine.action, `tick ${tick}: still in the down special`);
        assertEquals(user.special.frame, frame + 1, `tick ${tick}: the move advances instead of restarting`);
        frame = user.special.frame;
        assertEquals(user.facing, tick < TURN_TICK ? 1 : -1, `tick ${tick}: facing`);
      }
      assertEquals(user.special.action, SpecialAction.none, "the jump cancels the down special");
      assertEquals(user.facing, -1, "the jump comes out facing the new way");
      for (let tick = JUMP_TICK + 1; tick <= JUMP_TICK + 8; tick++) step(tick, "none");
      assertEquals(!user.motion.grounded || user.jump.squat > 0, true, "the jump goes ahead");
      assertEquals(user.facing, -1, "the jump keeps the new facing");
    });
  }
}

const LAST_TICK = 12;

function cancelTick(character: Character, press: Press): number {
  for (let tick = 2; tick <= LAST_TICK; tick++) {
    const { user, step } = shineScene(character, false);
    step(1, "shine");
    for (let before = 2; before < tick; before++) step(before, "none");
    step(tick, press);
    if (user.special.action === SpecialAction.none) return tick;
  }
  return LAST_TICK + 1;
}

for (const shine of SHINES) {
  test(`${shine.name} on the ground is cancelled into an up smash on the first frame Strong + up is pressed once the jump cancel opens, the same frame a jump press cancels it [k1 scenario]`, () => {
    const opens = cancelTick(shine.character, "jump");
    assertEquals(opens <= LAST_TICK, true, "a jump press cancels it within the probe");
    const { user, step } = shineScene(shine.character, false);
    step(1, "shine");
    for (let tick = 2; tick < opens; tick++) step(tick, "none");
    step(opens, "strongUp");
    assertEquals(user.special.action, SpecialAction.none, "the down special ends");
    assertEquals(user.attack.style, AttackStyle.upSmash, "the up smash starts that frame");
  });

  test(`${shine.name} on the ground ignores Strong + up before the jump cancel opens, with the down special still running [k1 scenario]`, () => {
    const opens = cancelTick(shine.character, "jump");
    for (let tick = 2; tick < opens; tick++) {
      const { user, step } = shineScene(shine.character, false);
      step(1, "shine");
      for (let before = 2; before < tick; before++) step(before, "none");
      step(tick, "strongUp");
      assertEquals(user.special.action, shine.action, `tick ${tick}: the down special runs on`);
      assertEquals(user.attack.style, undefined, `tick ${tick}: no attack starts`);
    }
  });
}

const DASH_TICKS = 2;
const RUN_TICKS = 30;
const SLIDE_TICKS = 8;
const DRIFT_TICKS = 6;

function approach(character: Character, ticks: number) {
  const scene = shineScene(character, false, -FOE_X);
  for (let tick = 1; tick <= ticks; tick++) scene.step(tick, "forward");
  return scene;
}

for (const shine of SHINES) {
  for (const gait of [{ name: "dash", ticks: DASH_TICKS, action: GroundAction.dash }, { name: "run", ticks: RUN_TICKS, action: GroundAction.run }] as const) {
    test(`${shine.name} pressed out of a ${gait.name} on the ground slides forward, losing only traction each frame [k1 scenario]`, () => {
      const { user, step } = approach(shine.character, gait.ticks);
      assertEquals(user.ground.action, gait.action, `the approach is a ${gait.name}`);
      const traction = user.tuning.physics.traction;
      let speed = user.motion.vx;
      let x = user.motion.x;
      assertEquals(speed > traction * SLIDE_TICKS, true, "the approach carries enough speed to slide for the probe");
      for (let tick = gait.ticks + 1; tick <= gait.ticks + SLIDE_TICKS; tick++) {
        step(tick, tick === gait.ticks + 1 ? "shine" : "none");
        assertEquals(user.special.action, shine.action, `tick ${tick}: the down special runs`);
        assertEquals(user.motion.vx, Math.max(0.0, f32(speed - traction)), `tick ${tick}: speed falls by traction alone`);
        assertEquals(user.motion.x > x, true, `tick ${tick}: it keeps sliding forward`);
        speed = user.motion.vx;
        x = user.motion.x;
      }
    });
  }

  test(`${shine.name} pressed in the air with forward drift stops horizontally from its first frame [k1 scenario]`, () => {
    const { user, step } = shineScene(shine.character, true);
    for (let tick = 1; tick <= DRIFT_TICKS; tick++) step(tick, "forward");
    assertEquals(user.motion.vx > 0.0 && !user.motion.grounded, true, "it drifts forward in the air before the press");
    step(DRIFT_TICKS + 1, "shine");
    assertEquals(user.special.action, shine.action, "the down special starts");
    assertEquals(user.motion.vx, 0.0, "horizontal speed is zero on its first frame");
    const x = user.motion.x;
    step(DRIFT_TICKS + 2, "none");
    assertEquals(user.motion.vx, 0.0, "it stays zero");
    assertEquals(user.motion.x, x, "it does not move sideways");
  });
}
