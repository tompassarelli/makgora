import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { upSpecialRoute } from "../../match/recoveryEnvelope";
import { Character, SpecialAction } from "../codes";
import { type Fighter, createFighter, placedObject } from "../fighter";
import { type Controls, type Roster } from "../roster";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { duelPair, stepDuel } from "../testDuel";
import { advanceBearFeedback, createBearFeedbackCursor } from "../../presentation/bearFeedback";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../presentation/impactEvents";
import { playPerform } from "../../presentation/moveSounds";

const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });


function pair(gap = 1000.0, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(Character.beastmaster, f32(-gap * 0.5 * facing), facing);
  owner.mana.points = 100;
  const target = createFighter(Character.rifleman, f32(gap * 0.5 * facing), -facing);
  const { world } = duelPair(owner, target);
  owner.mana.points = 100;
  return { world, owner, target };
}
function run(world: Roster, frames: number, press?: Readonly<Controls>): void {
  for (let f = 1; f <= frames; f++) stepDuel(world, f === 1 && press !== undefined ? press : controls());
}
function withBear(gap = 1000.0, facing = 1) {
  const scene = pair(gap, facing);
  run(scene.world, 74, controls({ specialPressed: true, specialX: facing }));
  return scene;
}
function withPack() {
  const scene = withBear();
  run(scene.world, 40, down);
  run(scene.world, 30, up);
  return scene;
}

test("Beastmaster Hawk Lift rises 380–520 and reaches 600–900, its free route at least 240 on each axis; Hawk survives the helpless fall [k3 measure #335]", () => {
  for (const mana of [100, 10]) {
    const route = upSpecialRoute(Character.beastmaster, mana);
    assertTrue(route.rise >= 380.0 && route.rise <= 520.0);
    assertTrue(route.reach >= 600.0 && route.reach <= 900.0);
    const { world, owner } = pair();
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 100.0;
    owner.motion.vz = 0.0;
    owner.mana.points = mana;
    stepDuel(world, up);
    assertEquals(owner.mana.points, mana);
    for (let f = 2; f <= 33; f++) stepDuel(world);
    assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
    assertGreaterThan(placedObject(owner, 2).life, 0);
    stepDuel(world, up);
    assertEquals(owner.special.action, SpecialAction.none);
  }
});

test("rollback restores Beastmaster's three separate companion positions and commands [k1 scenario]", () => {
  const { world, owner, target } = withPack();
  stepDuel(world, down);
  run(world, 8);
  const savedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  run(world, 55);
  const expectedOwner = createFighter(Character.beastmaster, 0.0, 1);
  const expectedTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(expectedOwner, owner, 3);
  copyFighterState(expectedTarget, target, 3);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run(world, 55);
  assertEquals(firstFighterDifference(expectedOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(expectedTarget, target, 3, 3), undefined);
});


test("commanded Bear and Hawk each damage and launch the dummy with one confirmed impact, while Hawk's ready cry stays silent [k1 scenario]", () => {
  for (const animal of [0, 2]) for (const facing of [-1, 1]) {
    const { world, owner, target } = pair(animal === 0 ? 100.0 : 200.0, facing);
    const press = animal === 0 ? controls({ specialPressed: true, specialX: facing }) : up;
    const cursor = createBearFeedbackCursor();
    const events = createImpactEvents();
    let impacts = 0;
    let birdCues = 0;
    let birdVolume = 0;
    let biteDamage = 0.0;
    let launch = 0.0;
    for (let frame = 1; frame <= 145; frame++) {
      captureImpactEventsBefore(events, owner);
      const damage = target.status.damage;
      stepDuel(world, frame === 1 || frame === 76 ? press : controls());
      finishImpactEventsAfter(events, owner, world);
      if (events.perform >= 0) playPerform(owner.character, events.perform, events.performSerial, (file, volume) => {
        if (file.includes("HawkReady")) { birdCues++; birdVolume = Math.max(birdVolume, volume); }
      });
      const cues = advanceBearFeedback(cursor, owner, frame, animal);
      if (cues.hit) {
        impacts++;
        biteDamage = f32(target.status.damage - damage);
        launch = f32(Math.abs(target.launch.knockbackX) + Math.abs(target.launch.knockbackZ));
        const placed = placedObject(owner, animal);
        assertTrue(Math.abs(f32(cursor.impactX - target.motion.x)) < 100.0);
        assertTrue(Math.abs(f32(cursor.impactZ - target.motion.z)) < 120.0);
        assertEquals(advanceBearFeedback(cursor, owner, frame, animal).hit, false);
        assertEquals(placed.bitten & 2, 2);
      }
    }
    assertEquals(impacts, 1, `animal ${animal} facing ${facing} confirmed bite`);
    assertGreaterThan(biteDamage, 0.0);
    assertGreaterThan(launch, 0.0);
    assertEquals(birdCues, 0);
    assertEquals(birdVolume, 0);
  }
});
