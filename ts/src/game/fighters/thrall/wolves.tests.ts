import { assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { Character, ProjectileKind, SpecialAction } from "../../sim/codes";
import type { Fighter, Projectile } from "../../sim/fighter";
import type { SpecialProjectile } from "../../sim/specials/schema";
import { floorBelow, mainDeckRight, mainDeckZ } from "../../sim/stage";
import { type Duel, type Press, type Stick, lift, stickDuel, step } from "../../sim/stickDuel";
import { DIRE_SPEED, DIRE_WOLF, SPIRIT_SPEED, SPIRIT_WOLF, TIMBER_SPEED, TIMBER_WOLVES, WOLF_RUN, WolfForm } from "./wolves";

const PRESS_TICK = 12;
const FAR = 3000.0;
const DIAGONAL = f32(0.7);
const NEUTRAL: Stick = { x: 0, z: 0 };
const STAND_TOLERANCE = 1.0;
const DESIGNED_WINDOW = 10;
const DESIGNED_BITES = 3;

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
const pressAt = (tick: number): Press => (tick === PRESS_TICK ? "down" : "none");

function thrallDuel(foeAhead = FAR, facing = 1, casterX = 0.0, foe: Character = Character.peon): Duel {
  return stickDuel(Character.thrall, foe, foeAhead, facing, casterX);
}

function cast(d: Duel, script: Script, ticks: number, facing: number): void {
  for (let tick = 1; tick <= ticks; tick++) step(d, pressAt(tick), script(tick - PRESS_TICK, facing));
}

const wolves = (f: Readonly<Fighter>): Projectile[] => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec?.runs !== undefined);

function castWith(script: Script, facing: number): string {
  const d = thrallDuel(FAR, facing);
  cast(d, script, PRESS_TICK + 1, facing);
  return d.caster.special.action === SpecialAction.heroDown ? `down ${d.caster.special.variant}` : d.caster.special.action === SpecialAction.heroSide ? "side" : `other ${d.caster.special.action}`;
}

const formOf = (form: WolfForm): string => `down ${form}`;


test("Feral Spirit picks its wolf by the stick's motion: down the spirit wolf, down and forward the timber wolves, a quarter-circle forward the dire wolf, and plain forward is Ghost Wolf, facing either way [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    assertEquals(castWith(held(0, -1), facing), formOf(WolfForm.spirit), "down");
    assertEquals(castWith(held(DIAGONAL, -DIAGONAL), facing), formOf(WolfForm.timber), "down and forward");
    assertEquals(castWith(quarterCircle(3, 3), facing), formOf(WolfForm.dire), "quarter-circle forward");
    assertEquals(castWith(quarterCircle(2, 1), facing), formOf(WolfForm.dire), "a fast quarter-circle");
    assertEquals(castWith(held(1, 0), facing), "side", "plain forward");
    assertEquals(castWith(ending([[0, -1, 5]], { x: 1, z: 0 }), facing), formOf(WolfForm.spirit), "forward after a down press");
  }
});

test("Feral Spirit reads the quarter-circle up to its oldest buffered frame and no further: one frame older is a plain forward press, Ghost Wolf [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    const lastFrame = DESIGNED_WINDOW - 2;
    assertEquals(castWith(ending([[0, -1, 1], [1, -1, 1], [1, 0, lastFrame]]), facing), formOf(WolfForm.dire), "down on the oldest buffered frame");
    assertEquals(castWith(ending([[0, -1, 1], [1, -1, 1], [1, 0, lastFrame + 1]]), facing), "side", "down one frame older");
  }
});

const footOf = (projectile: Readonly<Projectile>): number => f32(projectile.z - (projectile.spec?.radius ?? 0.0));

interface Run { readonly grounded: boolean; readonly speeds: readonly number[]; readonly frames: number }

function runOf(script: Script, facing: number, frames: number): Run {
  const d = thrallDuel(FAR, facing);
  cast(d, script, PRESS_TICK, facing);
  const floor = mainDeckZ(0);
  let grounded = true;
  const speeds: number[] = [];
  const last = new Map<number, number>();
  let seen = 0;
  for (let tick = 0; tick < frames; tick++) {
    step(d, "none");
    for (const wolf of wolves(d.caster)) {
      seen++;
      if (Math.abs(f32(footOf(wolf) - floor)) > STAND_TOLERANCE) grounded = false;
      const before = last.get(wolf.serial * 8 + d.caster.projectiles.indexOf(wolf));
      if (before !== undefined && wolf.poolWait === 0 && wolf.poolHits === 0) speeds.push(f32(f32(wolf.x - before) * facing));
      last.set(wolf.serial * 8 + d.caster.projectiles.indexOf(wolf), wolf.x);
    }
  }
  return { grounded: grounded && seen > 0, speeds, frames: seen };
}

const FORMS: readonly (readonly [string, Script, number])[] = [
  ["spirit wolf", held(0, -1), SPIRIT_SPEED], ["timber wolves", held(DIAGONAL, -DIAGONAL), TIMBER_SPEED], ["dire wolf", quarterCircle(3, 3), DIRE_SPEED],
];

test("Every wolf runs with its feet on the floor at its own speed, facing either way [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    for (const [label, script, speed] of FORMS) {
      const run = runOf(script, facing, 60);
      assertTrue(run.grounded);
      assertGreaterThan(run.speeds.length, 5);
      for (const measured of run.speeds) assertNear(measured, speed, f32(0.01));
    }
  }
});

test("The dire wolf is the fastest wolf and the spirit wolf the slowest [k3 measure docs/design/thrall.md]", () => {
  const speed = (script: Script): number => runOf(script, 1, 30).speeds[0] ?? 0.0;
  const [spirit, timber, dire] = [speed(held(0, -1)), speed(held(DIAGONAL, -DIAGONAL)), speed(quarterCircle(3, 3))];
  assertGreaterThan(dire, timber);
  assertGreaterThan(timber, spirit);
});

test("A wolf that runs off a ledge falls under gravity and lands on the floor below, then runs on [k3 measure docs/design/thrall.md]", () => {
  const ledge = mainDeckRight(0);
  const d = thrallDuel(FAR, -1, f32(ledge - 60.0));
  d.caster.facing = 1;
  cast(d, held(0, -1), PRESS_TICK, 1);
  let fell = false;
  for (let tick = 0; tick < 40; tick++) {
    step(d, "none");
    const wolf = wolves(d.caster)[0];
    if (wolf !== undefined && wolf.x > ledge && footOf(wolf) < f32(mainDeckZ(0) - 20.0)) fell = true;
  }
  assertTrue(fell);
});

function airCast(spec: (air: boolean) => SpecialProjectile, script: Script, height: number): { aheadAtSpawn: number; fell: boolean; landed: boolean; ranAfter: number } {
  const d = thrallDuel(FAR, 1);
  for (let tick = 1; tick <= PRESS_TICK; tick++) {
    lift(d.caster, f32(mainDeckZ(0) + height), d.caster.motion.x);
    d.caster.jump.remaining = 0;
    step(d, pressAt(tick), script(tick - PRESS_TICK, 1));
  }
  let aheadAtSpawn = -1.0;
  let fell = false;
  let landed = false;
  let landX = 0.0;
  let ranAfter = 0.0;
  let lastVz = 0.0;
  for (let tick = 0; tick < 70; tick++) {
    lift(d.caster, f32(mainDeckZ(0) + height), d.caster.motion.x);
    step(d, "none");
    const wolf = wolves(d.caster).find((projectile) => projectile.spec === spec(true) || projectile.spec?.model === spec(true).model);
    if (wolf === undefined) continue;
    if (aheadAtSpawn < 0.0) aheadAtSpawn = f32(wolf.x - d.caster.motion.x);
    if (!landed && wolf.velocityZ < lastVz) fell = true;
    lastVz = wolf.velocityZ;
    if (!landed && Math.abs(f32(footOf(wolf) - mainDeckZ(0))) <= STAND_TOLERANCE) {
      landed = true;
      landX = wolf.x;
    }
    if (landed) ranAfter = f32(wolf.x - landX);
  }
  return { aheadAtSpawn, fell, landed, ranAfter };
}

test("Cast in the air, each wolf appears ahead of Thrall, pounces and falls under gravity, lands on the floor and keeps running forward [k3 measure docs/design/thrall.md]", () => {
  for (const [label, spec, script] of [["spirit", SPIRIT_WOLF, held(0, -1)], ["timber", (air: boolean) => TIMBER_WOLVES(air)[0] as SpecialProjectile, held(DIAGONAL, -DIAGONAL)], ["dire", DIRE_WOLF, quarterCircle(3, 3)]] as const) {
    const air = airCast(spec, script, 160.0);
    assertGreaterThan(air.aheadAtSpawn, 0.0);
    assertTrue(air.fell);
    assertTrue(air.landed);
    assertGreaterThan(air.ranAfter, 30.0);
  }
  assertGreaterThan(WOLF_RUN.gravity, 0.0);
});

test("Thrall can walk in behind his spirit wolf: it outpaces his walk, so walking never passes it, and it lasts well past the cast [k3 measure docs/design/thrall.md]", () => {
  for (const facing of [1, -1]) {
    const d = thrallDuel(FAR, facing);
    cast(d, held(0, -1), PRESS_TICK, facing);
    let alive = 0;
    let passed = false;
    for (let tick = 0; tick < 200; tick++) {
      step(d, "none", d.caster.special.action === SpecialAction.none ? { x: f32(f32(0.6) * facing), z: 0 } : NEUTRAL);
      const wolf = wolves(d.caster)[0];
      if (wolf === undefined) continue;
      alive++;
      if (f32(f32(d.caster.motion.x - wolf.x) * facing) > 0.0) passed = true;
    }
    assertTrue(!passed);
    assertGreaterThan(SPIRIT_SPEED, d.caster.tuning.physics.walkSpeed);
    assertGreaterThan(alive, 120);
  }
});

interface Hop { readonly hits: number }

const HOP_END_TICK = 85;

function hopOver(full: boolean, jumpAt: number): Hop {
  const d = thrallDuel(260.0, 1);
  let hits = 0;
  let damage = 0.0;
  for (let tick = 1; tick <= HOP_END_TICK; tick++) {
    const jump: Press = tick === jumpAt ? "down" : full && tick > jumpAt && tick < jumpAt + 6 ? "hold" : "none";
    step(d, pressAt(tick), held(DIAGONAL, -DIAGONAL)(tick - PRESS_TICK, 1), undefined, jump);
    if (d.foe.status.damage > damage) hits++;
    damage = d.foe.status.damage;
  }
  return { hits };
}

test("Only a full hop clears both timber wolves: a short hop timed over the first is bitten by the second, and a full hop clears the pair [k3 measure docs/design/thrall.md]", () => {
  let shortClearsFirst = false;
  let fullClearsBoth = false;
  for (let jumpAt = PRESS_TICK + 13; jumpAt < PRESS_TICK + 53; jumpAt++) {
    const short = hopOver(false, jumpAt);
    assertGreaterThan(short.hits, 0);
    if (short.hits === 1) shortClearsFirst = true;
    if (hopOver(true, jumpAt).hits === 0) fullClearsBoth = true;
  }
  assertTrue(shortClearsFirst);
  assertTrue(fullClearsBoth);
});

test("The spirit wolf stops at a raised shield and bites it three times, holding the foe in shield stun while Thrall walks in [k3 measure docs/design/thrall.md]", () => {
  const d = thrallDuel(300.0, 1);
  d.foe.shield.raised = true;
  let bites = 0;
  for (let tick = 1; tick <= 160; tick++) {
    d.foe.shield.raised = true;
    step(d, pressAt(tick), held(0, -1)(tick - PRESS_TICK, 1));
    bites = Math.max(bites, wolves(d.caster)[0]?.poolHits ?? 0);
  }
  assertEquals(bites, DESIGNED_BITES);
  assertEquals(d.foe.status.damage, 0.0);
});

test("A rollback replays every wolf form from before the cast, mid-run and mid-fall to the same state [k1 scenario]", () => {
  for (const [, script] of FORMS) {
    for (const saveTick of [PRESS_TICK - 2, PRESS_TICK + 20, PRESS_TICK + 45]) {
      const run = thrallDuel(500.0, 1, f32(mainDeckRight(0) - 300.0));
      const snapshot = createReplaySnapshot();
      const end = PRESS_TICK + 90;
      for (let tick = 1; tick <= end; tick++) {
        if (tick === saveTick) copyReplayState(snapshot, run.state);
        step(run, pressAt(tick), script(tick - PRESS_TICK, 1));
      }
      const expected = canonicalState(run.state);
      copyReplayState(run.state, snapshot);
      run.tick = saveTick - 1;
      for (let tick = saveTick; tick <= end; tick++) step(run, pressAt(tick), script(tick - PRESS_TICK, 1));
      assertEquals(canonicalState(run.state), expected, `saved at tick ${saveTick}`);
    }
  }
  assertTrue(floorBelow(0, 0, 0.0, f32(mainDeckZ(0) + 1.0)) !== undefined);
});
