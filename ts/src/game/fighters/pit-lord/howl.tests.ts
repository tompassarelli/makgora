import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusGroup, HeroStatusKind } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { emptyCapsule } from "../../sim/geometry/contactGeometry";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { heldFrames } from "../../sim/heroStatus";
import { shieldContactDamage } from "../../sim/shield";
import { placeHeroStrike, runningHeroSpecial } from "../../sim/specials/engine";
import { duelPair, lift, stepDuel } from "../../sim/testDuel";
import { controls } from "../../sim/testWorld";
import { type ShockwaveRing, shockwaveRing } from "../../presentation/shockwaveRing";
import { HOWL_FIRST, HOWL_REACH, PIT_LORD_SPECIALS, TERRIFIED } from "./specials";

const H = HERO_REFERENCE_HEIGHT;
const NEUTRAL_B = controls({ specialPressed: true });
const HOWL_DAMAGE = PIT_LORD_SPECIALS.neutral.ground.regions?.[0]?.hit.effect.damage ?? 0.0;

interface Roar {
  readonly pitLord: Fighter;
  readonly target: Fighter;
  readonly world: ReturnType<typeof duelPair>["world"];
}

function roar(gap: number, percent: number, setUp: (target: Fighter) => void = () => {}, hold = controls()): Roar {
  const pitLord = createFighter(Character.pitLord, 0.0, 1);
  pitLord.mana.points = 100;
  const target = createFighter(Character.rifleman, gap, gap > 0.0 ? -1 : 1);
  const { world } = duelPair(pitLord, target);
  target.status.damage = percent;
  setUp(target);
  stepDuel(world, NEUTRAL_B, hold);
  for (let frame = 1; frame < HOWL_FIRST + 6; frame++) stepDuel(world, controls(), hold);
  return { pitLord, target, world };
}

test("Terrified holds 30 frames plus 0.4 a percent of post-hit damage, capped at 90 [k3 measure docs/design/pit-lord.md]", () => {
  assertEquals(heldFrames(TERRIFIED, 0.0), 30);
  assertEquals(heldFrames(TERRIFIED, 50.0), 50);
  assertEquals(heldFrames(TERRIFIED, 100.0), 70);
  assertEquals(heldFrames(TERRIFIED, 150.0), 90);
  assertEquals(heldFrames(TERRIFIED, 300.0), 90);
});

test("Howl of Terror terrifies a grounded foe on either side in place for the percent-scaled time, for 4 damage and no launch [k3 measure docs/design/pit-lord.md]", () => {
  for (const side of [1.0, -1.0]) {
    for (const percent of [0.0, 60.0]) {
      const { target } = roar(f32(side * f32(H * f32(1.2))), percent);
      const startX = f32(side * f32(H * f32(1.2)));
      assertEquals(target.status.condition, HeroStatusKind.fear);
      assertTrue(target.motion.grounded);
      assertTrue(Math.abs(f32(target.motion.x - startX)) < 1.0);
      assertEquals(target.status.damage, f32(percent + HOWL_DAMAGE));
      assertTrue(Math.abs(target.status.conditionFrames - heldFrames(TERRIFIED, target.status.damage)) <= 6);
    }
  }
});

test("A foe just terrified resists the next roar for 300 frames, then can be terrified again [k3 measure docs/design/pit-lord.md]", () => {
  const { pitLord, target, world } = roar(f32(H * f32(1.0)), 0.0);
  assertEquals(target.status.condition, HeroStatusKind.fear);
  for (let frame = 0; frame < 60; frame++) stepDuel(world);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertTrue((target.status.conditionImmunity[HeroStatusGroup.sleep] ?? 0) > 200);
  pitLord.mana.points = 100;
  stepDuel(world, NEUTRAL_B);
  for (let frame = 1; frame < HOWL_FIRST + 6; frame++) stepDuel(world);
  assertTrue(target.status.damage > HOWL_DAMAGE);
  assertEquals(target.status.condition, HeroStatusKind.none);
  for (let frame = 0; frame < 300; frame++) stepDuel(world);
  assertEquals(target.status.conditionImmunity[HeroStatusGroup.sleep] ?? 0, 0);
  pitLord.mana.points = 100;
  stepDuel(world, NEUTRAL_B);
  for (let frame = 1; frame < HOWL_FIRST + 6; frame++) stepDuel(world);
  assertEquals(target.status.condition, HeroStatusKind.fear);
});

test("A shield blocks the terror but takes the roar's heavy shield damage and is pushed away [k3 measure docs/design/pit-lord.md]", () => {
  const shield = controls({ shield: true });
  const { target } = roar(f32(H * f32(1.0)), 0.0, () => {}, shield);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertEquals(target.status.damage, 0.0);
  const fresh = createFighter(Character.rifleman, 0.0, 1);
  const lost = f32(fresh.shield.energy - target.shield.energy);
  assertTrue(lost >= f32(shieldContactDamage(21.64859962463379, 1.0) * f32(0.9)));
  assertTrue(target.motion.x > f32(H * f32(1.0)));
});

test("An airborne foe is pushed away from Pit Lord on either side at 45 degrees and is never terrified [k3 measure docs/design/pit-lord.md]", () => {
  for (const side of [1.0, -1.0]) {
    const { target } = roar(f32(side * f32(H * f32(1.0))), 0.0, (foe) => { lift(foe, f32(H * f32(0.6))); });
    assertEquals(target.status.condition, HeroStatusKind.none);
    assertEquals(target.status.damage, HOWL_DAMAGE);
    assertTrue(f32(target.motion.vx * side) > 0.0 || f32(target.launch.knockbackX * side) > 0.0);
  }
});

test("The drawn shockwave ring is the live hit region on every active frame and reaches 1.6H [k3 measure docs/design/pit-lord.md]", () => {
  for (const facing of [1, -1]) {
    const pitLord = createFighter(Character.pitLord, 0.0, facing);
    pitLord.mana.points = 100;
    const { world } = duelPair(pitLord, createFighter(Character.rifleman, f32(H * f32(8.0)), -1));
    const ring: ShockwaveRing = { x: 0.0, z: 0.0, radius: 0.0, alpha: 0 };
    const placed = emptyCapsule();
    let widest = 0.0;
    let drawn = 0;
    stepDuel(world, NEUTRAL_B);
    for (let frame = 1; frame < 34; frame++) {
      const move = runningHeroSpecial(pitLord);
      const active = move?.regions?.find((region) => pitLord.special.frame - 1 >= region.firstFrame && pitLord.special.frame - 1 <= region.lastFrame);
      const pose = shockwaveRing(ring, pitLord);
      if (active?.hit.strike !== undefined) {
        placeHeroStrike(placed, pitLord, active.hit.strike, pitLord.motion.x, pitLord.motion.z);
        assertTrue(pose !== undefined);
        assertEquals(ring.x, placed.x1);
        assertEquals(ring.z, placed.z1);
        assertEquals(ring.radius, placed.radius);
        assertEquals(ring.alpha, 255);
        widest = Math.max(widest, ring.radius);
        drawn++;
      } else if (pose !== undefined) assertTrue(ring.alpha < 255);
      stepDuel(world);
    }
    assertEquals(drawn, 5);
    assertEquals(widest, HOWL_REACH);
    assertEquals(HOWL_REACH, f32(H * f32(1.6)));
  }
});
