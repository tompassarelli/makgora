import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { ProjectileKind, SpecialAction } from "../../sim/codes";
import { isIntangible } from "../../sim/conditions";
import type { Fighter, Projectile } from "../../sim/fighter";
import { mutableProjectile } from "../../sim/fighterProjectiles";
import { setWorldMotionValue } from "../../sim/motion";
import { mainDeckRight, mainDeckZAt, surfaceCount, surfaceLeft, surfaceRight, surfaceZAt } from "../../sim/stage";
import { SpecialSlot } from "../../sim/specials/schema";
import {
  CRATER, CRATER_FRAMES, RAZE_END_FRAME, RAZE_RADIUS, RAZE_REACH, SUBMERGE_COOLDOWN, SUBMERGE_END_FRAME, SUBMERGE_FALLBACK_REACH,
  SUBMERGE_INTANGIBLE, SUBMERGE_SURFACE_FRAME,
} from "./specials";
import { type Duel, type Stick, duel, idle, lift, step } from "./testDuel";

const FAR_AWAY = 2000.0;
const DOWN: Stick = { x: 0, z: -1 };
const DIAGONAL = f32(0.7);
const SIDE_SLOT = SpecialAction.heroNeutral + SpecialSlot.side;

const closeTo = (actual: number | undefined, expected: number, label = ""): void => {
  assertEquals(actual !== undefined && Math.abs(f32(actual - expected)) < f32(0.01), true, `${label} ${actual} is not ${expected}`);
};

const craters = (f: Readonly<Fighter>): Projectile[] => f.projectiles.filter((projectile) => projectile.life > 0 && projectile.kind === ProjectileKind.hero && projectile.spec === CRATER);

function stand(d: Duel, x: number, z = d.caster.motion.z, surface = d.caster.motion.surface): void {
  const { motion } = d.caster;
  motion.x = x;
  motion.z = z;
  motion.surface = surface;
  motion.vx = 0.0;
  setWorldMotionValue(motion.meleeX, x);
  setWorldMotionValue(motion.meleeZ, z);
}

function raze(d: Duel, stick: Stick = DOWN, special: Stick = DOWN): void {
  step(d, "down", stick, special);
  idle(d, RAZE_END_FRAME + 1);
}

function untilCraters(d: Duel, count: number): void {
  for (let guard = 0; guard < 120 && craters(d.caster).length < count; guard++) step(d, "none");
  assertEquals(craters(d.caster).length >= count, true, `${count} crater(s) formed`);
}

function submerge(d: Duel): void {
  step(d, "down", { x: d.caster.facing, z: 0 });
}

function sunk(d: Duel): void {
  idle(d, SUBMERGE_END_FRAME + 2);
}

test("A Lava Raze leaves a crater on the ground where the eruption was, and it lasts 180 frames [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR_AWAY);
  raze(d);
  assertEquals(craters(d.caster).length, 0, "no crater while the eruption is still glowing");
  untilCraters(d, 1);
  const [crater] = craters(d.caster);
  closeTo(f32(f32(crater?.x ?? 0.0) - d.caster.motion.x), RAZE_REACH.near, "one step ahead");
  assertEquals(CRATER_FRAMES, 180);
  let frames = 0;
  while (craters(d.caster).length > 0 && frames < 400) {
    step(d, "none");
    frames++;
  }
  assertEquals(frames, CRATER_FRAMES, "frames the crater stays");
});

test("Submerge resurfaces at the newest crater, whichever side it is on [k3 measure docs/design/roster.md]", () => {
  for (const [first, second] of [[300.0, -300.0], [-300.0, 300.0]] as const) {
    const d = duel(FAR_AWAY);
    stand(d, first);
    raze(d);
    stand(d, second);
    raze(d);
    untilCraters(d, 2);
    const [older, newer] = craters(d.caster).sort((a, b) => a.life - b.life).reverse();
    assertEquals((older?.life ?? 0) > (newer?.life ?? 0), true, "the two craters have different ages");
    stand(d, 0.0);
    submerge(d);
    sunk(d);
    closeTo(d.caster.motion.x, older?.x ?? NaN, `newest crater, first cast at ${first}`);
    assertEquals(d.caster.motion.grounded, true);
  }
});

test("Submerge keeps the crater's floor and holds him still until he surfaces [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR_AWAY);
  raze(d);
  untilCraters(d, 1);
  const crater = craters(d.caster)[0]?.x ?? NaN;
  stand(d, -300.0);
  submerge(d);
  for (let frame = 1; frame < SUBMERGE_SURFACE_FRAME; frame++) {
    closeTo(d.caster.motion.x, -300.0, `still sinking at ${frame}`);
    step(d, "none");
  }
  idle(d, 3);
  closeTo(d.caster.motion.x, crater, "surfaced");
  closeTo(d.caster.motion.z, mainDeckZAt(0, crater), "on the floor");
  assertEquals(d.caster.motion.grounded, true);
  assertEquals(d.caster.facing, 1, "facing kept");
});

test("With no live crater Submerge surfaces a fixed step ahead, facing either way, and stays put at a ledge [k3 measure docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const d = duel(FAR_AWAY, facing);
    submerge(d);
    sunk(d);
    closeTo(d.caster.motion.x, f32(facing * SUBMERGE_FALLBACK_REACH), `fallback facing ${facing}`);
  }
  const edge = duel(FAR_AWAY, 1, f32(mainDeckRight(0) - 10.0));
  submerge(edge);
  sunk(edge);
  closeTo(edge.caster.motion.x, f32(mainDeckRight(0) - 10.0), "no floor ahead, so he stays");
  assertEquals(edge.caster.motion.grounded, true);
  const expired = duel(FAR_AWAY);
  raze(expired);
  untilCraters(expired, 1);
  idle(expired, CRATER_FRAMES + 1);
  assertEquals(craters(expired.caster).length, 0);
  submerge(expired);
  sunk(expired);
  closeTo(expired.caster.motion.x, SUBMERGE_FALLBACK_REACH, "an expired crater is no target");
});

const PLATFORM_INSET = 40.0;

interface Platform { readonly stage: number; readonly index: number; readonly left: number; readonly right: number; readonly z: number }

function platformAbove(): Platform {
  for (let stage = 0; stage < 12; stage++) {
    for (let index = 1; index < surfaceCount(stage); index++) {
      const left = surfaceLeft(stage, index, 0);
      const right = surfaceRight(stage, index, 0);
      const z = surfaceZAt(stage, index, 0, f32((left + right) / 2.0));
      const fixed = surfaceLeft(stage, index, 400) === left && surfaceRight(stage, index, 400) === right && surfaceZAt(stage, index, 400, f32((left + right) / 2.0)) === z;
      if (fixed && z > 40.0 && f32(right - left) > f32(f32(PLATFORM_INSET + RAZE_REACH.near) + RAZE_RADIUS)) return { stage, index, left, right, z };
    }
  }
  throw new Error("no fixed platform on any stage");
}

test("Submerge from the main deck surfaces on the platform where the crater was cast [k3 measure docs/design/roster.md]", () => {
  const platform = platformAbove();
  const d = duel(FAR_AWAY, 1, f32(platform.left + PLATFORM_INSET));
  d.state.match.stageChoice = platform.stage;
  stand(d, f32(platform.left + PLATFORM_INSET), platform.z, platform.index);
  d.caster.motion.grounded = true;
  raze(d);
  untilCraters(d, 1);
  const crater = craters(d.caster)[0]?.x ?? NaN;
  assertEquals(crater > platform.left && crater < platform.right, true, "the crater is on the platform");
  stand(d, crater, mainDeckZAt(platform.stage, crater), 0);
  d.caster.motion.grounded = true;
  submerge(d);
  sunk(d);
  closeTo(d.caster.motion.x, crater, "under the crater");
  closeTo(d.caster.motion.z, platform.z, "on the platform");
  assertEquals(d.caster.motion.surface, platform.index);
});

test("A raze leaves a crater only where it erupted on a floor: none from mid-air or past a ledge, so Submerge has no target there [k3 measure docs/design/roster.md]", () => {
  const air = duel(FAR_AWAY);
  lift(air.caster, 300.0, 0.0);
  step(air, "down", DOWN, DOWN);
  assertEquals(air.caster.special.action !== SpecialAction.none, true, "raze started in the air");
  idle(air, 70);
  assertEquals(craters(air.caster).length, 0, "no crater from a raze in mid-air");

  const edge = f32(mainDeckRight(0) - RAZE_REACH.mid + 10.0);
  const ledge = duel(FAR_AWAY, 1, edge);
  raze(ledge, { x: DIAGONAL, z: -DIAGONAL });
  idle(ledge, 20);
  assertEquals(craters(ledge.caster).length, 0, "no crater past the edge");
  const before = ledge.caster.motion.x;
  submerge(ledge);
  sunk(ledge);
  closeTo(ledge.caster.motion.x, f32(before + SUBMERGE_FALLBACK_REACH), "no crater, so the step ahead");

  const gone = duel(FAR_AWAY);
  stand(gone, 200.0);
  raze(gone);
  stand(gone, -200.0);
  raze(gone);
  untilCraters(gone, 2);
  const [older, newer] = craters(gone.caster).sort((a, b) => a.life - b.life).reverse();
  const olderX = older?.x ?? NaN;
  const newerIndex = gone.caster.projectiles.indexOf(newer as Projectile);
  mutableProjectile(gone.caster, newerIndex).x = f32(mainDeckRight(0) + 200.0);
  stand(gone, 0.0);
  submerge(gone);
  sunk(gone);
  closeTo(gone.caster.motion.x, olderX, "the newest crater with a floor under it");
  mutableProjectile(gone.caster, gone.caster.projectiles.indexOf(older as Projectile)).x = f32(mainDeckRight(0) + 200.0);
  stand(gone, 0.0);
  idle(gone, SUBMERGE_COOLDOWN);
  submerge(gone);
  sunk(gone);
  closeTo(gone.caster.motion.x, SUBMERGE_FALLBACK_REACH, "no crater has a floor, so the step ahead");
});

test("Submerge cannot start in the air [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR_AWAY);
  lift(d.caster, 300.0, 0.0);
  submerge(d);
  assertEquals(d.caster.special.action === SIDE_SLOT, false);
});

test("Underground he cannot be hit for twelve frames, less than a spot dodge, and is open before and after [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR_AWAY);
  submerge(d);
  const intangible: number[] = [];
  for (let frame = 0; frame < SUBMERGE_END_FRAME + 4; frame++) {
    if (isIntangible(d.caster)) intangible.push(d.caster.special.frame);
    step(d, "none");
  }
  assertEquals(intangible.length, 12, `intangible frames ${intangible.join(",")}`);
  assertEquals(intangible.length <= 14, true, "no longer than a spot dodge");
  assertEquals(intangible[0], SUBMERGE_INTANGIBLE.first - 1, "the window opens a frame early, as every special window does");
  assertEquals(intangible[intangible.length - 1], SUBMERGE_INTANGIBLE.last);
  assertEquals(SUBMERGE_SURFACE_FRAME >= SUBMERGE_INTANGIBLE.first && SUBMERGE_SURFACE_FRAME <= SUBMERGE_INTANGIBLE.last, true, "he moves while intangible");
});

test("Submerge cannot be chained: it ends on frame 34 and cannot start again for 120 frames, a tenth of them intangible [k3 measure docs/design/roster.md]", () => {
  const d = duel(FAR_AWAY);
  submerge(d);
  let ended = 0;
  while (d.caster.special.action === SIDE_SLOT && ended < 100) {
    step(d, "none");
    ended++;
  }
  assertEquals(ended + 1, SUBMERGE_END_FRAME, "frames until he acts again, the press frame included");
  const startsAfter = (gap: number): boolean => {
    const again = duel(FAR_AWAY);
    submerge(again);
    idle(again, gap - 1);
    submerge(again);
    return again.caster.special.action === SIDE_SLOT;
  };
  assertEquals(startsAfter(SUBMERGE_END_FRAME), false, "refused the frame he can act again");
  assertEquals(startsAfter(SUBMERGE_COOLDOWN - 1), false, "refused a frame early");
  assertEquals(startsAfter(SUBMERGE_COOLDOWN), true, "accepted when the cooldown is out");
  assertEquals(f32((SUBMERGE_INTANGIBLE.last - SUBMERGE_INTANGIBLE.first + 2) / SUBMERGE_COOLDOWN) <= f32(0.1), true, "at most a tenth of the time underground");
});

const ROLLBACK_PRESS = 3;
const SUBMERGE_PRESS = ROLLBACK_PRESS + 53;
const ROLLBACK_END = SUBMERGE_PRESS + 44;

function replayFrom(saveTick: number): { readonly expected: string; readonly replayed: string } {
  const run = duel(FAR_AWAY);
  const snapshot = createReplaySnapshot();
  const play = (from: number): void => {
    for (let tick = from; tick <= ROLLBACK_END; tick++) {
      if (tick === ROLLBACK_PRESS) step(run, "down", DOWN, DOWN);
      else if (tick === SUBMERGE_PRESS) submerge(run);
      else step(run, "none");
    }
  };
  for (let tick = 1; tick <= ROLLBACK_END; tick++) {
    if (tick === saveTick) copyReplayState(snapshot, run.state);
    if (tick === ROLLBACK_PRESS) step(run, "down", DOWN, DOWN);
    else if (tick === SUBMERGE_PRESS) submerge(run);
    else step(run, "none");
  }
  const expected = canonicalState(run.state);
  copyReplayState(run.state, snapshot);
  run.tick = saveTick - 1;
  play(saveTick);
  return { expected, replayed: canonicalState(run.state) };
}

test("A rollback replays a Lava Raze crater and a Submerge from before, during and after the dive to the same state [k1 scenario]", () => {
  const withCrater = duel(FAR_AWAY);
  const without = duel(FAR_AWAY);
  step(withCrater, "down", DOWN, DOWN);
  step(without, "none");
  idle(withCrater, 60);
  idle(without, 60);
  assertEquals(canonicalState(withCrater.state) === canonicalState(without.state), false, "a live crater is in the canonical state");
  for (const saveTick of [ROLLBACK_PRESS + 5, ROLLBACK_PRESS + 46, SUBMERGE_PRESS, SUBMERGE_PRESS + 4, SUBMERGE_PRESS + SUBMERGE_SURFACE_FRAME, SUBMERGE_PRESS + 20]) {
    const { expected, replayed } = replayFrom(saveTick);
    assertEquals(replayed, expected, `saved at tick ${saveTick}`);
  }
});

