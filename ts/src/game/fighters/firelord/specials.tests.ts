import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { imod } from "wisp/src/sim/intMath";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { ProjectileKind } from "../../sim/codes";
import type { Fighter, Projectile } from "../../sim/fighter";
import { mainDeckRight } from "../../sim/stage";
import { CRATER, FLOATING_TELL, RAZE_DAMAGE, RAZE_END_FRAME, RAZE_ERUPT_FRAMES, RAZE_FRONT, RAZE_GLOW_FRAMES, RAZE_LAUNCH_ANGLE, RAZE_MOTION_WINDOW, RAZE_READ_FRAME, RAZE_REACH, RAZE_TELL_FRAMES, RAZE_UNIT, TELL } from "./specials";
import { ANGLES } from "../../sim/heroes/authoring";
import { type Duel, type Press, type Stick, duel, lift, placeFoe, step } from "./testDuel";

const PRESS_TICK = 16;
const PLACE_TICK = PRESS_TICK + RAZE_READ_FRAME - 1;
const FAR_AWAY = 2000.0;
const DIAGONAL = f32(0.7);
const NEUTRAL: Stick = { x: 0, z: 0 };

type Script = (offset: number, facing: number) => Stick;
type Segment = readonly [x: number, z: number, frames: number];

const held = (x: number, z: number): Script => (_offset, facing) => ({ x: x * facing, z });

function ending(segments: readonly Segment[], after: Stick = NEUTRAL): Script {
  return (offset, facing) => {
    if (offset > 0) return { x: after.x * facing, z: after.z };
    let cursor = 0;
    for (let index = segments.length - 1; index >= 0; index--) {
      const [x, z, frames] = segments[index] ?? [0, 0, 0];
      if (offset > cursor - frames) return { x: x * facing, z };
      cursor -= frames;
    }
    return NEUTRAL;
  };
}

const quarterCircle = (stepFrames: number, holdFrames: number): Script => ending([[0, -1, stepFrames], [1, -1, stepFrames], [1, 0, holdFrames]]);

const NEAR_STICKS: readonly (readonly [string, Script])[] = [
  ["down", held(0, -1)], ["down on the press frame only", ending([[0, -1, 1]])],
];

const pressAt = (tick: number, release = Infinity): Press => tick === PRESS_TICK ? "down" : tick > PRESS_TICK && tick < release ? "hold" : "none";

function cast(d: Duel, script: Script, ticks: number, facing: number, special?: Stick): void {
  for (let tick = 1; tick <= ticks; tick++) step(d, pressAt(tick), script(tick - PRESS_TICK, facing), tick === PRESS_TICK ? special : undefined);
}

const closeTo = (actual: number | undefined, expected: number, label = ""): void => {
  assertEquals(actual !== undefined && Math.abs(f32(actual - expected)) < f32(0.01), true, `${label} ${actual} is not ${expected}`);
};

const live = (f: Readonly<Fighter>): Projectile[] => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero);

interface Placed { readonly z: number; readonly ahead: number; readonly casterZ: number; readonly floating: boolean }

const NEUTRAL_DOWN_PRESS: Stick = { x: 0, z: -1 };

function placedAt(facing: number, script: Script, setup?: (d: Duel) => void, casterX = 0.0, special?: Stick): Placed | undefined {
  const d = duel(FAR_AWAY, facing, casterX);
  setup?.(d);
  cast(d, script, PLACE_TICK, facing, special);
  const tell = live(d.caster).find((projectile) => projectile.spec === TELL || projectile.spec === FLOATING_TELL);
  return tell === undefined ? undefined : { z: tell.z, ahead: f32(f32(tell.x - d.caster.motion.x) * facing), casterZ: d.caster.motion.z, floating: tell.spec === FLOATING_TELL };
}

const reachOf = (placed: Placed | undefined): number | undefined => placed?.ahead;

test("Lava Raze erupts one unit ahead on down, two on down and forward and three on a quarter-circle forward, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const [label, script] of NEAR_STICKS) closeTo(reachOf(placedAt(facing, script)), RAZE_REACH.near, label);
    closeTo(reachOf(placedAt(facing, () => NEUTRAL, undefined, 0.0, NEUTRAL_DOWN_PRESS)), RAZE_REACH.near, "a neutral stick history");
    closeTo(reachOf(placedAt(facing, held(DIAGONAL, -DIAGONAL))), RAZE_REACH.mid, "down and forward");
    closeTo(reachOf(placedAt(facing, quarterCircle(3, 3))), RAZE_REACH.far, "quarter-circle forward");
    closeTo(reachOf(placedAt(facing, quarterCircle(2, 1))), RAZE_REACH.far, "a fast quarter-circle pressed as forward lands");
    closeTo(reachOf(placedAt(facing, ending([[0, -1, 3], [DIAGONAL, -DIAGONAL, 3], [1, 0, 2], [0, 0, 2]]))), RAZE_REACH.far, "quarter-circle let go before the press");
    closeTo(reachOf(placedAt(facing, ending([[0, -1, 12], [DIAGONAL, -DIAGONAL, 2]], { x: 1, z: 0 }))), RAZE_REACH.mid, "down then down and forward, forward only after the press");
  }
});

test("Lava Raze reads the stick history up to the press and nothing after it, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const lastFrame = RAZE_MOTION_WINDOW - 2;
    closeTo(reachOf(placedAt(facing, ending([[0, -1, 1], [1, -1, 1], [1, 0, lastFrame]]))), RAZE_REACH.far, "down on the oldest buffered frame");
    assertEquals(placedAt(facing, ending([[0, -1, 1], [1, -1, 1], [1, 0, lastFrame + 1]])), undefined, "down one frame older is not a quarter-circle and a plain forward press is not Lava Raze");
    assertEquals(placedAt(facing, held(1, 0)), undefined, "plain forward is the side special, not a far raze");
    closeTo(reachOf(placedAt(facing, ending([[0, -1, 5]], { x: 1, z: 0 }))), RAZE_REACH.near, "forward after a down press does not push it out");
    closeTo(reachOf(placedAt(facing, ending([[0, -1, 5], [DIAGONAL, -DIAGONAL, 3]], NEUTRAL))), RAZE_REACH.mid, "down and forward at the press, then let go");
    const d = duel(FAR_AWAY, facing);
    cast(d, quarterCircle(3, 3), PLACE_TICK, facing);
    const x = live(d.caster).find((projectile) => projectile.spec === TELL)?.x;
    for (let tick = 0; tick < RAZE_ERUPT_FRAMES; tick++) step(d, "hold", { x: 0, z: -1 });
    assertEquals(live(d.caster).find((projectile) => projectile.spec === TELL)?.x, x, "the crack stays where it opened");
  }
});

test("Lava Raze's three eruptions are evenly spaced one unit apart from his front out to the far one [k3 measure docs/design/roster.md]", () => {
  closeTo(f32(RAZE_REACH.near - RAZE_FRONT), RAZE_UNIT);
  closeTo(f32(RAZE_REACH.mid - RAZE_REACH.near), RAZE_UNIT);
  closeTo(f32(RAZE_REACH.far - RAZE_REACH.mid), RAZE_UNIT);
});

interface Struck { readonly damage: number; readonly later: number; readonly hitstun: number; readonly sideways: number; readonly rise: number }

function struckAt(facing: number, distance: number, script: Script): Struck | undefined {
  const d = duel(distance, facing);
  for (let tick = 1; tick <= 80; tick++) {
    step(d, pressAt(tick), script(tick - PRESS_TICK, facing));
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
    for (const [distance, script] of [[RAZE_REACH.near, held(0, -1)], [RAZE_REACH.mid, held(DIAGONAL, -DIAGONAL)], [RAZE_REACH.far, quarterCircle(3, 3)]] as const) {
      const struck = struckAt(facing, distance, script);
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

const SIDE_OFFSET = 20.0;
type Reach = keyof typeof RAZE_REACH;
const SCRIPTS: Readonly<Record<Reach, Script>> = { near: held(0, -1), mid: held(DIAGONAL, -DIAGONAL), far: quarterCircle(3, 3) };
const REACHES: readonly Reach[] = ["near", "mid", "far"];
const sign = (value: number): number => (value < 0 ? -1 : value > 0 ? 1 : 0);

function thrown(facing: number, reach: Reach, offset: number): { readonly side: number; readonly ratio: number } | undefined {
  const d = duel(f32(RAZE_REACH[reach] + offset), facing);
  for (let tick = 1; tick <= PLACE_TICK + 12; tick++) {
    if (tick === PLACE_TICK) placeFoe(d, f32(d.caster.motion.x + f32(f32(RAZE_REACH[reach] + offset) * facing)));
    step(d, pressAt(tick), SCRIPTS[reach](tick - PRESS_TICK, facing));
    if (d.foe.status.damage > 0.0) {
      const { knockbackX, knockbackZ } = d.foe.launch;
      return { side: sign(knockbackX), ratio: f32(Math.abs(knockbackX) / knockbackZ) };
    }
  }
  return undefined;
}

test("Lava Raze throws a foe left of the column's centre left, one right of it right and one on the centre away from Firelord, at 60 degrees up, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const reach of REACHES) {
      const beyond = thrown(facing, reach, SIDE_OFFSET);
      const short = thrown(facing, reach, -SIDE_OFFSET);
      const centre = thrown(facing, reach, 0.0);
      assertEquals(beyond?.side, facing, `${reach}: a foe beyond the centre goes away from Firelord`);
      assertEquals(short?.side, -facing, `${reach}: a foe on Firelord's side of the centre goes toward him`);
      assertEquals(centre?.side, facing, `${reach}: a foe on the centre goes away from Firelord`);
      for (const struck of [beyond, short, centre]) closeTo(struck?.ratio, f32(ANGLES[RAZE_LAUNCH_ANGLE].x / ANGLES[RAZE_LAUNCH_ANGLE].z), `${reach} launch angle`);
    }
  }
});

interface Escape { readonly x: number; readonly z: number; readonly mash: boolean }
const NO_ESCAPE: Escape = { x: 0, z: 0, mash: false };
const ESCAPES: readonly (readonly [string, Escape])[] = [
  ["no escape", NO_ESCAPE], ["DI toward Firelord", { x: -1, z: 0, mash: false }], ["DI away", { x: 1, z: 0, mash: false }],
  ["DI up", { x: 0, z: 1, mash: false }], ["DI down", { x: 0, z: -1, mash: false }], ["mashing every button", { ...NO_ESCAPE, mash: true }],
];
const SECOND_PRESS_TICK = PRESS_TICK + RAZE_END_FRAME;
const LOW_PERCENT = 0.0;
const MID_PERCENT = 40.0;
const CHAIN_PERCENT = 60.0;
const CHAIN_FROM_PERCENT = 50.0;
const CHAIN_TO_PERCENT = 70.0;
const ESCAPE_PERCENT = 86.0;

interface Chained { readonly hits: number; readonly hitstunBeforeSecond: number; readonly hitstunAfterFirst: number }

function chained(percent: number, first: Reach, offset: number, second: Reach, escape: Escape): Chained {
  const d = duel(f32(RAZE_REACH[first] + offset), 1);
  d.foe.status.damage = percent;
  const input = d.state.controls.inputs[1];
  if (input === undefined) throw new Error("foe input");
  let hits = 0;
  let damage = percent;
  let hitstunBeforeSecond = -1;
  let hitstunAfterFirst = -1;
  let previousHitstun = 0;
  for (let tick = 1; tick <= SECOND_PRESS_TICK + RAZE_READ_FRAME + RAZE_ERUPT_FRAMES + 8; tick++) {
    input.diStickValid = true;
    input.diStickX = escape.x;
    input.diStickZ = escape.z;
    input.jumpPressed = escape.mash && imod(tick, 2) === 0;
    input.shieldPressed = escape.mash && imod(tick, 2) === 1;
    input.attackPressed = escape.mash && imod(tick, 3) === 0;
    input.mashPressed = escape.mash;
    if (tick === PLACE_TICK - 1) placeFoe(d, f32(d.caster.motion.x + f32(RAZE_REACH[first] + offset)));
    const again = tick > SECOND_PRESS_TICK - RAZE_MOTION_WINDOW;
    const stick = again ? SCRIPTS[second](tick - SECOND_PRESS_TICK, 1) : SCRIPTS[first](tick - PRESS_TICK, 1);
    step(d, tick === PRESS_TICK || tick === SECOND_PRESS_TICK ? "down" : "none", stick);
    if (d.foe.status.damage > damage) {
      hits++;
      damage = d.foe.status.damage;
      if (hits === 1) hitstunAfterFirst = d.foe.launch.hitstun;
      if (hits === 2) hitstunBeforeSecond = previousHitstun;
    }
    previousHitstun = d.foe.launch.hitstun;
  }
  return { hits, hitstunBeforeSecond, hitstunAfterFirst };
}

const FIRST_OFFSETS = [-SIDE_OFFSET, f32(-0.5 * SIDE_OFFSET), 0.0, f32(0.5 * SIDE_OFFSET), SIDE_OFFSET];

function chainsAt(percent: number, escape: Escape): boolean {
  for (const first of REACHES) {
    for (const offset of FIRST_OFFSETS) {
      for (const second of REACHES) {
        const result = chained(percent, first, offset, second, escape);
        if (result.hits >= 2 && result.hitstunBeforeSecond > 0) return true;
      }
    }
  }
  return false;
}

test("A second Lava Raze, pressed the frame the first ends, hits a foe still in hitstun at 60 percent and not at 0 or 40, and hitstun is 23 frames at 0 percent and 38 at 40 [k3 measure docs/design/roster.md]", () => {
  assertEquals(chained(LOW_PERCENT, "far", 0.0, "far", NO_ESCAPE).hitstunAfterFirst, 23);
  assertEquals(chained(MID_PERCENT, "far", 0.0, "far", NO_ESCAPE).hitstunAfterFirst, 38);
  const named = chained(CHAIN_PERCENT, "far", -10.0, "near", NO_ESCAPE);
  assertEquals(named.hits, 2, "both erupt on the foe");
  assertGreaterThan(named.hitstunBeforeSecond, 0);
  assertEquals(chainsAt(LOW_PERCENT, NO_ESCAPE), false, "no chain at 0 percent");
  assertEquals(chainsAt(MID_PERCENT, NO_ESCAPE), false, "no chain at 40 percent");
  for (let percent = CHAIN_FROM_PERCENT; percent <= CHAIN_TO_PERCENT; percent += 10.0) assertEquals(chainsAt(percent, NO_ESCAPE), true, `chain at ${percent} percent`);
});

test("No Lava Raze chain is infinite: a mash-out escapes it by 60 percent, every DI by 86, and each hit adds 12 percent [k3 measure docs/design/roster.md]", () => {
  for (const [label, escape] of ESCAPES) {
    for (const percent of [ESCAPE_PERCENT, 90.0, 100.0, 120.0]) assertEquals(chainsAt(percent, escape), false, `${label} escapes at ${percent} percent`);
  }
  const mashing = ESCAPES[ESCAPES.length - 1]?.[1] ?? NO_ESCAPE;
  assertEquals(chainsAt(CHAIN_PERCENT, mashing), false, "a mash-out escapes at 60 percent");
  assertEquals(f32(CHAIN_FROM_PERCENT + f32(3.0 * RAZE_DAMAGE)) >= ESCAPE_PERCENT, true, "three more hits from the first chaining percent pass the escape percent");
});

const AIMS: readonly (readonly [Reach, Script])[] = [["near", held(0, -1)], ["mid", held(DIAGONAL, -DIAGONAL)], ["far", quarterCircle(3, 3)]];

test("Lava Raze erupts at its reach ahead and at his own height, on the deck and past the ledge from the ground, and over the deck and the void from the air, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const nearEdge = f32(f32(mainDeckRight(0) - f32(RAZE_REACH.mid - 10.0)) * facing);
    const overVoid = f32(f32(mainDeckRight(0) + 200.0) * facing);
    const high = (d: Duel): void => lift(d.caster, 700.0, d.caster.motion.x);
    for (const [reach, script] of AIMS) {
      const standing = placedAt(facing, script, undefined, nearEdge);
      closeTo(reachOf(standing), RAZE_REACH[reach], `${reach} from the ground facing ${facing}`);
      assertEquals(standing?.z, 0.0, `${reach} from the ground sits at the deck's height facing ${facing}`);
      assertEquals(standing?.floating, reach !== "near", `${reach} from the ground opens a crack only on the deck facing ${facing}`);
      for (const [where, casterX] of [["over the deck", 0.0], ["over the void", overVoid]] as const) {
        const flying = placedAt(facing, script, high, casterX);
        closeTo(reachOf(flying), RAZE_REACH[reach], `${reach} in the air ${where} facing ${facing}`);
        closeTo(flying?.z, flying?.casterZ ?? Number.NaN, `${reach} in the air ${where} sits at his height facing ${facing}`);
        assertEquals(flying?.floating, true, `${reach} in the air ${where} opens no crack facing ${facing}`);
      }
    }
  }
});

test("A Lava Raze past the ledge hits a foe hanging just off it at the stage's height, and a raze in mid-air leaves no scorch, facing either way [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const nearEdge = f32(f32(mainDeckRight(0) - f32(RAZE_REACH.mid - 10.0)) * facing);
    const d = duel(RAZE_REACH.far, facing, nearEdge);
    let struck = false;
    for (let tick = 1; tick <= PLACE_TICK + RAZE_TELL_FRAMES + RAZE_ERUPT_FRAMES + RAZE_GLOW_FRAMES + 4; tick++) {
      if (!struck) lift(d.foe, 0.0, f32(nearEdge + f32(RAZE_REACH.far * facing)));
      step(d, pressAt(tick), quarterCircle(3, 3)(tick - PRESS_TICK, facing));
      struck = struck || d.foe.status.damage > 0.0;
    }
    assertEquals(d.foe.status.damage, RAZE_DAMAGE, `the foe off the ledge is hit facing ${facing}`);
    assertEquals(live(d.caster).some((projectile) => projectile.spec === CRATER), false, `no scorch in mid-air facing ${facing}`);
  }
});

const SLOW_QUARTER_CIRCLE = ending([[0, -1, 1], [1, -1, 4], [1, 0, 5]]);
const ROLLBACK_END = PRESS_TICK + 54;
const RELEASE_TICK = PRESS_TICK + 37;

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(RAZE_REACH.far);
  const script = SLOW_QUARTER_CIRCLE;
  const snapshot = createReplaySnapshot();
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) step(run, pressAt(tick, RELEASE_TICK), script(tick - PRESS_TICK, 1));
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    step(run, pressAt(tick, RELEASE_TICK), script(tick - PRESS_TICK, 1));
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays Lava Raze from mid-motion, across the press, mid-cast and mid-eruption to the same state, and the stick history is in that state [k1 scenario]", () => {
  const canonicalAfter = (script: Script): string => {
    const run = duel(RAZE_REACH.far);
    for (let tick = 1; tick < PRESS_TICK; tick++) step(run, "none", script(tick - PRESS_TICK, 1));
    return canonicalState(run.state);
  };
  assertEquals(canonicalAfter(SLOW_QUARTER_CIRCLE) === canonicalAfter(() => NEUTRAL), false, "a quarter-circle before the press is in the canonical state");
  for (const saveTick of [PRESS_TICK - 7, PRESS_TICK - 2, PRESS_TICK, PRESS_TICK + 6, PLACE_TICK + 3, PLACE_TICK + 10]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});
