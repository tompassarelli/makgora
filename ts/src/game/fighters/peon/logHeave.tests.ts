import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { fighter, frameRows, scene } from "../../match/padScene";
import { Character, SpecialAction } from "../../sim/codes";
import { canAttack } from "../../sim/conditions";
import { LOG_BUTT, LOG_TIPPER } from "./specials";

const TIP_RANGE = 100.0;
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
const jumpRest = (jumpAt: number, restAfter: number): FollowUp => (k) => (k === jumpAt ? { held: [Action.jump] } : k === jumpAt + restAfter ? { held: [Action.moveDown, Action.special] } : undefined);

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
    for (let jumpAt = 0; jumpAt <= 2 && !combos; jumpAt++) for (let restAfter = 1; restAfter <= 14 && !combos; restAfter++) combos = heave(TIP_RANGE, percent, jumpRest(jumpAt, restAfter)).followUpCombos;
    assertTrue(combos);
  }
});
