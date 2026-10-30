import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { ProjectileKind } from "../../sim/codes";
import type { Fighter, Projectile } from "../../sim/fighter";
import { mainDeckRight } from "../../sim/stage";
import { LAVA_RAZE, RAZE_ERUPT_FRAMES, RAZE_READ_FRAME, RAZE_REACH, RAZE_RADIUS, RAZE_UNIT } from "./specials";
import { type Duel, type Press, type Stick, duel, lift, step } from "./testDuel";

const PRESS_TICK = 3;
const PLACE_TICK = PRESS_TICK + RAZE_READ_FRAME - 1;
const FAR_AWAY = 2000.0;
const DIAGONAL = f32(0.7);
const TELL = LAVA_RAZE.ground.projectiles?.[0];

const NEAR_STICKS: readonly (readonly [string, number, number])[] = [
  ["down", 0, -1], ["no direction", 0, 0], ["back", -1, 0], ["back and down", -1, -DIAGONAL], ["up", 0, 1], ["back and up", -1, DIAGONAL],
];

type Aim = (tick: number, facing: number) => Stick;
const held = (x: number, z: number): Aim => (_tick, facing) => ({ x: x * facing, z });

const pressAt = (tick: number, release = Infinity): Press => tick === PRESS_TICK ? "down" : tick > PRESS_TICK && tick < release ? "hold" : "none";

const stickAt = (aim: Aim, tick: number, facing: number): Stick => tick < PRESS_TICK ? { x: 0, z: 0 } : tick === PRESS_TICK ? { x: 0, z: -1 } : aim(tick, facing);

function cast(d: Duel, aim: Aim, ticks: number, facing: number): void {
  for (let tick = 1; tick <= ticks; tick++) step(d, pressAt(tick), stickAt(aim, tick, facing));
}

const closeTo = (actual: number | undefined, expected: number, label = ""): void => {
  assertEquals(actual !== undefined && Math.abs(f32(actual - expected)) < f32(0.01), true, `${label} ${actual} is not ${expected}`);
};

const live = (f: Readonly<Fighter>): Projectile[] => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero);

interface Placed { readonly z: number; readonly ahead: number }

function placedAt(facing: number, aim: Aim, setup?: (d: Duel) => void, casterX = 0.0): Placed | undefined {
  const d = duel(FAR_AWAY, facing, casterX);
  setup?.(d);
  cast(d, aim, PLACE_TICK, facing);
  const tell = live(d.caster).find((projectile) => projectile.spec === TELL);
  return tell === undefined ? undefined : { z: tell.z, ahead: f32(f32(tell.x - d.caster.motion.x) * facing) };
}

const reachOf = (placed: Placed | undefined): number | undefined => placed?.ahead;

for (const facing of [1, -1]) {
  const side = facing > 0 ? "right" : "left";
  test(`Lava Raze erupts one unit ahead on down or no direction, two on down and forward, three on forward, facing ${side} [k3 measure docs/design/roster.md]`, () => {
    for (const [label, x, z] of NEAR_STICKS) closeTo(reachOf(placedAt(facing, held(x, z))), RAZE_REACH.near, label);
    closeTo(reachOf(placedAt(facing, held(DIAGONAL, -DIAGONAL))), RAZE_REACH.mid, "down and forward");
    closeTo(reachOf(placedAt(facing, held(1, 0))), RAZE_REACH.far, "forward");
    closeTo(reachOf(placedAt(facing, held(DIAGONAL, DIAGONAL))), RAZE_REACH.far, "forward and up");
  });

  test(`Lava Raze reads the stick on the frame the crack opens, facing ${side} [k3 measure docs/design/roster.md]`, () => {
    const releasedAtLast: Aim = (tick, side) => tick < PLACE_TICK ? { x: side, z: 0 } : { x: 0, z: 0 };
    const pushedAtLast: Aim = (tick, side) => tick < PLACE_TICK ? { x: 0, z: -1 } : { x: side, z: 0 };
    closeTo(reachOf(placedAt(facing, releasedAtLast)), RAZE_REACH.near, "forward let go on the last frame");
    closeTo(reachOf(placedAt(facing, pushedAtLast)), RAZE_REACH.far, "forward pushed on the last frame");
    const d = duel(FAR_AWAY, facing);
    cast(d, held(1, 0), PLACE_TICK, facing);
    const x = live(d.caster).find((projectile) => projectile.spec === TELL)?.x;
    for (let tick = 0; tick < RAZE_ERUPT_FRAMES; tick++) step(d, "hold", { x: 0, z: -1 });
    assertEquals(live(d.caster).find((projectile) => projectile.spec === TELL)?.x, x, "the crack stays where it opened");
  });
}

test("Lava Raze's three eruptions are one unit wide apart and tile with no gap [k3 measure docs/design/roster.md]", () => {
  closeTo(RAZE_UNIT, f32(2.0 * RAZE_RADIUS));
  closeTo(f32(RAZE_REACH.mid - RAZE_REACH.near), RAZE_UNIT);
  closeTo(f32(RAZE_REACH.far - RAZE_REACH.mid), RAZE_UNIT);
});

interface Struck { readonly damage: number; readonly later: number; readonly hitstun: number; readonly sideways: number; readonly rise: number }

function struckAt(facing: number, distance: number, aim: Aim): Struck | undefined {
  const d = duel(distance, facing);
  for (let tick = 1; tick <= 80; tick++) {
    step(d, pressAt(tick), stickAt(aim, tick, facing));
    if (d.foe.status.damage > 0.0) {
      const first = { damage: d.foe.status.damage, hitstun: d.foe.launch.hitstun };
      const startX = d.foe.motion.x;
      let rise = 0.0;
      for (let after = 0; after < 40; after++) {
        step(d, "none");
        rise = Math.max(rise, d.foe.motion.z);
      }
      const sideways = Math.abs(f32(d.foe.motion.x - startX));
      return { ...first, sideways, rise, later: d.foe.status.damage };
    }
  }
  return undefined;
}

test("Every Lava Raze eruption hits once for the same damage and launch, at each distance and facing [k3 measure docs/design/roster.md]", () => {
  let reference: Struck | undefined;
  for (const facing of [1, -1]) {
    for (const [distance, aim] of [[RAZE_REACH.near, held(0, -1)], [RAZE_REACH.mid, held(DIAGONAL, -DIAGONAL)], [RAZE_REACH.far, held(1, 0)]] as const) {
      const struck = struckAt(facing, distance, aim);
      assertEquals(struck !== undefined, true, `eruption at ${distance} facing ${facing}`);
      if (struck === undefined) continue;
      assertEquals(struck.later, struck.damage, "one hit only");
      assertGreaterThan(struck.damage, 0.0);
      assertGreaterThan(struck.rise, 0.0);
      reference = reference ?? struck;
      assertEquals(struck.damage, reference.damage, "same damage");
      assertEquals(struck.hitstun, reference.hitstun, "same hitstun");
      closeTo(struck.rise, reference.rise, "same lift");
      closeTo(struck.sideways, reference.sideways, "same sideways launch");
    }
  }
});

test("Lava Raze does not open past a ledge, and in the air erupts on the ground below the aimed point [k3 measure docs/design/roster.md]", () => {
  const edge = mainDeckRight(0);
  const nearEdge = f32(edge - RAZE_REACH.mid + 10.0);
  closeTo(reachOf(placedAt(1, held(0, -1), undefined, nearEdge)), RAZE_REACH.near, "the near eruption fits on the deck");
  assertEquals(placedAt(1, held(DIAGONAL, -DIAGONAL), undefined, nearEdge), undefined, "two units out is past the edge");
  assertEquals(placedAt(1, held(1, 0), undefined, nearEdge), undefined, "three units out is past the edge");
  const high = (d: Duel): void => lift(d.caster, 300.0, d.caster.motion.x);
  const below = placedAt(1, held(1, 0), high);
  assertEquals(below?.z, 0.0, "from the air it sits on the ground");
  closeTo(reachOf(below), RAZE_REACH.far);
  assertEquals(placedAt(1, held(1, 0), high, nearEdge), undefined, "from the air over the void it does not appear");
});

const ROLLBACK_END = 70;
const RELEASE_TICK = 40;
const rollbackAim: Aim = (_tick, facing) => ({ x: facing, z: 0 });

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(RAZE_REACH.far);
  const snapshot = createReplaySnapshot();
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) step(run, pressAt(tick, RELEASE_TICK), stickAt(rollbackAim, tick, 1));
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, pressAt(tick, RELEASE_TICK), stickAt(rollbackAim, tick, 1));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Lava Raze from mid-cast and from mid-eruption to the same state [k1 scenario]", () => {
  for (const saveTick of [PRESS_TICK + 6, PLACE_TICK + 3, PLACE_TICK + 10]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});
