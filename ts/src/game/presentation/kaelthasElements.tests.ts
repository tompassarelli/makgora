import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { beginAttack } from "../sim/transitions";
import { createFighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { becomeEgg } from "../sim/specials/engine";
import { duelPair, lift, stepDuel } from "../sim/testDuel";
import { controls } from "../sim/testWorld";
import { PHOENIX_STARTUP_FRAMES } from "../fighters/kaelthas/specials";
import { createImpactEvents } from "./impactEvents";
import { IMPACT_ARCANE_HIT, IMPACT_FIRE_HIT, IMPACT_HIT, createImpactState, emitImpacts } from "./impactState";
import { impactColour } from "./hitPresentation";
import { type SpherePose, emptySpherePose, fighterOrbit, spherePose, thrownSphere } from "./sphereOrbit";
import { eggShown, emptyFlightPose, fighterFlight, flightFlamesPose } from "./flightLook";
import { fillMeter } from "../sim/meter";

function sparkKind(element: HitElement): number {
  const state = createImpactState();
  emitImpacts(state, { ...createImpactEvents(), hit: true, element }, 0, 0);
  return state.occupied.findIndex((slots) => slots !== 0);
}

function kael(z = 0.0) {
  const pair = duelPair(createFighter(Character.kaelthas, 0.0, 1), createFighter(Character.rifleman, -600.0, 1));
  fillMeter(pair.owner);
  if (z > 0.0) lift(pair.owner, z);
  return pair;
}

const poses = (): SpherePose[] => [emptySpherePose(), emptySpherePose(), emptySpherePose()];

test("Hit sparks follow the element: an arcane normal draws its own violet spark and a fire special an orange one, apart from the plain spark [k3 measure #360]", () => {
  assertEquals(sparkKind(HitElement.arcane), IMPACT_ARCANE_HIT);
  assertEquals(sparkKind(HitElement.fire), IMPACT_FIRE_HIT);
  assertEquals(sparkKind(HitElement.normal), IMPACT_HIT);
  const arcane = impactColour(IMPACT_ARCANE_HIT, 1.0), fire = impactColour(IMPACT_FIRE_HIT, 1.0), plain = impactColour(IMPACT_HIT, 1.0);
  assertTrue(arcane !== undefined && fire !== undefined && plain !== undefined);
  assertGreaterThan(arcane?.[2] ?? 0, arcane?.[1] ?? 0);
  assertGreaterThan(fire?.[0] ?? 0, fire?.[2] ?? 0);
  assertFalse(arcane?.join() === plain?.join());
});

test("Kael'thas's three spheres orbit him a third of a turn apart, and the first flies out to the hit area while a normal is active and returns after [k3 measure #360]", () => {
  const { world, owner } = kael();
  const orbit = fighterOrbit(Character.kaelthas);
  assertTrue(orbit !== undefined);
  if (orbit === undefined) return;
  assertEquals(orbit.count, 3);
  const idle = poses().map((pose, index) => spherePose(owner, orbit, index, 0, pose));
  for (const pose of idle) assertTrue(pose.visible);
  const sides: number[] = [];
  for (let index = 0; index < 3; index++) {
    const a = idle[index], b = idle[index === 2 ? 0 : index + 1];
    if (a === undefined || b === undefined) return;
    sides.push(Math.sqrt(f32(a.x - b.x) * f32(a.x - b.x) + f32(a.depth - b.depth) * f32(a.depth - b.depth)));
  }
  for (const side of sides) assertLessThan(Math.abs(side - (sides[0] ?? 0)), 1.0);
  assertGreaterThan(sides[0] ?? 0, orbit.radius);
  beginAttack(owner, AttackStyle.forwardTilt, false);
  let thrown = false;
  for (let frame = 0; frame < 30 && !thrown; frame++) {
    const area = thrownSphere(owner);
    if (area !== undefined) {
      const [first, second] = poses();
      if (first === undefined || second === undefined) return;
      spherePose(owner, orbit, 0, frame, first);
      spherePose(owner, orbit, 1, frame, second);
      assertEquals(first.x, area.x);
      assertEquals(first.z, area.z);
      assertGreaterThan(f32(first.x - owner.motion.x) * owner.facing, 0.0);
      assertFalse(second.x === area.x && second.z === area.z);
      thrown = true;
    } else stepDuel(world, controls());
  }
  assertTrue(thrown);
  while (owner.attack.style !== undefined) stepDuel(world, controls());
  assertEquals(thrownSphere(owner), undefined);
});

test("Phoenix: the flames on the bird shrink every frame as the flight burns down, the spheres hide inside the bird, and struck he shows only the egg [k3 measure #360]", () => {
  const { world, owner } = kael(300.0);
  const flight = fighterFlight(Character.kaelthas);
  const orbit = fighterOrbit(Character.kaelthas);
  assertTrue(flight !== undefined && orbit !== undefined);
  if (flight === undefined || orbit === undefined) return;
  stepDuel(world, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }));
  while (owner.special.frame <= PHOENIX_STARTUP_FRAMES) stepDuel(world, controls());
  const pose = emptyFlightPose();
  let last = flightFlamesPose(owner, flight, pose).scale;
  let shrank = 0;
  while (owner.special.action === SpecialAction.heroUp) {
    assertTrue(flightFlamesPose(owner, flight, pose).visible);
    assertFalse(spherePose(owner, orbit, 0, 0, emptySpherePose()).visible);
    assertTrue(pose.scale <= last);
    if (pose.scale < last) shrank++;
    last = pose.scale;
    stepDuel(world, controls());
  }
  assertGreaterThan(shrank, 20);
  assertFalse(flightFlamesPose(owner, flight, pose).visible);
  const struck = kael(300.0);
  stepDuel(struck.world, controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 }));
  while (struck.owner.special.frame <= PHOENIX_STARTUP_FRAMES + 4) stepDuel(struck.world, controls());
  becomeEgg(struck.owner);
  assertTrue(eggShown(struck.owner));
  assertFalse(flightFlamesPose(struck.owner, flight, pose).visible);
  assertFalse(spherePose(struck.owner, orbit, 0, 0, emptySpherePose()).visible);
});
