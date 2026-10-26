import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { type Controls, neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { TILT_STICK_DOWN, TILT_STICK_UP, TILT_STICK_X, stickX, stickZ } from "../sim/stick";
import { CROUCH_STICK_THRESHOLD, DASH_STICK_THRESHOLD, GroundState, SHIELD_DODGE_STICK_THRESHOLD, StickZone, TAP_JUMP_STICK_THRESHOLD, stickZone } from "../sim/stickZones";
import { bodyTop } from "../sim/surfaces";
import { beginFighterAttack } from "../sim/attacks";
import { attackStyleForGrounding } from "../input/combat";
import { advanceFighter } from "../sim/step";
import { advanceSolo, soloWorld } from "../sim/testWorld";
import { melee } from "../sim/tuning";
import { Action, maskOf } from "../input/actions";
import { adaptInput } from "./inputAdapter";
import { attackBuffer, takeAttack } from "../input/attackBuffer";
import { inputRow } from "../input/inputRow";
import { commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";

const STICK_UNIT = f32(0.0125);
const STAGE = 1;
const DECK = 1;
const DECK_Z = surfaceZ(STAGE, DECK, 0);
const CENTRE = f32(f32(surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
const SIDES = [Action.moveLeft, Action.moveRight];
const VERTICALS = [Action.moveUp, Action.moveDown];
const EIGHT_WAYS = [...SIDES.map(side => [side]), ...VERTICALS.map(vertical => [vertical]), ...SIDES.flatMap(side => VERTICALS.map(vertical => [side, vertical]))];

function keyboardDriver(fighter: Fighter) {
  const capture = keyboardCapture();
  const input = neutralControls();
  const attacks = attackBuffer(0);
  let frame = 0;
  return {
    input, attacks,
    sample(held: number): Readonly<Controls> {
      frame++;
      sampleKeys(capture, held);
      adaptInput(capture.row, fighter, frame, input, attacks);
      commitEdges(capture);
      return input;
    },
    step(held: number) { advanceSolo(fighter, STAGE, this.sample(held), 0.0); },
    attack() { return takeAttack(attacks, frame, true)?.style; },
  };
}

function onDeck(): Fighter {
  const f = createFighter(Character.rifleman, CENTRE, 1);
  f.motion.grounded = true; f.motion.surface = DECK; f.motion.z = DECK_Z;
  return f;
}

const tilt = (...actions: Action[]) => maskOf(Action.walk, ...actions);

test("the tilt modifier sends each axis one Melee stick unit inside roll and spot dodge, tap jump and crouch, and still picks walk and the tilts [k3 measure #282]", () => {
  for (const [threshold, value] of [[SHIELD_DODGE_STICK_THRESHOLD, TILT_STICK_X], [TAP_JUMP_STICK_THRESHOLD, TILT_STICK_UP], [CROUCH_STICK_THRESHOLD, TILT_STICK_DOWN]] as const) {
    assertTrue(value < threshold && Math.abs(threshold - value - STICK_UNIT) < f32(1e-6));
  }
  assertTrue(TILT_STICK_DOWN < SHIELD_DODGE_STICK_THRESHOLD && TILT_STICK_X < DASH_STICK_THRESHOLD);
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const cases = [
    { key: Action.moveRight, x: TILT_STICK_X, z: 0, style: AttackStyle.forwardTilt },
    { key: Action.moveLeft, x: -TILT_STICK_X, z: 0, style: AttackStyle.forwardTilt },
    { key: Action.moveUp, x: 0, z: TILT_STICK_UP, style: AttackStyle.upTilt },
    { key: Action.moveDown, x: 0, z: -TILT_STICK_DOWN, style: AttackStyle.downTilt },
  ];
  for (const { key, x, z, style } of cases) {
    const driver = keyboardDriver(fighter);
    driver.sample(0);
    const input = driver.sample(tilt(key, Action.attack));
    assertEquals(input.diStickX, x, `key ${key}: x`);
    assertEquals(input.diStickZ, z, `key ${key}: z`);
    assertEquals(input.driftStickX, x, `key ${key}: drift`);
    assertFalse(input.down);
    assertEquals(driver.attack(), style, `key ${key}: attack`);
    const zone = stickZone(input.diStickX, input.diStickZ, 0, 0, 1, GroundState.stand);
    assertTrue(zone !== StickZone.jump && zone !== StickZone.crouch && zone !== StickZone.dashFast && zone !== StickZone.dashSlow && zone !== StickZone.smashTurn);
  }
  for (const keys of EIGHT_WAYS.filter(keys => keys.length === 2)) {
    const input = keyboardDriver(fighter).sample(tilt(...keys));
    assertTrue(input.diStickX !== 0 && Math.abs(input.diStickX) <= TILT_STICK_X);
    assertTrue(input.diStickZ !== 0 && input.diStickZ <= TILT_STICK_UP && input.diStickZ >= -TILT_STICK_DOWN);
    assertFalse(input.down);
  }
  const analog = neutralControls();
  adaptInput(assertDefined(inputRow({ held: tilt(), axisX: 127, axisZ: -127 })), fighter, 1, analog, attackBuffer(0));
  assertTrue(Math.abs(analog.diStickX) <= TILT_STICK_X && analog.diStickZ >= -TILT_STICK_DOWN);
});

test("shield + tilt modifier tilts the shield by the modifier's values in all 8 directions and never rolls, spot dodges or jumps [k1 scenario]", () => {
  for (const keys of EIGHT_WAYS) {
    const fighter = onDeck();
    const driver = keyboardDriver(fighter);
    for (let frame = 0; frame < 8; frame++) driver.step(tilt(Action.rightTrigger));
    assertTrue(fighter.shield.raised);
    for (let frame = 0; frame < 12; frame++) {
      driver.step(tilt(Action.rightTrigger, ...keys));
      assertFalse(driver.input.groundDodgePressed);
      assertFalse(driver.input.jumpPressed);
      assertEquals(fighter.dodge.groundFrame, 0, `keys ${keys} frame ${frame}: dodged`);
      assertTrue(fighter.motion.grounded && fighter.shield.raised && fighter.jump.squat === 0);
      assertEquals(fighter.shield.tiltX, stickX(driver.input), `keys ${keys}: shield x`);
      assertEquals(fighter.shield.tiltZ, stickZ(driver.input), `keys ${keys}: shield z`);
    }
    if (keys.length === 1) {
      const [key] = keys;
      const expectedX = key === Action.moveRight ? TILT_STICK_X : key === Action.moveLeft ? -TILT_STICK_X : 0;
      const expectedZ = key === Action.moveUp ? TILT_STICK_UP : key === Action.moveDown ? -TILT_STICK_DOWN : 0;
      assertEquals(fighter.shield.tiltX, expectedX, `key ${key}: shield x`);
      assertEquals(fighter.shield.tiltZ, expectedZ, `key ${key}: shield z`);
    } else {
      assertTrue(fighter.shield.tiltX !== 0 && Math.abs(fighter.shield.tiltX) <= TILT_STICK_X);
      assertTrue(fighter.shield.tiltZ !== 0 && fighter.shield.tiltZ <= TILT_STICK_UP && fighter.shield.tiltZ >= -TILT_STICK_DOWN);
    }
  }
});

test("held tilt + down on a pass-through platform neither crouches, drops nor fast-falls, and tilt + side walks without dashing [k1 scenario]", () => {
  const standing = createFighter(Character.rifleman, CENTRE, 1);
  standing.motion.grounded = false; standing.motion.surface = undefined;
  standing.motion.z = f32(f32(DECK_Z - melee(bodyTop(standing.character))) - 0.5);
  standing.motion.vz = 12.0;
  const driver = keyboardDriver(standing);
  driver.step(maskOf(Action.moveDown));
  for (let frame = 0; frame < 20; frame++) driver.step(0);
  assertTrue(standing.motion.grounded); assertEquals(standing.motion.surface, DECK);
  for (let frame = 0; frame < 30; frame++) {
    driver.step(tilt(Action.moveDown));
    assertTrue(standing.motion.grounded);
    assertFalse(standing.motion.crouching);
  }
  driver.step(0);
  driver.step(maskOf(Action.moveDown));
  driver.step(maskOf(Action.moveDown));
  assertFalse(standing.motion.grounded);

  const falling = createFighter(Character.rifleman, CENTRE, 1);
  falling.motion.grounded = false; falling.motion.surface = undefined;
  falling.motion.z = f32(DECK_Z + 400.0); falling.motion.vz = -1.0;
  const air = keyboardDriver(falling);
  for (let frame = 0; frame < 6; frame++) air.step(0);
  for (let frame = 0; frame < 10; frame++) { air.step(tilt(Action.moveDown)); assertFalse(falling.motion.fastFalling); }

  for (const side of SIDES) {
    const walker = onDeck();
    const walk = keyboardDriver(walker);
    walk.step(0);
    for (let frame = 0; frame < 20; frame++) {
      walk.step(tilt(side));
      assertEquals(walker.ground.dashFrame, 0, `side ${side} frame ${frame}: dashed`);
      assertTrue(walker.ground.action !== GroundAction.dash && walker.ground.action !== GroundAction.run);
    }
    assertTrue(side === Action.moveRight ? walker.motion.vx > 0 : walker.motion.vx < 0);
  }
});

function fullHop(down: number, downAir: boolean) {
  const fighter = createFighter(Character.rifleman, CENTRE, 1);
  fighter.motion.grounded = true; fighter.motion.surface = 0; fighter.motion.z = surfaceZ(STAGE, 0, 0);
  const world = soloWorld(fighter);
  const driver = keyboardDriver(fighter);
  driver.step(0);
  let standsRising = false;
  let passed = false;
  let style: AttackStyle | undefined;
  for (let frame = 0; frame < 60; frame++) {
    const attack = downAir && style === undefined && !fighter.motion.grounded ? maskOf(Action.attack) : 0;
    const input = driver.sample((frame < 12 ? maskOf(Action.jump) : 0) | down | attack);
    const taken = attackStyleForGrounding(driver.attack() as AttackStyle | undefined, fighter.motion.grounded, fighter.facing, 0);
    if (taken !== undefined) { style = taken; beginFighterAttack(world, 0, taken, false); }
    const rising = !fighter.motion.grounded && fighter.motion.vz > 0;
    advanceFighter(world, 0, STAGE, input, 0.0);
    if (rising && fighter.motion.grounded && fighter.motion.surface === DECK) standsRising = true;
    if (!fighter.motion.grounded && fighter.motion.z > DECK_Z) passed = true;
  }
  return { standsRising, passed, style };
}

test("a full hop under a platform with tilt + down rises through it into a down air; full down stands on it unless the down air is out [k1 scenario]", () => {
  for (const downAir of [false, true]) {
    const tilted = fullHop(tilt(Action.moveDown), downAir);
    assertEquals(tilted.standsRising, false, `tilt + down, down air ${downAir}: stood on the platform while rising`);
    assertEquals(tilted.passed, true, `tilt + down, down air ${downAir}: never rose above the platform`);
    assertEquals(tilted.style, downAir ? AttackStyle.downAir : undefined);
  }
  const mounted = fullHop(maskOf(Action.moveDown), false);
  assertTrue(mounted.standsRising);
  assertFalse(mounted.passed);
  const diving = fullHop(maskOf(Action.moveDown), true);
  assertEquals(diving.style, AttackStyle.downAir);
  assertFalse(diving.standsRising);
  assertTrue(diving.passed);
});
