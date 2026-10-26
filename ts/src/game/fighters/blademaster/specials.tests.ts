import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../../input/actions";
import { adaptInput } from "../../match/inputAdapter";
import { inputRow } from "../../input/inputRow";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { createReplaySnapshot } from "../../replay/snapshot";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character, SpecialAction } from "../../sim/codes";
import { createFighter, placedObject } from "../../sim/fighter";
import { fighterAt } from "../../sim/roster";
import { length } from "./moves";
import { MIRROR_IMAGE_OBJECT } from "./specials";

const TARGET_AHEAD = f32(length(f32(1.0)));
const WATCH_FRAMES = 90;
const BLADEMASTER_X = -200.0;
const FOE_X = 550.0;
const IMAGE_LIFE_FRAMES = 210;

interface WindWalkOnShield {
  readonly passed: boolean;
  readonly endSide: number;
  readonly shieldedThroughout: boolean;
  readonly struck: boolean;
  readonly damage: number;
  readonly hitstun: number;
  readonly pushedAway: boolean;
  readonly punishFrames: number;
}

function windWalkIntoShield(slashTick: number, slashX: number): WindWalkOnShield {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  const target = fighterAt(state.world, 1);
  copyFighterState(blademaster, createFighter(Character.blademaster, 0.0, 1), 3);
  copyFighterState(target, createFighter(Character.rifleman, TARGET_AHEAD, -1), 3);
  blademaster.mana.points = 100;
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 504;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const startX = target.motion.x;
  let passed = false;
  let shieldedThroughout = true;
  let struck = false;
  let damage = 0.0;
  let hitstun = 0;
  let actionableTick = 0;
  let recoveredTick = 0;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const walkRow = tick === 1
      ? { held: maskOf(Action.moveRight, Action.special), pressed: maskOf(Action.special), axisX: 127, specialX: 1 }
      : tick === slashTick
        ? { held: maskOf(slashX < 0 ? Action.moveLeft : Action.moveRight, Action.attack), pressed: maskOf(Action.attack), axisX: slashX * 127 }
        : {};
    const row = inputRow(walkRow);
    const shieldRow = inputRow({ held: maskOf(Action.rightTrigger), pressed: tick === 1 ? maskOf(Action.rightTrigger) : 0, triggerRight: 255 });
    if (row === undefined || shieldRow === undefined) throw new Error("Wind Walk input row");
    adaptInput(row, blademaster, tick, state.controls.inputs[0], state.controls.commands[0]);
    adaptInput(shieldRow, target, tick, state.controls.inputs[1], state.controls.commands[1]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(blademaster.special.action, SpecialAction.heroSide, "Blademaster starts Wind Walk");
    if (tick > 8 && tick < slashTick) shieldedThroughout &&= target.shield.raised;
    passed ||= blademaster.motion.x > target.motion.x;
    struck ||= target.shield.stun > 0;
    damage = target.status.damage;
    hitstun = Math.max(hitstun, target.launch.hitstun);
    if (struck && actionableTick === 0 && target.shield.stun <= 0 && target.launch.hitlag <= 0) actionableTick = tick;
    if (tick > 1 && recoveredTick === 0 && blademaster.special.action === SpecialAction.none) recoveredTick = tick;
  }
  const pushedAway = f32(f32(target.motion.x - startX) * f32(blademaster.motion.x - target.motion.x)) < 0.0;
  return { passed, endSide: Math.sign(blademaster.motion.x - target.motion.x), shieldedThroughout, struck, damage, hitstun, pushedAway, punishFrames: recoveredTick - actionableTick };
}

test("Blademaster's Wind Walk walks through a shielding opponent to the far side, and Backstab from behind or in front is an ordinary shield hit he can be punished for [k1 scenario]", () => {
  for (const [label, slashTick, slashX, side] of [["cross-up", 17, -1, 1], ["straight", 11, 1, -1]] as const) {
    const run = windWalkIntoShield(slashTick, slashX);
    assertEquals(run.shieldedThroughout, true, `${label}: the opponent keeps shielding as he walks`);
    if (side > 0) assertEquals(run.passed, true, `${label}: the walk passes the shielding opponent`);
    assertEquals(run.endSide, side, `${label}: side he ends on`);
    assertEquals(run.struck, true, `${label}: Backstab meets the shield`);
    assertEquals(run.damage, 0.0, `${label}: the shield takes the hit`);
    assertEquals(run.hitstun, 0, `${label}: no hitstun through the shield`);
    assertEquals(run.pushedAway, true, `${label}: shield pushback carries the opponent away from him`);
    assertGreaterThan(run.punishFrames, 0);
  }
});

test("Mirror Image still stands on frame 209 after placement and is gone on frame 210 [k3 measure #500]", () => {
  const state = createReplaySnapshot();
  const blademaster = fighterAt(state.world, 0);
  copyFighterState(blademaster, createFighter(Character.blademaster, BLADEMASTER_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, FOE_X, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 500;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let lastAge = 0;
  for (let tick = 1; tick <= MIRROR_IMAGE_OBJECT.frame + IMAGE_LIFE_FRAMES; tick++) {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : 0,
      pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: tick === 1 ? -127 : 0, specialZ: tick === 1 ? -1 : 0 });
    if (row === undefined) throw new Error("Blademaster input row");
    adaptInput(row, blademaster, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) assertEquals(blademaster.special.action, SpecialAction.heroDown, "Blademaster starts Mirror Image");
    const image = placedObject(blademaster);
    if (image.age === lastAge) continue;
    assertEquals(image.age, lastAge + 1, `tick ${tick}: the image ages one frame`);
    lastAge = image.age;
    assertEquals(image.life > 0, image.age < IMAGE_LIFE_FRAMES, `frame ${image.age} after placement: the image stands only before frame ${IMAGE_LIFE_FRAMES}`);
  }
  assertEquals(lastAge, IMAGE_LIFE_FRAMES, "the image reaches its last frame");
  assertEquals(MIRROR_IMAGE_OBJECT.life, IMAGE_LIFE_FRAMES, "Mirror Image life");
});
