import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "../sim/attacks";
import { AttackStyle, type Character, LedgeState } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { snapToLedge } from "../sim/ledge";
import { type Controls, type Roster, fighterAt } from "../sim/roster";
import { surfaceRight, surfaceZ } from "../sim/stage";
import { duelPair, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { SELECTABLE_CHARACTERS, fighterName } from "../roster/kits";
import { fillMeter } from "../sim/meter";
import { type FighterDraw, GRAB_HOLD_DEPTH, createFighterDraw, fitFighterDraw } from "./fighterDraw";
import { type FighterPose, advanceFighterPose, createFighterPose } from "./fighterPose";
import { teeterSide } from "./teeterLean";

const STAGE = 1;
const MAIN = 0;

interface Seen { held: number; grabbed: number; hung: number; teetered: number }

function onDeck(f: Fighter, x: number): void {
  f.motion.x = x;
  f.motion.z = surfaceZ(STAGE, MAIN, 0);
  f.motion.vx = 0.0;
  f.motion.grounded = true;
  f.motion.surface = MAIN;
}

function watch(world: Roster, poses: readonly FighterPose[], draws: readonly FighterDraw[], seen: Seen, frames: number, first: Readonly<Controls>, matchFrame: { value: number }): void {
  for (let frame = 0; frame < frames; frame++) {
    for (let slot = 0; slot < 2; slot++) fillMeter(fighterAt(world, slot));
    stepDuel(world, frame === 0 ? first : controls(), controls(), STAGE);
    matchFrame.value++;
    for (let slot = 0; slot < 2; slot++) {
      const f = fighterAt(world, slot), pose = poses[slot], draw = draws[slot];
      if (pose === undefined || draw === undefined) throw new Error("slot");
      advanceFighterPose(pose, f, world, controls(), false, false, false, false);
      const drawn = fitFighterDraw(draw, f.character, f, pose, STAGE, matchFrame.value, matchFrame.value);
      const name = `${fighterName(f.character)} frame ${matchFrame.value}`;
      assertTrue(drawn);
      assertEquals(draw.y, f.grab.target === undefined ? 0.0 : -GRAB_HOLD_DEPTH, `${name}: grab depth`);
      assertEquals(draw.pitch !== 0.0, teeterSide(f, STAGE, matchFrame.value) !== 0, `${name}: teeter lean`);
      if (f.grab.target !== undefined) seen.held++;
      if (f.grab.owner !== undefined) seen.grabbed++;
      if (f.ledge.state === LedgeState.hang) seen.hung++;
      if (draw.pitch !== 0.0) seen.teetered++;
    }
  }
}

function scenario(character: Character, seen: Seen): void {
  const edge = surfaceRight(STAGE, MAIN, 0);
  const { world, owner, target } = duelPair(createFighter(character, f32(edge - 140.0), 1), createFighter(character, f32(edge - 80.0), -1), 0, STAGE);
  const poses = [createFighterPose(), createFighterPose()], draws = [createFighterDraw(), createFighterDraw()];
  const matchFrame = { value: 0 };
  for (let i = 0; i < 3; i++) {
    onDeck(owner, f32(edge - 140.0));
    onDeck(target, f32(edge - 80.0));
    stepDuel(world, controls(), controls(), STAGE);
  }
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  watch(world, poses, draws, seen, 40, controls(), matchFrame);
  watch(world, poses, draws, seen, 60, controls({ direction: 1 }), matchFrame);
  onDeck(owner, edge);
  watch(world, poses, draws, seen, 30, controls(), matchFrame);
  if (snapToLedge(world, 1, STAGE, 1)) watch(world, poses, draws, seen, 30, controls(), matchFrame);
}

test("The meter rim and the body are drawn from one fighter draw that carries the grab hold depth and the edge teeter lean, for every fighter through grabs, throws, ledge hangs and teeters [k1 scenario]", () => {
  const seen: Seen = { held: 0, grabbed: 0, hung: 0, teetered: 0 };
  for (const character of SELECTABLE_CHARACTERS) scenario(character, seen);
  assertTrue(seen.held > 0);
  assertTrue(seen.grabbed > 0);
  assertTrue(seen.hung > 0);
  assertTrue(seen.teetered > 0);
});
