import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { airborne, fighter, frameRows, scene } from "../../match/padScene";
import { Character, SpecialAction } from "../../sim/codes";
import { canAttack } from "../../sim/conditions";
import type { StrikeCapsule } from "../../sim/heroMoves";
import { PEON_HERO } from "./kit";
import type { AuthoredSpecial } from "../../sim/specials/schema";
import { LOG_LENGTH, LOG_LYING_HEIGHT, LOG_PATH } from "./logPath";
import { LOG_BUTT, LOG_HEAVE_AIR_LANDING_LAG, LOG_HEAVE_FIRST_ACTIVE, LOG_OVERHEAD, LOG_RISING, LOG_TIPPER } from "./specials";

const TIP_RANGE = 150.0;
const AIR_HEIGHT = 600.0;
const LOW_AIR_HEIGHT = 30.0;
const ON_LOG = 1.0;
const LIFT_FRAME = 13;
const REST_AFTER_JUMP = 24;
const CLOSE_RANGE = 40.0;
const TILT_UP = 80;
const WATCH = 160;

type FollowUp = (frameSinceFree: number) => { readonly held: readonly Action[]; readonly axisZ?: number | undefined } | undefined;

interface Heave {
  readonly damage: number;
  readonly startX: number;
  readonly peakZ: number;
  readonly closestX: number;
  readonly peonFree: number;
  readonly foeFree: number;
  readonly followUpCombos: boolean;
}

function heave(distance: number, percent: number, followUp?: FollowUp): Heave {
  const s = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.rifleman, x: distance, facing: -1 }]);
  const peon = fighter(s, 0);
  const foe = fighter(s, 1);
  foe.status.damage = percent;
  const startX = foe.motion.x;
  let damage = 0.0, peakZ = foe.motion.z, closestX = startX, peonFree = 0, foeFree = 0, afterHeave = 0.0;
  for (let n = 1; n <= WATCH; n++) {
    const next = peonFree > 0 && followUp !== undefined ? followUp(n - peonFree) : undefined;
    const held = n === 1 ? [Action.moveRight, Action.special] : next?.held ?? [];
    frameRows(s, [held, []], (row, slot) => { if (slot === 0 && next?.axisZ !== undefined) row.axisZ = next.axisZ; });
    if (n === 1) assertEquals(peon.special.action, SpecialAction.heroSide, "Peon starts Log Heave");
    if (damage === 0.0 && foe.status.damage > percent) {
      damage = f32(foe.status.damage - percent);
      afterHeave = foe.status.damage;
    }
    if (damage === 0.0) continue;
    peakZ = Math.max(peakZ, foe.motion.z);
    closestX = Math.min(closestX, foe.motion.x);
    if (peonFree === 0 && peon.special.action === SpecialAction.none && canAttack(peon)) peonFree = n;
    if (foeFree === 0 && foe.launch.hitstun <= 0 && foe.launch.hitlag <= 0) foeFree = n;
    if (foe.status.damage > afterHeave) return { damage, startX, peakZ, closestX, peonFree, foeFree, followUpCombos: foeFree === 0 };
  }
  return { damage, startX, peakZ, closestX, peonFree, foeFree, followUpCombos: false };
}

const upTilt = (delay: number): FollowUp => (k) => (k === delay ? { held: [Action.attack], axisZ: TILT_UP } : undefined);
const jumpRest = (jumpAt: number, restAfter: number): FollowUp => (k) => (k === jumpAt ? { held: [Action.jump, Action.moveRight] } : k === jumpAt + restAfter ? { held: [Action.moveDown, Action.special] } : k > jumpAt && k < jumpAt + restAfter ? { held: [Action.moveRight] } : undefined);

test("Peon's Log Heave tipper at mid range pops Rifleman up and back toward Peon, leaves Peon free first, and up-tilt true-combos from it at 30% [k3 measure docs/design/peasant.md]", () => {
  const plain = heave(TIP_RANGE, 30.0);
  assertEquals(plain.damage, LOG_TIPPER.damage, "tipper damage");
  assertLessThan(plain.closestX, f32(plain.startX - 50.0));
  assertGreaterThan(plain.peakZ, 60.0);
  assertGreaterThan(plain.foeFree, plain.peonFree);
  let combos = false;
  for (let delay = 0; delay <= 6 && !combos; delay++) combos = heave(TIP_RANGE, 30.0, upTilt(delay)).followUpCombos;
  assertTrue(combos);
});

test("Peon's Log Heave hits a close Rifleman with only the weak butt of the log, which leaves Peon punishable [k3 measure docs/design/peasant.md]", () => {
  const close = heave(CLOSE_RANGE, 30.0);
  assertEquals(close.damage, LOG_BUTT.damage, "butt damage");
  assertLessThan(close.foeFree, close.peonFree);
});

test("Peon's Log Heave tipper, then a jump, then Rest true-combos Rifleman at 0% and 80% [k3 measure docs/design/peasant.md]", () => {
  for (const percent of [0.0, 80.0]) {
    let combos = false;
    for (let jumpAt = 0; jumpAt <= 2 && !combos; jumpAt++) for (let restAfter = 1; restAfter <= REST_AFTER_JUMP && !combos; restAfter++) combos = heave(TIP_RANGE, percent, jumpRest(jumpAt, restAfter)).followUpCombos;
    assertTrue(combos);
  }
});

const capsuleLength = (c: Readonly<StrikeCapsule>): number => Math.sqrt((c.x2 - c.x1) * (c.x2 - c.x1) + (c.z2 - c.z1) * (c.z2 - c.z1));

test("Peon's Log Heave log is 156 units long and every active frame's hit capsule lies along the drawn log, butt in his hands and tipper at the far end [k3 measure docs/design/peasant.md]", () => {
  assertEquals(LOG_LENGTH, 156.0, "log length");
  for (const [index, capsule] of [...LOG_RISING, ...LOG_OVERHEAD].entries()) {
    const frame = LOG_HEAVE_FIRST_ACTIVE + index;
    const key = LOG_PATH.find((k) => k.frame === frame);
    assertTrue(key !== undefined);
    if (key === undefined) continue;
    const radians = key.angle * Math.PI / 180.0;
    assertEquals(capsule.x1, key.x, `frame ${frame} capsule butt x`);
    assertEquals(capsule.z1, key.z, `frame ${frame} capsule butt z`);
    assertLessThan(Math.abs(capsule.x2 - (key.x + LOG_LENGTH * Math.cos(radians))), ON_LOG);
    assertLessThan(Math.abs(capsule.z2 - (key.z + LOG_LENGTH * Math.sin(radians))), ON_LOG);
    assertLessThan(Math.abs(capsuleLength(capsule) - LOG_LENGTH), ON_LOG);
  }
});

test("Peon's Log Heave log lies flat on the floor ahead of him until he lifts it [k3 measure docs/design/peasant.md]", () => {
  const lying = LOG_PATH.filter((k) => k.frame < LIFT_FRAME);
  assertGreaterThan(lying.length, 1);
  for (const key of lying) {
    assertEquals(key.z, LOG_LYING_HEIGHT, `frame ${key.frame} log height`);
    assertEquals(key.angle, 0.0, `frame ${key.frame} log angle`);
    assertGreaterThan(key.x, 0.0);
  }
});

function airHeave(height: number, foeX?: number): { readonly peon: ReturnType<typeof fighter>; readonly foe: ReturnType<typeof fighter>; readonly run: (this: void, frames: number, held?: (n: number) => readonly Action[]) => void } {
  const s = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.rifleman, x: foeX ?? 900.0, facing: -1 }]);
  const peon = fighter(s, 0);
  const foe = fighter(s, 1);
  airborne(peon, 0.0, height);
  if (foeX !== undefined) airborne(foe, foeX, height);
  const run = (frames: number, held: (n: number) => readonly Action[] = (n) => (n === 1 ? [Action.moveRight, Action.special] : [])): void => {
    for (let n = 1; n <= frames; n++) frameRows(s, [held(n), []]);
  };
  return { peon, foe, run };
}

test("Peon's air Log Heave keeps falling and hits a Rifleman falling beside him with the tipper [k3 measure docs/design/peasant.md]", () => {
  const { peon, foe, run } = airHeave(AIR_HEIGHT, TIP_RANGE);
  run(1);
  assertEquals(peon.special.action, SpecialAction.heroSide, "Peon starts the air Log Heave");
  const start = peon.motion.z;
  run(LOG_HEAVE_FIRST_ACTIVE - 2, () => []);
  assertLessThan(peon.motion.vz, 0.0);
  assertLessThan(peon.motion.z, start);
  for (let n = 0; n < 6 && foe.status.damage === 0.0; n++) run(1, () => []);
  assertEquals(foe.status.damage, LOG_TIPPER.damage, "tipper damage");
});

test("Peon's air Log Heave works once per airtime [k3 measure docs/design/peasant.md]", () => {
  const { peon, run } = airHeave(AIR_HEIGHT);
  run(1);
  assertEquals(peon.special.action, SpecialAction.heroSide, "first air Log Heave");
  for (let n = 0; n < 60 && peon.special.action !== SpecialAction.none; n++) run(1, () => []);
  assertTrue(!peon.motion.grounded);
  run(1);
  assertTrue(peon.special.action !== SpecialAction.heroSide);
});

test("Peon's air Log Heave ends on landing with 15 frames of landing lag [k3 measure docs/design/peasant.md]", () => {
  const { peon, run } = airHeave(LOW_AIR_HEIGHT);
  run(1);
  assertEquals(peon.special.action, SpecialAction.heroSide, "air Log Heave starts");
  let landed = 0;
  for (let n = 2; n <= 30 && landed === 0; n++) {
    run(1, () => []);
    if (peon.motion.grounded) landed = n;
  }
  assertGreaterThan(landed, 0);
  assertLessThan(landed, LOG_HEAVE_FIRST_ACTIVE + 6);
  assertEquals(peon.special.action, SpecialAction.none, "landing ends the heave");
  let free = 0;
  for (let n = 1; n <= 40 && free === 0; n++) {
    if (canAttack(peon)) free = n;
    else run(1, () => []);
  }
  assertGreaterThan(free, LOG_HEAVE_AIR_LANDING_LAG - 2);
  assertLessThan(free, LOG_HEAVE_AIR_LANDING_LAG + 3);
});

const LOG_SAMPLES = 8;

const outsideCapsule = (x: number, z: number, c: Readonly<StrikeCapsule>): number => {
  const ux = c.x2 - c.x1, uz = c.z2 - c.z1, span = ux * ux + uz * uz;
  const t = span === 0.0 ? 0.0 : Math.max(0.0, Math.min(1.0, ((x - c.x1) * ux + (z - c.z1) * uz) / span));
  return Math.sqrt((x - c.x1 - ux * t) * (x - c.x1 - ux * t) + (z - c.z1 - uz * t) * (z - c.z1 - uz * t)) - c.radius;
};

const strikesAt = (special: AuthoredSpecial | undefined, frame: number) =>
  (special?.regions ?? []).flatMap((region) => (frame - 1 >= region.firstFrame && frame - 1 <= region.lastFrame && region.hit.strike !== undefined ? [region.hit] : []));

test("Peon's ground and air Log Heave hit regions cover the drawn log from grip to far end on every active frame, the tipper at the far end [k3 measure docs/design/peasant.md]", () => {
  const side = PEON_HERO.specials?.side;
  for (const [form, special] of [["ground", side?.ground], ["air", side?.air]] as const) {
    for (const [index, log] of [...LOG_RISING, ...LOG_OVERHEAD].entries()) {
      const frame = LOG_HEAVE_FIRST_ACTIVE + index;
      const hits = strikesAt(special, frame);
      assertEquals(hits.length > 0, true, `${form} frame ${frame} has hit regions`);
      for (let step = 0; step <= LOG_SAMPLES; step++) {
        const x = log.x1 + (log.x2 - log.x1) * step / LOG_SAMPLES, z = log.z1 + (log.z2 - log.z1) * step / LOG_SAMPLES;
        assertEquals(hits.some((hit) => hit.strike !== undefined && outsideCapsule(x, z, hit.strike) <= ON_LOG), true, `${form} frame ${frame}: no hit region at ${step} of ${LOG_SAMPLES} along the log`);
      }
      if (index < LOG_RISING.length) {
        assertEquals(hits.some((hit) => hit.effect.damage === LOG_TIPPER.damage && hit.strike !== undefined && outsideCapsule(log.x2, log.z2, hit.strike) <= ON_LOG), true, `${form} frame ${frame}: the tipper does not reach the log's far end`);
      }
    }
  }
});

test("Peon's ground and air Log Heave hit a Rifleman standing at the log's far end on its first active frame [k3 measure docs/design/peasant.md]", () => {
  const farEnd = LOG_RISING[0]?.x2 ?? 0.0;
  const ground = scene(0, [{ character: Character.peon, x: 0.0, facing: 1 }, { character: Character.rifleman, x: farEnd, facing: -1 }]);
  const groundFoe = fighter(ground, 1);
  let groundFrame = 0;
  for (let n = 1; n <= LOG_HEAVE_FIRST_ACTIVE + 3 && groundFoe.status.damage === 0.0; n++) {
    frameRows(ground, [n === 1 ? [Action.moveRight, Action.special] : [], []]);
    groundFrame = fighter(ground, 0).special.frame;
  }
  assertEquals(groundFoe.status.damage, LOG_TIPPER.damage, "ground tipper damage");
  assertEquals(groundFrame, LOG_HEAVE_FIRST_ACTIVE, "ground hit frame");
  const { foe, peon, run } = airHeave(AIR_HEIGHT, farEnd);
  let airFrame = 0;
  for (let n = 1; n <= LOG_HEAVE_FIRST_ACTIVE + 3 && foe.status.damage === 0.0; n++) {
    run(1, n === 1 ? undefined : () => []);
    airFrame = peon.special.frame;
  }
  assertEquals(foe.status.damage, LOG_TIPPER.damage, "air tipper damage");
  assertEquals(airFrame, LOG_HEAVE_FIRST_ACTIVE, "air hit frame");
});
