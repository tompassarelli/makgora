import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { type Fighter, type Projectile, createFighter } from "../fighter";
import type { Roster } from "../roster";
import type { SpecialProjectile } from "../specials/schema";
import { mainDeckRight, mainDeckZ } from "../stage";
import { duelPair, lift, stepDuel } from "../testDuel";
import { controls } from "../testWorld";
import { FLAME_STRIKE_AIM, FLAME_STRIKE_BURN, FLAME_STRIKE_BURST, FLAME_STRIKE_RUNE } from "./kaelthasSpecials";

const press = controls({ specialPressed: true, specialX: 1, specialHeld: true });
const hold = controls({ specialHeld: true });
const idle = controls();
const BEHIND = -300.0;

function live(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile>): Readonly<Projectile> | undefined {
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.spec === spec) return projectile;
  return undefined;
}

function liveCasts(f: Readonly<Fighter>): number {
  let count = 0;
  for (const spec of [FLAME_STRIKE_RUNE, FLAME_STRIKE_BURST, FLAME_STRIKE_BURN]) if (live(f, spec) !== undefined) count++;
  return count;
}

function present(projectile: Readonly<Projectile> | undefined, what: string): Readonly<Projectile> {
  if (projectile === undefined) throw new Error(`no ${what}`);
  return projectile;
}

function kaelDuel(targetX = BEHIND): { kael: Fighter; target: Fighter; world: Roster } {
  const kael = createFighter(Character.kaelthas, 0.0, 1);
  const target = createFighter(Character.rifleman, targetX, -1);
  const { world } = duelPair(kael, target);
  return { kael, target, world };
}

function stepUntil(world: Roster, kael: Readonly<Fighter>, spec: Readonly<SpecialProjectile>, input = idle): Readonly<Projectile> {
  for (let frame = 0; frame < 120 && live(kael, spec) === undefined; frame++) stepDuel(world, input);
  return present(live(kael, spec), "projectile");
}

function pillarX(heldFrames: number): number {
  const { kael, world } = kaelDuel();
  const startX = kael.motion.x;
  stepDuel(world, press);
  for (let frame = 0; frame < 160; frame++) {
    const burst = live(kael, FLAME_STRIKE_BURST);
    if (burst !== undefined) return f32(burst.x - startX);
    stepDuel(world, frame < heldFrames ? hold : idle);
  }
  throw new Error("no pillar");
}

test("A tapped Flame Strike bursts at the default distance and a held one where the rune slid to, never past its reach [k1 scenario]", () => {
  const tap = pillarX(0);
  assertEquals(tap, FLAME_STRIKE_RUNE.offsetX, "a tap lands at the default distance");
  const short = pillarX(FLAME_STRIKE_AIM.frame + 5);
  const long = pillarX(FLAME_STRIKE_AIM.frame + 15);
  assertTrue(short > tap);
  assertEquals(f32(long - short), f32(10.0 * FLAME_STRIKE_AIM.speed), "each held frame slides the rune one step");
  const full = pillarX(160);
  assertTrue(full <= FLAME_STRIKE_AIM.reach && full > f32(FLAME_STRIKE_AIM.reach - FLAME_STRIKE_AIM.speed));
});

test("The rune shows for the whole delay before the burst, and a recast removes the live pillar [k1 scenario]", () => {
  const { kael, world } = kaelDuel();
  stepDuel(world, press);
  stepUntil(world, kael, FLAME_STRIKE_RUNE);
  let runeFrames = 0;
  while (live(kael, FLAME_STRIKE_BURST) === undefined && runeFrames < 120) {
    if (live(kael, FLAME_STRIKE_RUNE) !== undefined) runeFrames++;
    stepDuel(world, idle);
  }
  assertEquals(runeFrames + 1, FLAME_STRIKE_RUNE.life, "the rune shows until the burst");
  const first = stepUntil(world, kael, FLAME_STRIKE_BURN);
  stepDuel(world, idle);
  assertTrue(first.life > 2);
  stepDuel(world, press);
  stepDuel(world, idle);
  assertEquals(live(kael, FLAME_STRIKE_BURN), undefined, "the recast put out the first pillar");
  for (let frame = 0; frame < 120; frame++) {
    assertTrue(liveCasts(kael) <= 1);
    stepDuel(world, idle);
  }
});

test("The lingering burn deals damage without hitstun, hitlag or launch [k1 scenario]", () => {
  const { kael, target, world } = kaelDuel();
  stepDuel(world, press);
  const burn = stepUntil(world, kael, FLAME_STRIKE_BURN);
  target.motion.x = burn.x;
  const before = target.status.damage;
  let ticks = 0;
  for (let frame = 0; frame < FLAME_STRIKE_BURN.life; frame++) {
    const damage = target.status.damage;
    stepDuel(world, idle);
    if (target.status.damage > damage) ticks++;
    assertEquals(target.launch.hitstun, 0, "no hitstun");
    assertEquals(target.launch.hitlag, 0, "no hitlag");
    assertTrue(target.motion.grounded);
  }
  assertTrue(ticks >= 2);
  assertTrue(target.status.damage > before);
});

test("Cast in the air off the stage, the pillar stands at Kael's height over the void [k1 scenario]", () => {
  const { kael, world } = kaelDuel();
  const edge = mainDeckRight(0);
  kael.motion.x = f32(edge + 40.0);
  lift(kael, f32(mainDeckZ(0) + 120.0));
  stepDuel(world, press);
  const rune = stepUntil(world, kael, FLAME_STRIKE_RUNE);
  const runeZ = rune.z;
  const burst = stepUntil(world, kael, FLAME_STRIKE_BURST);
  assertTrue(burst.x > edge);
  assertTrue(runeZ > mainDeckZ(0));
  assertEquals(burst.z, f32(runeZ + FLAME_STRIKE_BURST.offsetZ), "the pillar rises from the rune");
});
