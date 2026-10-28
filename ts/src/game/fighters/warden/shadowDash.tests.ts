import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Character } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { ordinaryHitstunFrames, TUMBLE_KNOCKBACK } from "../../sim/knockback";
import { ILLUSION_FIRST_TRAVEL_FRAME, ILLUSION_LAST_TRAVEL_FRAME, ILLUSION_TRAVEL_FRAMES } from "../../sim/specials/illusionDash";
import { SHADOW_DASH_DISTANCE } from "./specials";
import { duelPair, lift, stepDuel } from "../../sim/testDuel";
import { surfaceRight } from "../../sim/stage";
import { controls } from "../../sim/testWorld";

const H = HERO_REFERENCE_HEIGHT;
const FAR = f32(H * f32(8.0));
const STEP = f32(SHADOW_DASH_DISTANCE / f32(ILLUSION_TRAVEL_FRAMES));
const AIR_HEIGHT = 300.0;
const FULL_DASH = f32(H * f32(3.5));
const TAN_80 = f32(5.67128182);
const side = controls({ specialPressed: true, specialX: 1 });
const again = controls({ specialPressed: true });

interface Dash {
  readonly maiev: Fighter;
  readonly target: Fighter;
  readonly travel: number;
  readonly hitFrame: number;
  readonly launch: { readonly x: number; readonly z: number; readonly hitstun: number; readonly damageLevel: number };
}

function dash(gap: number, shortenOn = 0, air = false, percent = 0.0): Dash {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  const { world } = duelPair(maiev, target);
  target.status.damage = percent;
  if (air) lift(maiev, AIR_HEIGHT);
  stepDuel(world, side);
  const startX = maiev.motion.x;
  let hitFrame = 0;
  let launch = { x: 0.0, z: 0.0, hitstun: 0, damageLevel: 0 };
  while (maiev.special.action !== 0 && maiev.special.frame < 70) {
    const frame = maiev.special.frame;
    stepDuel(world, frame === shortenOn ? again : controls());
    if (hitFrame === 0 && target.status.damage > percent) {
      hitFrame = frame;
      launch = { x: target.launch.knockbackX, z: target.launch.knockbackZ, hitstun: target.launch.hitstun, damageLevel: target.launch.damageLevel };
    }
  }
  return { maiev, target, travel: f32(maiev.motion.x - startX), hitFrame, launch };
}

test("Maiev's Shadow Dash holds still to frame 20, then covers 3.5 heights in five frames, on the ground and in the air [k3 measure docs/design/maiev.md]", () => {
  assertEquals(dash(FAR).travel, FULL_DASH);
  assertEquals(f32(dash(FAR, 0, true).travel), FULL_DASH);
});

test("Pressing special on a travel frame stops the dash after that many steps, and a press before or on the last travel frame changes nothing [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  for (let frame = ILLUSION_FIRST_TRAVEL_FRAME; frame < ILLUSION_LAST_TRAVEL_FRAME; frame++) {
    assertEquals(dash(FAR, frame).travel, f32(STEP * (frame - ILLUSION_FIRST_TRAVEL_FRAME + 1)), `shortened on frame ${frame}`);
  }
  assertEquals(dash(FAR, ILLUSION_FIRST_TRAVEL_FRAME - 2).travel, SHADOW_DASH_DISTANCE, "a press in the windup is ignored");
  assertEquals(dash(FAR, ILLUSION_LAST_TRAVEL_FRAME).travel, SHADOW_DASH_DISTANCE, "a press on the last step is ignored");
});

test("A shortened dash still slashes a foe on the path it covered, once [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  const near = f32(STEP * f32(0.5));
  const short = dash(near, ILLUSION_FIRST_TRAVEL_FRAME);
  assertTrue(short.hitFrame > 0);
  assertEquals(short.target.status.damage, 7.0);
  assertTrue(short.travel < f32(STEP * 2.0));
});

test("The slash pops a grounded foe up at 80 degrees with no stun, tumbling into a follow-up at 0% [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  const hit = dash(f32(H * f32(1.5)));
  const { launch } = hit;
  assertTrue(hit.hitFrame > 0);
  assertTrue(launch.z > 0.0);
  assertTrue(Math.abs(f32(launch.z / Math.abs(launch.x)) - TAN_80) < f32(0.05));
  assertEquals(launch.damageLevel, 3);
  assertTrue(launch.hitstun >= ordinaryHitstunFrames(TUMBLE_KNOCKBACK));
});

test("In the air the dash leaves her helpless and works once per airtime [k4 reference references/melee-frame-data/fightcore.csv]", () => {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(Character.rifleman, FAR, -1);
  const { world } = duelPair(maiev, target);
  lift(maiev, f32(AIR_HEIGHT * 3.0));
  stepDuel(world, side);
  while (maiev.special.frame > 0 && !maiev.special.fall) stepDuel(world);
  assertTrue(maiev.special.fall);
  const x = maiev.motion.x;
  stepDuel(world, side);
  for (let frame = 0; frame < 30; frame++) stepDuel(world);
  assertTrue(Math.abs(f32(maiev.motion.x - x)) < STEP);
});

test("A grounded dash that carries her off the ledge ends helpless in the air [k1 scenario]", () => {
  const maiev = createFighter(Character.warden, f32(surfaceRight(0, 0, 0) - 40.0), 1);
  const target = createFighter(Character.rifleman, f32(-FAR), -1);
  const { world } = duelPair(maiev, target);
  stepDuel(world);
  assertTrue(maiev.motion.grounded);
  stepDuel(world, side);
  while (maiev.special.action !== 0 && maiev.special.frame < 70) stepDuel(world);
  assertFalse(maiev.motion.grounded);
  assertTrue(maiev.special.fall);
  assertEquals(maiev.jump.remaining, 0);
});

test("A rollback to mid-dash replays the shortened dash and its hit exactly [k1 scenario]", () => {
  const maiev = createFighter(Character.warden, 0.0, 1);
  const target = createFighter(Character.rifleman, f32(STEP * f32(1.5)), -1);
  const { world } = duelPair(maiev, target);
  stepDuel(world, side);
  while (maiev.special.frame < ILLUSION_FIRST_TRAVEL_FRAME - 1) stepDuel(world);
  const savedMaiev = createFighter(Character.warden, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(savedMaiev, maiev, 3);
  copyFighterState(savedTarget, target, 3);
  const run = (): readonly number[] => {
    for (let frame = 0; frame < 40; frame++) stepDuel(world, frame === 2 ? again : controls());
    return [maiev.motion.x, maiev.motion.z, target.motion.x, target.motion.z, target.status.damage, target.launch.hitstun];
  };
  const first = run();
  copyFighterState(maiev, savedMaiev, 3);
  copyFighterState(target, savedTarget, 3);
  assertEquals(run().join(","), first.join(","));
});
