import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../../sim/codes";
import { type Fighter, type Projectile, createFighter } from "../../sim/fighter";
import type { Roster } from "../../sim/roster";
import type { SpecialProjectile } from "../../sim/specials/schema";
import { CARRIED_TEST_STAGE, mainDeckRight, mainDeckZ, surfaceZ } from "../../sim/stage";
import { duelPair, lift, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { FLAME_STRIKE_AIM, FLAME_STRIKE_BURN, FLAME_STRIKE_BURST, FLAME_STRIKE_RUNE } from "./specials";

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

test("The burst launches a foe up at its 80° and crushes a shield, where a burn tick neither launches nor dents the shield [k1 scenario]", () => {
  const hit = (into: Readonly<SpecialProjectile>, shield: boolean): { knockbackX: number; knockbackZ: number; shieldLoss: number } => {
    const { kael, target, world } = kaelDuel();
    const guard = controls({ shield });
    stepDuel(world, press, guard);
    let spot: Readonly<Projectile> | undefined;
    for (let frame = 0; frame < 120 && spot === undefined; frame++) {
      stepDuel(world, idle, guard);
      spot = live(kael, into === FLAME_STRIKE_BURST ? FLAME_STRIKE_RUNE : FLAME_STRIKE_BURN);
    }
    target.motion.x = present(spot, "cast").x;
    let knockbackX = 0.0;
    let knockbackZ = 0.0;
    let shieldLoss = 0.0;
    for (let frame = 0; frame < 60; frame++) {
      const energy = target.shield.energy;
      stepDuel(world, idle, guard);
      shieldLoss = Math.max(shieldLoss, f32(energy - target.shield.energy));
      if (knockbackZ === 0.0) {
        knockbackX = target.launch.knockbackX;
        knockbackZ = target.launch.knockbackZ;
      }
    }
    return { knockbackX, knockbackZ, shieldLoss };
  };
  const burst = hit(FLAME_STRIKE_BURST, false);
  assertTrue(burst.knockbackX > 0.0);
  assertTrue(burst.knockbackZ > f32(burst.knockbackX * 5.0) && burst.knockbackZ < f32(burst.knockbackX * 6.5));
  const burn = hit(FLAME_STRIKE_BURN, false);
  assertEquals(burn.knockbackX, 0.0, "a burn tick does not launch");
  assertEquals(burn.knockbackZ, 0.0, "a burn tick does not launch");
  const crushed = hit(FLAME_STRIKE_BURST, true).shieldLoss;
  const dented = hit(FLAME_STRIKE_BURN, true).shieldLoss;
  assertTrue(dented > 0.0);
  assertTrue(crushed > f32(dented * 5.0));
});

test("A rune held off a moving deck stays where it lands while the deck carries Kael on, and a rune left on the deck rides with it [k1 scenario]", () => {
  const deckZ = surfaceZ(CARRIED_TEST_STAGE, 1, 0);
  const cast = (heldFrames: number): { runeZ: number; drift: number } => {
    const kael = createFighter(Character.kaelthas, -210.0, 1);
    lift(kael, f32(deckZ + 20.0));
    const { world } = duelPair(kael, createFighter(Character.rifleman, -500.0, -1), 3, CARRIED_TEST_STAGE);
    for (let frame = 0; frame < 60; frame++) stepDuel(world);
    assertEquals(kael.motion.surface, 1, "Kael stands on the moving deck");
    stepDuel(world, press);
    for (let frame = 0; frame < FLAME_STRIKE_AIM.frame + heldFrames; frame++) stepDuel(world, hold);
    const rune = present(live(kael, FLAME_STRIKE_RUNE), "rune");
    const x = rune.x;
    const z = rune.z;
    const deckX = kael.motion.x;
    const burst = stepUntil(world, kael, FLAME_STRIKE_BURST);
    assertTrue(f32(kael.motion.x - deckX) > 30.0);
    return { runeZ: z, drift: f32(burst.x - x) };
  };
  const off = cast(12);
  assertEquals(off.runeZ, mainDeckZ(CARRIED_TEST_STAGE), "the held rune slid off onto the main deck");
  assertEquals(off.drift, 0.0, "off the deck, the rune stays put");
  const on = cast(0);
  assertEquals(on.runeZ, deckZ, "a tapped rune lands on the deck");
  assertTrue(on.drift > 30.0);
});
