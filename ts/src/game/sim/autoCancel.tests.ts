import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "./codes";
import { beginFighterAttack } from "./attacks";
import { EMPTY_LANDING_LAG } from "./down";
import { createFighter } from "./fighter";
import { attackLandingLag } from "./moves";
import { duelPair, lift, stepDuel } from "./testDuel";

/** Starts the aerial in the air and touches down on its 1-based move frame `landingFrame`; returns the landing lag. */
function landingLagOnFrame(character: Character, style: AttackStyle, landingFrame: number): number {
  const { world, owner } = duelPair(createFighter(character, 0.0, 1), createFighter(Character.rifleman, -500.0, 1));
  lift(owner, 600.0);
  beginFighterAttack(world, 0, style, false);
  for (let frame = 2; frame < landingFrame; frame++) stepDuel(world);
  owner.motion.z = 0.5;
  owner.motion.vz = -3.0;
  stepDuel(world);
  if (!owner.motion.grounded) throw new Error("the probe did not land");
  return owner.landing.lag;
}

test("Aerial auto-cancel: Maiev's up air, in Fox's <8 25> window, lands on frames 7 and 25 with only the empty landing lag and on frames 8 and 24 with its own 9 [k4 reference melee]", () => {
  const moves = createFighter(Character.warden, 0.0, 1).tuning.moves;
  assertEquals(attackLandingLag(AttackStyle.upAir, moves), 9);
  assertEquals(landingLagOnFrame(Character.warden, AttackStyle.upAir, 7), EMPTY_LANDING_LAG);
  assertEquals(landingLagOnFrame(Character.warden, AttackStyle.upAir, 8), 9);
  assertEquals(landingLagOnFrame(Character.warden, AttackStyle.upAir, 24), 9);
  assertEquals(landingLagOnFrame(Character.warden, AttackStyle.upAir, 25), EMPTY_LANDING_LAG);
});

test("Aerial auto-cancel: an aerial with no Melee counterpart, Rifleman's down air (active 8-10), cancels before frame 8 and from frame 19, 9 after its last active frame [k4 reference melee]", () => {
  assertEquals(landingLagOnFrame(Character.rifleman, AttackStyle.downAir, 7), EMPTY_LANDING_LAG);
  assertEquals(landingLagOnFrame(Character.rifleman, AttackStyle.downAir, 8), 9);
  assertEquals(landingLagOnFrame(Character.rifleman, AttackStyle.downAir, 18), 9);
  assertEquals(landingLagOnFrame(Character.rifleman, AttackStyle.downAir, 19), EMPTY_LANDING_LAG);
});
