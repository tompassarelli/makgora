import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { Character, HitElement } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import {
  DOWN_AIR_CLEAN, DOWN_AIR_SOURSPOT, DOWN_AIR_SPIKE, FORWARD_AIR_CLEAN, FORWARD_AIR_SOURSPOT, FORWARD_AIR_SWEETSPOT,
  NEUTRAL_AIR_LAUNCH, NEUTRAL_AIR_LINK, UP_AIR_CLEAN, UP_AIR_FIRST, UP_AIR_LATE,
} from "./moves";

const AIR_Z = 600.0;
const WATCH_FRAMES = 70;
const KO_WATCH_FRAMES = 240;
const KILL_PERCENT = 95.0;
const DAMAGE_TOLERANCE = 0.0010000000474974513;

interface Contact {
  readonly damage: number;
  readonly frame: number;
  readonly heldInHitstun: boolean;
  readonly knockbackX: number;
  readonly knockbackZ: number;
  readonly element: HitElement;
}

function contacts(s: Scene, user: Fighter, foe: Fighter, press: (tick: number) => readonly Action[], before?: (tick: number) => void): Contact[] {
  const seen: Contact[] = [];
  for (let tick = 0; tick < WATCH_FRAMES; tick++) {
    before?.(tick);
    const heldInHitstun = foe.launch.hitstun > 0;
    const damage = foe.status.damage;
    frame(s, press(tick));
    if (foe.status.damage > damage) {
      seen.push({
        damage: f32(foe.status.damage - damage), frame: user.attack.frame + 1, heldInHitstun,
        knockbackX: foe.launch.knockbackX, knockbackZ: foe.launch.knockbackZ, element: foe.visuals.hitElement,
      });
    }
    if (tick > 2 && user.attack.style === undefined) break;
  }
  return seen;
}

const once = (press: Action) => (tick: number): readonly Action[] => (tick === 0 ? [press] : []);

function aerialScene(facing: number, foeX: number, foeZ: number): { s: Scene; user: Fighter; foe: Fighter } {
  const s = scene(0, [{ character: Character.chen, x: 0.0, facing }, { character: Character.chen, x: facing * foeX, facing: -facing }]);
  const user = fighter(s), foe = fighter(s, 1);
  airborne(user, 0.0, AIR_Z);
  airborne(foe, facing * foeX, AIR_Z + foeZ);
  return { s, user, foe };
}

function forward(facing: number): Action {
  return facing > 0 ? Action.cRight : Action.cLeft;
}

function near(actual: number | undefined, expected: number): boolean {
  return actual !== undefined && Math.abs(actual - expected) < DAMAGE_TOLERANCE;
}

function stockLostAfter(s: Scene, foe: Fighter): boolean {
  const stocks = foe.status.stocks;
  for (let tick = 0; tick < KO_WATCH_FRAMES; tick++) {
    frame(s, []);
    if (foe.status.stocks < stocks) return true;
  }
  return false;
}

test("Chen's forward air flying kick lands its electric heel sweetspot only on its clean frames and only at the heel: the heel kills a foe at 95% from mid-stage, the leg and a late kick deal the weak hit and do not, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const heel = aerialScene(facing, 112.0, 0.0);
    heel.foe.status.damage = KILL_PERCENT;
    const sweet = contacts(heel.s, heel.user, heel.foe, once(forward(facing)));
    assertEquals(sweet.length, 1);
    assertTrue(near(sweet[0]?.damage, FORWARD_AIR_SWEETSPOT.damage));
    assertEquals(sweet[0]?.element, HitElement.electric);
    assertEquals(sweet[0]?.frame, FORWARD_AIR_CLEAN.first);
    assertTrue(Math.sign(sweet[0]?.knockbackX ?? 0.0) === facing);
    assertTrue(stockLostAfter(heel.s, heel.foe));

    const leg = aerialScene(facing, 40.0, 0.0);
    leg.foe.status.damage = KILL_PERCENT;
    const sour = contacts(leg.s, leg.user, leg.foe, once(forward(facing)));
    assertEquals(sour.length, 1);
    assertTrue(near(sour[0]?.damage, FORWARD_AIR_SOURSPOT.damage));
    assertEquals(sour[0]?.element, HitElement.normal);
    assertTrue(!stockLostAfter(leg.s, leg.foe));

    const late = aerialScene(facing, 112.0, 400.0);
    const lateHits = contacts(late.s, late.user, late.foe, once(forward(facing)), () => {
      if (late.user.attack.frame + 2 === FORWARD_AIR_CLEAN.last + 1) airborne(late.foe, late.user.motion.x + facing * 112.0, late.user.motion.z);
    });
    assertEquals(lateHits.length, 1);
    assertTrue(near(lateHits[0]?.damage, FORWARD_AIR_SOURSPOT.damage));
    assertEquals(lateHits[0]?.frame, FORWARD_AIR_CLEAN.last + 1);
  }
});

test("Chen's down air keg slam spikes an airborne foe struck by the keg's base on its clean frames, knocks a foe struck by the rim away for less, and pops a standing foe up from a short hop, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const under = aerialScene(facing, 0.0, -140.0);
    const spike = contacts(under.s, under.user, under.foe, once(Action.cDown));
    assertEquals(spike.length, 1);
    assertTrue(near(spike[0]?.damage, DOWN_AIR_SPIKE.damage));
    assertEquals(spike[0]?.frame, DOWN_AIR_CLEAN.first);
    assertLessThan(spike[0]?.knockbackZ ?? 0.0, 0.0);

    const beside = aerialScene(facing, 60.0, 0.0);
    const rim = contacts(beside.s, beside.user, beside.foe, once(Action.cDown));
    assertEquals(rim.length, 1);
    assertTrue(near(rim[0]?.damage, DOWN_AIR_SOURSPOT.damage));
    assertLessThan(Math.abs(rim[0]?.knockbackZ ?? 0.0) + Math.abs(rim[0]?.knockbackX ?? 0.0), Math.abs(spike[0]?.knockbackZ ?? 0.0));

    const s = scene(0, [{ character: Character.chen, x: 0.0, facing }, { character: Character.warden, x: facing * 20.0, facing: -facing }]);
    const user = fighter(s), foe = fighter(s, 1);
    frame(s, [Action.jump]);
    let pressed = false;
    const hop = contacts(s, user, foe, () => {
      const takeoff = !pressed && (!user.motion.grounded || user.jump.squat === 1);
      pressed ||= takeoff;
      return takeoff ? [Action.cDown] : [];
    });
    assertEquals(hop.length, 1);
    assertGreaterThan(hop[0]?.knockbackZ ?? 0.0, 0.0);
  }
});

test("Chen's neutral air staff spin lands exactly two hits on an airborne foe, the first holding the foe in hitstun until the second launches it, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const { s, user, foe } = aerialScene(facing, 70.0, 0.0);
    const hits = contacts(s, user, foe, once(Action.attack));
    assertEquals(hits.length, 2);
    assertTrue(near(hits[0]?.damage, NEUTRAL_AIR_LINK.damage));
    assertTrue(near(hits[1]?.damage, NEUTRAL_AIR_LAUNCH.damage));
    assertTrue(hits[1]?.heldInHitstun === true);
  }
});

test("Chen's up air scoops a foe low in front on its first frame and sweeps over his head to strike a foe above and behind him later, launching both upward, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const front = aerialScene(facing, 110.0, 0.0);
    const scoop = contacts(front.s, front.user, front.foe, once(Action.cUp));
    assertEquals(scoop.length, 1);
    assertEquals(scoop[0]?.frame, UP_AIR_FIRST);
    assertTrue(near(scoop[0]?.damage, UP_AIR_CLEAN.damage));
    assertGreaterThan(scoop[0]?.knockbackZ ?? 0.0, 0.0);

    const back = aerialScene(facing, -100.0, 40.0);
    const cover = contacts(back.s, back.user, back.foe, once(Action.cUp));
    assertEquals(cover.length, 1);
    assertTrue(near(cover[0]?.damage, UP_AIR_LATE.damage));
    assertGreaterThan(cover[0]?.knockbackZ ?? 0.0, 0.0);
  }
});

function runDistance(character: Character, frames: number): number {
  const s = scene(0, [{ character, x: -300.0, facing: 1 }, { character: Character.rifleman, x: 900.0, facing: -1 }]);
  const user = fighter(s);
  for (let tick = 0; tick < frames; tick++) frame(s, [Action.moveRight]);
  return f32(user.motion.x + 300.0);
}

test("Chen's dash and run carry him within a tenth of Warden's Falcon-speed distance over 40 frames from a standstill, but never past it [k1 scenario]", () => {
  const chen = runDistance(Character.chen, 40), warden = runDistance(Character.warden, 40);
  assertGreaterThan(chen, f32(warden * f32(0.9)));
  assertLessThan(chen, warden);
});
