import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../generated/state/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { type Controls, copyControls, fighterAt } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ, surfaceCount, surfacePass } from "./stage";
import { CROUCH_STICK_THRESHOLD, STICK_DEADZONE } from "./stickZones";
import { bodyTop } from "./surfaces";
import { advanceSolo, controls, soloWorld } from "./testWorld";
import { melee } from "./tuning";
import { executeNext, testMatch } from "../match/testMatch";
import { queueAttack } from "../input/attackBuffer";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../presentation/impactEvents";
const STAGE = 1;
const DECK = 1;
const DECK_Z = surfaceZ(STAGE, DECK, 0);
const CENTRE = f32(f32(surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];
const step = (f: Fighter, input: Readonly<Controls>, stage = STAGE) => advanceSolo(f, stage, input, 0.0);
const attack = (f: Fighter, style: AttackStyle) => beginFighterAttack(soloWorld(f), 0, style, false);
const NONE = controls();
const analog = (z: number) => controls({ diStickValid: true, diStickZ: z, down: z < -CROUCH_STICK_THRESHOLD });
const KEY_DOWN = controls({ down: true, verticalDirection: -1 });
const HARD_DOWN = [KEY_DOWN, analog(-1.0)];
function risingUnder(character: Character): Fighter {
  const f = createFighter(character, CENTRE, 1);
  f.motion.grounded = false; f.motion.surface = undefined;
  f.motion.z = f32(f32(DECK_Z - melee(bodyTop(f.character))) - 0.5);
  f.motion.vz = 12.0; f.jump.remaining = 1;
  return f;
}
function assertMounted(f: Fighter): void {
  assertTrue(f.motion.grounded); assertEquals(f.motion.surface, DECK);
  assertEquals(f.motion.z, DECK_Z); assertEquals(f.landing.lag, 0); assertTrue(canAttack(f));
}
test("rising without down or during any aerial passes through; down past deadzone mounts instantly and remains actionable [k3 measure #103]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const input of [NONE, analog(f32(-0.27))]) {
      const f = risingUnder(character); step(f, input); assertFalse(f.motion.grounded); assertGreaterThan(f.motion.vz, 0);
    }
    for (const style of AERIALS) for (const input of HARD_DOWN) {
      const f = risingUnder(character); attack(f, style); step(f, input);
      assertFalse(f.motion.grounded); assertEquals(f.attack.style, style);
    }
    for (const input of [KEY_DOWN, analog(-STICK_DEADZONE), analog(f32(-0.5)), analog(-1.0)]) {
      const f = risingUnder(character); const events = createImpactEvents();
      captureImpactEventsBefore(events, f); step(f, input); finishImpactEventsAfter(events, f);
      assertMounted(f); assertTrue(events.ordinaryLanding);
      for (let frame = 0; frame < 8; frame++) { step(f, input); assertMounted(f); assertTrue(f.motion.crouching); }
    }
  }
});

test("rising with down-left or down-right passes through a platform so a waveland can follow [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const side of [-1, 1]) {
      for (const input of [controls({ down: true, verticalDirection: -1, direction: side }), controls({ diStickValid: true, diStickX: f32(side * 0.7), diStickZ: f32(-0.7), down: true })]) {
        const f = risingUnder(character); step(f, input);
        assertFalse(f.motion.grounded); assertGreaterThan(f.motion.vz, 0);
      }
    }
  }
});
test("keyboard and analog down-mount hold crouch, allow next-frame down tilt and down-B, and drop only on a fresh hard press [k3 measure #392]", () => {
  for (const input of HARD_DOWN) {
    for (const action of ["tilt", "special"] as const) {
      const match = testMatch(3, Character.rifleman); match.game.stageChoice = STAGE;
      const f = fighterAt(match.world, 0); copyFighterState(f, risingUnder(Character.rifleman), 3);
      fighterAt(match.world, 1).motion.x = 900.0;
      copyControls(match.inputs.inputs[0], input); executeNext(match); assertMounted(f);
      copyControls(match.inputs.inputs[0], controls({ ...input, attackRequested: action === "tilt", specialPressed: action === "special", specialZ: -1 }));
      if (action === "tilt") queueAttack(match.inputs.commands[0], { style: AttackStyle.downTilt, facing: 0, mayCharge: false, frame: match.runtime.simulationFrame + 1 });
      executeNext(match); assertTrue(f.motion.grounded);
      if (action === "tilt") assertEquals(f.attack.style, AttackStyle.downTilt);
      else assertEquals(f.special.action, SpecialAction.riflemanTrap);
    }
    const f = risingUnder(Character.rifleman); step(f, input);
    for (let frame = 0; frame < 8; frame++) step(f, input);
    assertMounted(f); step(f, NONE); step(f, input);
    assertFalse(f.motion.grounded); assertEquals(f.landing.lag, 0); assertTrue(canAttack(f)); assertFalse(f.motion.fastFalling);
    for (let frame = 0; frame < 6; frame++) { step(f, input); assertFalse(f.motion.fastFalling); }
    step(f, NONE); step(f, input); assertTrue(f.motion.fastFalling);
  }
  const slow = risingUnder(Character.rifleman);
  step(slow, analog(f32(-0.5)));
  step(slow, NONE);
  for (let frame = 0; frame < 5; frame++) step(slow, analog(f32(-0.5)));
  step(slow, analog(-1.0));
  assertMounted(slow);
  step(slow, analog(f32(-0.27)));
  step(slow, analog(-1.0));
  assertFalse(slow.motion.grounded);
});
test("falling full down passes through platforms and cancels every aerial immediately without forcing a fast fall [k3 measure #392]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const style of AERIALS) for (const input of HARD_DOWN) {
    const f = risingUnder(character); f.motion.z = f32(DECK_Z + 8.0); f.motion.vz = -f.tuning.physics.fastFallSpeed;
    attack(f, style); step(f, input);
    assertFalse(f.motion.grounded); assertTrue(f.motion.z < DECK_Z); assertEquals(f.attack.style, undefined);
    assertEquals(f.landing.lag, 0); assertTrue(canAttack(f)); assertFalse(f.motion.fastFalling);
  }
});
const ROUTE_STAGE = 2;
const TOP = 3;
test("Tom's route: falling down air, drop, up air, drop, double jump, rising up air passes through, down air across two platforms [k1 scenario]", () => {
  const f = createFighter(Character.rifleman, f32(surfaceRight(ROUTE_STAGE, TOP, 0) - 10.0), 1);
  f.motion.grounded = false; f.motion.surface = undefined; f.motion.z = f32(surfaceZ(ROUTE_STAGE, TOP, 0) + 20.0); f.jump.remaining = 1;
  const route: string[] = []; const note = (event: string) => { if (route[route.length - 1] !== event) route.push(event); };
  attack(f, AttackStyle.downAir);
  const down = controls({ direction: 1, down: true, verticalDirection: -1 }); const right = controls({ direction: 1 });
  let drops = 0; let passed = false;
  for (let frame = 1; frame <= 400 && !route.includes("down air"); frame++) {
    const oldZ = f.motion.z; const oldStyle = f.attack.style; let input = drops < 2 ? down : right;
    if (drops === 2 && f.jump.remaining > 0 && f.motion.vz < 0 && f.motion.z < f32(-f.motion.vz)) { input = controls({ jumpPressed: true, jumpHeld: true }); note("double jump"); }
    step(f, input, ROUTE_STAGE);
    if (drops < 2 && oldStyle !== undefined && f.attack.style === undefined && f.platform.dropConsumed && !f.motion.grounded) { drops++; note(`drop ${drops}`); }
    if (route.includes("rising up air") && f.motion.vz > 0) for (let deck = 0; deck < surfaceCount(ROUTE_STAGE); deck++) {
      const z = surfaceZ(ROUTE_STAGE, deck, 0);
      if (surfacePass(ROUTE_STAGE, deck) && oldZ < z && f.motion.z >= z && f.motion.x >= surfaceLeft(ROUTE_STAGE, deck, 0) && f.motion.x <= surfaceRight(ROUTE_STAGE, deck, 0)) { assertFalse(f.motion.grounded); passed = true; note("pass through"); }
    }
    if (!canAttack(f)) continue;
    if (drops === 1 && !route.includes("up air")) { attack(f, AttackStyle.upAir); note("up air"); }
    else if (route[route.length - 1] === "double jump" && f.motion.vz > 0) { attack(f, AttackStyle.upAir); note("rising up air"); }
    else if (passed) { attack(f, AttackStyle.downAir); note("down air"); }
  }
  assertEquals(route.join(", "), "drop 1, up air, drop 2, double jump, rising up air, pass through, down air");
});
test("platform down intent and consumed fast-fall input survive snapshot copy through release and re-press [k1 scenario]", () => {
  for (const down of HARD_DOWN) {
    const original = risingUnder(Character.rifleman); step(original, down); const copy = createFighter(Character.rifleman, 0.0, 1); copyFighterState(copy, original, 1);
    for (const input of [down, down, NONE, down, down, down, NONE, down]) { step(original, input); step(copy, input); assertEquals(firstFighterDifference(original, copy, 1, 1), undefined); }
    assertFalse(original.motion.grounded); assertTrue(original.motion.fastFalling);
  }
});
