import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { type Controls, type Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { controls, testBeginAttacks } from "./testWorld";
import { duelPair, stepDuel } from "./testDuel";

const STAGE = 1;
const DECK = 2;
const EDGE = surfaceRight(STAGE, DECK, 0);
const TOP = surfaceZ(STAGE, DECK, 0);
const AT_EDGE = 1.0;
const MID_PLATFORM = f32(f32(f32(surfaceLeft(STAGE, DECK, 0) + EDGE) / 2.0) + 60.0);
const SPACING = 60.0;

interface Pressure { readonly world: Roster; readonly defender: Fighter; readonly attacker: Fighter }

function onDeck(f: Fighter, x: number): void {
  f.motion.x = x;
  f.motion.z = TOP;
  f.motion.vx = 0.0;
  f.motion.grounded = true;
  f.motion.surface = DECK;
}

function pressure(defenderX: number, facing: number): Pressure {
  const { world, owner, target } = duelPair(createFighter(Character.rifleman, defenderX, facing), createFighter(Character.rifleman, f32(defenderX - SPACING), 1), 0, STAGE);
  for (let i = 0; i < 3; i++) {
    onDeck(owner, defenderX);
    onDeck(target, f32(defenderX - SPACING));
    stepDuel(world, shield(), controls(), STAGE);
  }
  return { world, defender: owner, attacker: target };
}

const shield = (fields: Partial<Controls> = {}): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0, ...fields });

interface Shieldstun { readonly stunFrames: number; readonly peakX: number; readonly fell: boolean; readonly acted: boolean }

function jabOnShield(p: Pressure): Shieldstun {
  const { world, defender, attacker } = p;
  const shields = defender.visuals.shield;
  testBeginAttacks(world, undefined, AttackStyle.jab);
  stepDuel(world, shield(), controls(), STAGE);
  let frame = 1;
  while (defender.visuals.shield === shields && frame++ < 30) stepDuel(world, shield(), controls(), STAGE);
  assertGreaterThan(defender.visuals.shield, shields);
  let stunFrames = 0;
  let peakX = defender.motion.x;
  let fell = false;
  while ((defender.launch.hitlag > 0 || defender.shield.stun > 0) && !fell) {
    const stunned = defender.shield.stun > 0;
    stepDuel(world, shield(), controls(), STAGE);
    if (stunned) stunFrames++;
    peakX = Math.max(peakX, defender.motion.x);
    fell = !defender.motion.grounded;
  }
  if (fell) return { stunFrames, peakX, fell, acted: false };
  assertEquals(attacker.visuals.hit, 0);
  stepDuel(world, shield({ jumpPressed: true }), controls(), STAGE);
  return { stunFrames, peakX, fell, acted: defender.jump.squat > 0 || !defender.motion.grounded };
}

test("Shield teeter: a shield pushed to an edge stops there in either facing, acts on the first frame after its shieldstun and takes no more stun than mid-platform [k1 scenario]", () => {
  for (const facing of [-1, 1]) {
    const open = jabOnShield(pressure(MID_PLATFORM, facing));
    assertTrue(!open.fell && open.acted);
    assertGreaterThan(open.peakX, MID_PLATFORM);
    const edge = pressure(f32(EDGE - AT_EDGE), facing);
    const run = jabOnShield(edge);
    assertTrue(!run.fell);
    assertEquals(run.peakX, EDGE);
    assertEquals(edge.defender.motion.surface, DECK);
    assertEquals(edge.defender.facing, facing);
    assertEquals(run.stunFrames, open.stunFrames);
    assertTrue(run.acted);
  }
});
