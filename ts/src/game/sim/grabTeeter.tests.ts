import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { groundState } from "./groundMovement";
import { type Controls, type Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { GroundState } from "./stickZones";
import { controls } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const STAGE = 1;
const PLATFORM = 2;
const MAIN = 0;
const DASH_FRAMES = 4;
const RUN_FRAMES = 20;
const DASH_GAP = 30.0;
const RUN_GAP = 60.0;
const FAR = -900.0;

interface Grab { readonly world: Roster; readonly f: Fighter; readonly target: Fighter }

function onDeck(f: Fighter, deck: number, x: number): void {
  f.motion.x = x;
  f.motion.z = surfaceZ(STAGE, deck, 0);
  f.motion.vx = 0.0;
  f.motion.grounded = true;
  f.motion.surface = deck;
}

function approach(deck: number, frames: number, gap: number, character: Character, targetX?: number): Grab {
  const edge = surfaceRight(STAGE, deck, 0);
  const start = f32(f32(edge - gap) - f32(frames * 8.0));
  const { world, owner, target } = duelPair(createFighter(character, start, 1), createFighter(Character.rifleman, FAR, -1), 0, STAGE);
  for (let i = 0; i < 3; i++) {
    onDeck(owner, deck, start);
    onDeck(target, MAIN, FAR);
    stepDuel(world, controls(), controls(), STAGE);
  }
  const toward = controls({ direction: 1 });
  for (let frame = 0; frame < frames && owner.motion.x < f32(edge - gap); frame++) stepDuel(world, toward, controls(), STAGE);
  if (targetX !== undefined) onDeck(target, deck, targetX);
  beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
  return { world, f: owner, target };
}

interface Whiff { readonly grounded: boolean; readonly reachedEdge: boolean; readonly endFrame: number }

function whiff(run: Grab, deck: number, input: Readonly<Controls>): Whiff {
  const edge = surfaceRight(STAGE, deck, 0);
  let grounded = true;
  let reachedEdge = false;
  let frame = 0;
  while (run.f.attack.style !== undefined && frame++ < 120) {
    stepDuel(run.world, input, controls(), STAGE);
    grounded = grounded && run.f.motion.grounded && run.f.motion.surface === deck && run.f.motion.x <= edge;
    reachedEdge = reachedEdge || run.f.motion.x === edge;
  }
  return { grounded, reachedEdge, endFrame: frame };
}

function teetersAfter(run: Grab, deck: number): boolean {
  const edge = surfaceRight(STAGE, deck, 0);
  if (run.f.motion.x !== edge || run.f.motion.vx !== 0.0 || groundState(run.f) !== GroundState.stand) return false;
  for (let i = 0; i < 30; i++) {
    stepDuel(run.world, controls(), controls(), STAGE);
    if (run.f.motion.x !== edge || !run.f.motion.grounded || run.f.motion.surface !== deck) return false;
  }
  return true;
}

test("Grab teeter: a dash grab or run grab carried to a platform edge or the stage edge stops there, stays grounded through its whole end lag even with the stick held toward the edge, and teeters on the first frame after [k1 scenario]", () => {
  for (const deck of [PLATFORM, MAIN]) {
    for (const { frames, gap } of [{ frames: DASH_FRAMES, gap: DASH_GAP }, { frames: RUN_FRAMES, gap: RUN_GAP }]) {
      for (const input of [controls(), controls({ direction: 1 })]) {
        const run = approach(deck, frames, gap, Character.rifleman);
        assertTrue(run.f.attack.dashGrab);
        assertGreaterThan(run.f.motion.vx, 0.0);
        const result = whiff(run, deck, input);
        assertTrue(result.grounded);
        assertTrue(result.reachedEdge);
        assertEquals(run.f.grab.action, GrabAction.none);
        if (input.direction === 0) assertTrue(teetersAfter(run, deck));
      }
    }
  }
});

test("Grab teeter: Kael'thas's Siphon Mana out of a dash stops at the platform edge and teeters after its end lag [k1 scenario]", () => {
  const run = approach(PLATFORM, DASH_FRAMES, DASH_GAP, Character.kaelthas);
  assertEquals(run.f.attack.style, AttackStyle.grab);
  const result = whiff(run, PLATFORM, controls());
  assertTrue(result.grounded && result.reachedEdge);
  assertTrue(teetersAfter(run, PLATFORM));
});

test("Grab teeter: a dash grab that catches a fighter standing at the edge holds it from the edge without leaving the deck [k1 scenario]", () => {
  const edge = surfaceRight(STAGE, PLATFORM, 0);
  const run = approach(PLATFORM, DASH_FRAMES, DASH_GAP, Character.rifleman, f32(edge - 4.0));
  let held = false;
  for (let frame = 0; frame < 60 && !held; frame++) {
    stepDuel(run.world, controls({ direction: 1 }), controls(), STAGE);
    assertTrue(run.f.motion.grounded && run.f.motion.x <= edge && run.f.motion.x >= surfaceLeft(STAGE, PLATFORM, 0));
    held = run.f.grab.target !== undefined;
  }
  assertTrue(held);
  assertEquals(run.target.grab.owner, 0);
  for (let i = 0; i < 20; i++) {
    stepDuel(run.world, controls(), controls(), STAGE);
    assertTrue(run.f.motion.grounded && run.f.motion.surface === PLATFORM && run.f.motion.x <= edge);
  }
  assertFalse(run.f.grab.action === GrabAction.none);
});
