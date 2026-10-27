import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { idiv } from "wisp/src/sim/intMath";
import { type MatchState, Phase, createMatchState } from "../lobby/lobbyState";
import { Character, DownState } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { ROSTER_MANA } from "../sim/mana";
import { createRoster } from "../sim/roster";
import { createBufferedFrameControls } from "./controls";
import { DROP_HEIGHT, DROP_INTERVAL_SECONDS, meterDropPoint, scheduleMeterDrops } from "./meterDrops";
import { matchSpawnX, stepMatch } from "./step";

const HOLD = 30;
const DROP_FRAMES = DROP_INTERVAL_SECONDS * 60;

interface Bout {
  readonly game: MatchState;
  readonly first: Fighter;
  readonly second: Fighter;
  readonly step: (this: void) => void;
}

function bout(drops: boolean, mode: (game: MatchState) => void = () => {}): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  game.startHold = HOLD;
  game.drops.on = drops;
  mode(game);
  const first = createFighter(Character.rifleman, matchSpawnX(0), 1);
  const second = createFighter(Character.rifleman, matchSpawnX(1), -1);
  const world = createRoster(3, [first, second]);
  scheduleMeterDrops(game);
  const controls = createBufferedFrameControls();
  let frame = 0;
  return { game, first, second, step: () => stepMatch(game, world, controls, ++frame) };
}

const playTo = (b: Bout, played: number): void => {
  while (b.game.matchFrame - b.game.startHold < played) b.step();
};

test("Both fighters gain one point every trickleFrames after GO and none in the start hold [k3 measure #484]", () => {
  const b = bout(false);
  playTo(b, 0);
  assertEquals(b.first.mana.points, 0);
  playTo(b, ROSTER_MANA.trickleFrames - 1);
  assertEquals(b.first.mana.points, 0);
  playTo(b, ROSTER_MANA.trickleFrames);
  assertEquals(b.first.mana.points, 1);
  assertEquals(b.second.mana.points, 1);
  playTo(b, 5 * ROSTER_MANA.trickleFrames);
  assertEquals(b.first.mana.points, 5);
  assertEquals(b.second.mana.points, 5);
});

test("The trickle stops at a full bar [k1 scenario]", () => {
  const b = bout(false);
  b.first.mana.points = ROSTER_MANA.max;
  playTo(b, 3 * ROSTER_MANA.trickleFrames);
  assertEquals(b.first.mana.points, ROSTER_MANA.max);
});

test("Drops spawn every DROP_INTERVAL_SECONDS after GO whether or not the last was taken, and a new orb replaces an untaken one [k3 measure #484]", () => {
  const b = bout(true);
  const spawnedAt: number[] = [];
  const points: number[] = [];
  let serial = b.game.drops.spawnSerial;
  while (spawnedAt.length < 3 && b.game.matchFrame - b.game.startHold < 3 * DROP_FRAMES) {
    const next = b.game.drops.nextPoint;
    b.step();
    if (b.game.drops.spawnSerial !== serial) {
      serial = b.game.drops.spawnSerial;
      spawnedAt.push(b.game.matchFrame - b.game.startHold);
      assertEquals(b.game.drops.point, next);
      points.push(b.game.drops.point);
    }
  }
  assertEquals(spawnedAt.length, 3);
  assertEquals(spawnedAt[0], DROP_FRAMES);
  assertEquals(spawnedAt[1], 2 * DROP_FRAMES);
  assertEquals(spawnedAt[2], 3 * DROP_FRAMES);
  assertEquals(b.game.drops.pickupSerial, 0);
  assertTrue(points.every((point) => point >= 0));
});

test("Taking a drop grants dropGain up to the full bar and leaves the next spawn on the clock [k1 scenario]", () => {
  const b = bout(true);
  playTo(b, DROP_FRAMES - 1);
  const point = meterDropPoint(b.game.stageChoice, b.game.drops.nextPoint);
  const nextSpawn = b.game.drops.nextSpawnFrame + DROP_FRAMES;
  b.first.motion.x = point.x;
  b.first.motion.z = point.z;
  b.first.mana.points = ROSTER_MANA.max - 1;
  b.step();
  assertEquals(b.game.drops.pickupSerial, 1);
  assertEquals(b.game.drops.lastTaker, 0);
  assertEquals(b.game.drops.point, -1);
  assertEquals(b.first.mana.points, ROSTER_MANA.max);
  assertTrue(b.second.mana.points < ROSTER_MANA.dropGain);
  assertEquals(b.game.drops.nextSpawnFrame, nextSpawn);
});

test("A tumbling fighter past hitstun passes over a drop and takes it once back on its feet [k1 scenario]", () => {
  const b = bout(true);
  playTo(b, DROP_FRAMES - 1);
  const point = meterDropPoint(b.game.stageChoice, b.game.drops.nextPoint);
  b.first.motion.x = point.x;
  b.first.motion.z = point.z + DROP_HEIGHT / 2;
  b.first.motion.grounded = false;
  b.first.down.state = DownState.tumble;
  b.first.launch.hitstun = 0;
  b.first.launch.hitlag = 0;
  b.step();
  assertEquals(b.first.down.state, DownState.tumble);
  assertEquals(b.game.drops.pickupSerial, 0);
  assertTrue(b.game.drops.point >= 0);
  b.first.down.state = DownState.none;
  b.step();
  assertEquals(b.game.drops.pickupSerial, 1);
  assertEquals(b.game.drops.lastTaker, 0);
});

test("Training and Classic or lore runs schedule no drops and fill the bar from the trickle alone [k1 scenario]", () => {
  for (const mode of ["training", "run"] as const) {
    const b = bout(true, (game) => {
      if (mode === "training") game.training = true;
      else game.run.active = true;
    });
    playTo(b, DROP_FRAMES + 2 * ROSTER_MANA.trickleFrames);
    assertEquals(b.game.drops.spawnSerial, 0);
    assertEquals(b.first.mana.points, idiv(DROP_FRAMES + 2 * ROSTER_MANA.trickleFrames, ROSTER_MANA.trickleFrames));
  }
});
