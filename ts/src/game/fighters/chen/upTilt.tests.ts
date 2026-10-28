import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { UP_TILT_FIRST, UP_TILT_SCOOP, UP_TILT_STAFF } from "./moves";

const MID_WEIGHT = Character.mountainKing;
const FOE_GAP = 90.0;
const COMBO_PERCENTS = [0.0, 30.0, 60.0] as const;
const NO_KILL_PERCENT = 160.0;
const WATCH_FRAMES = 120;
const KO_WATCH_FRAMES = 300;
const RADIANS_TO_DEGREES = 180.0 / Math.PI;

type FollowUp = "upTilt" | "upAir";

interface Scoop {
  readonly s: Scene;
  readonly user: Fighter;
  readonly foe: Fighter;
}

function grounded(facing: number, percent: number): Scoop {
  const s = scene(0, [{ character: Character.chen, x: 0.0, facing }, { character: MID_WEIGHT, x: facing * FOE_GAP, facing: -facing }]);
  const foe = fighter(s, 1);
  foe.status.damage = percent;
  return { s, user: fighter(s), foe };
}

interface Combo {
  readonly firstHitFrame: number;
  readonly advantage: number;
  readonly followUpHeldInHitstun: boolean | undefined;
}

function scoopInto(facing: number, percent: number, followUp: FollowUp): Combo {
  const { s, user, foe } = grounded(facing, percent);
  let hits = 0, firstHitFrame = -1, advantage = -1, step = 0;
  let followUpHeldInHitstun: boolean | undefined;
  for (let tick = 0; tick < WATCH_FRAMES && followUpHeldInHitstun === undefined; tick++) {
    let press: readonly Action[] = tick === 0 ? [Action.cUp] : [];
    if (step === 1) { press = followUp === "upTilt" ? [Action.cUp] : [Action.jump]; step = 2; }
    else if (step === 2 && followUp === "upAir" && !user.motion.grounded) { press = [Action.cUp]; step = 3; }
    const damage = foe.status.damage, heldInHitstun = foe.launch.hitstun > 0;
    frame(s, press);
    if (foe.status.damage > damage) {
      hits++;
      if (hits === 1) firstHitFrame = user.attack.frame + 1;
      else followUpHeldInHitstun = heldInHitstun;
    }
    if (hits === 1 && step === 0 && user.attack.style === undefined) { advantage = foe.launch.hitstun; step = 1; }
  }
  return { firstHitFrame, advantage, followUpHeldInHitstun };
}

test("Chen's up tilt staff scoop pops a grounded mid-weight foe it hits on its first active frame into a true up tilt or up air follow-up at 0, 30 and 60%, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    for (const percent of COMBO_PERCENTS) {
      for (const followUp of ["upTilt", "upAir"] as const) {
        const combo = scoopInto(facing, percent, followUp);
        assertEquals(combo.firstHitFrame, UP_TILT_FIRST);
        assertGreaterThan(combo.advantage, 0);
        assertTrue(combo.followUpHeldInHitstun === true);
      }
    }
  }
});

test("Chen's up tilt launches a mid-weight foe at 100 and 150% almost straight up and slightly forward, and does not kill it from mid-stage at 160% [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const launches: number[] = [];
    for (const percent of [100.0, 150.0, NO_KILL_PERCENT]) {
      const { s, foe } = grounded(facing, percent);
      const stocks = foe.status.stocks;
      let launched = false;
      for (let tick = 0; tick < KO_WATCH_FRAMES; tick++) {
        const damage = foe.status.damage;
        frame(s, tick === 0 ? [Action.cUp] : []);
        if (!launched && foe.status.damage > damage) {
          launched = true;
          const x = foe.launch.knockbackX * facing, z = foe.launch.knockbackZ;
          const degrees = Math.atan2(z, x) * RADIANS_TO_DEGREES;
          assertGreaterThan(x, 0.0);
          assertGreaterThan(degrees, 80.0);
          assertLessThan(degrees, 90.0);
          launches.push(Math.sqrt(x * x + z * z));
        }
      }
      assertTrue(launched);
      if (percent === NO_KILL_PERCENT) assertEquals(foe.status.stocks, stocks);
    }
    assertLessThan(launches[0] ?? 0.0, launches[1] ?? 0.0);
  }
});

test("Chen's up tilt staff sweeps from in front, over his head, to behind him: a foe above his head is struck only once the staff reaches overhead, and a foe above and behind him only on its last frame, facing either way [k1 scenario]", () => {
  const last = UP_TILT_FIRST + UP_TILT_STAFF.length - 1;
  for (const facing of [1, -1]) {
    for (const [x, z, first] of [[10.0, 160.0, UP_TILT_FIRST + 3], [-150.0, 80.0, last]] as const) {
      const s = scene(0, [{ character: Character.chen, x: 0.0, facing }, { character: MID_WEIGHT, x: facing * x, facing }]);
      const user = fighter(s), foe = fighter(s, 1);
      let struck = -1;
      for (let tick = 0; tick < WATCH_FRAMES && struck < 0 && (tick < 2 || user.attack.style === AttackStyle.upTilt); tick++) {
        airborne(foe, facing * x, z);
        foe.motion.vz = 0.0;
        const damage = foe.status.damage;
        frame(s, tick === 0 ? [Action.cUp] : []);
        if (foe.status.damage > damage) struck = user.attack.frame + 1;
      }
      assertEquals(struck, first);
      assertEquals(foe.status.damage, UP_TILT_SCOOP.damage);
    }
  }
});
