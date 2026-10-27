import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { BLADEMASTER_MOVES, DOWN_AIR_SOURSPOT, DOWN_AIR_TIPPER, NEUTRAL_AIR_LAUNCH, NEUTRAL_AIR_LINK } from "./moves";

const REPLACED_DOWN_AIR_FRAMES = 46;
const WATCH_FRAMES = 70;
const DAMAGE_TOLERANCE = 0.0010000000474974513;
const AIR_Z = 400.0;
const FOE_AHEAD = 80.0;
const TIP_AT = { ahead: 100.0, below: 40.0 } as const;
const INNER_AT = { ahead: 40.0, below: 40.0 } as const;

interface Contact { readonly damage: number; readonly heldInHitstun: boolean; readonly knockbackZ: number }

function contacts(s: Scene, user: Fighter, foe: Fighter, start: () => readonly Action[]): Contact[] {
  const seen: Contact[] = [];
  for (let tick = 0; tick < WATCH_FRAMES; tick++) {
    const held = start();
    const heldInHitstun = foe.launch.hitstun > 0;
    const before = foe.status.damage;
    frame(s, held);
    if (foe.status.damage > before) {
      seen.push({ damage: f32(foe.status.damage - before), heldInHitstun, knockbackZ: foe.launch.knockbackZ });
    }
    if (user.motion.grounded && tick > 2 && user.attack.style === undefined) break;
  }
  return seen;
}

function shortHop(s: Scene, user: Fighter, press: Action): () => readonly Action[] {
  frame(s, [Action.jump]);
  let pressed = false;
  return () => {
    const takeoff = !pressed && (!user.motion.grounded || user.jump.squat === 1);
    pressed ||= takeoff;
    return takeoff ? [press] : [];
  };
}

function once(press: Action): () => readonly Action[] {
  let sent = false;
  return () => {
    if (sent) return [];
    sent = true;
    return [press];
  };
}

test("Blademaster's neutral air lands exactly two hits on a grounded foe from a short hop and on an airborne foe, the first holding the foe in hitstun until the second launches it, facing either way, and ends sooner than the 46-frame down air it replaces [k1 scenario]", () => {
  const move = BLADEMASTER_MOVES.normals[AttackStyle.neutralAir];
  assertTrue(move !== undefined);
  if (move === undefined) return;
  assertLessThan(move.totalFrames, REPLACED_DOWN_AIR_FRAMES);
  for (const facing of [1, -1]) {
    for (const grounded of [true, false]) {
      const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing }, { character: Character.warden, x: facing * FOE_AHEAD, facing: -facing }]);
      const user = fighter(s), foe = fighter(s, 1);
      if (!grounded) {
        airborne(user, 0.0, AIR_Z);
        airborne(foe, facing * FOE_AHEAD, AIR_Z);
      }
      const hits = contacts(s, user, foe, grounded ? shortHop(s, user, Action.attack) : once(Action.attack));
      assertEquals(hits.length, 2);
      assertLessThan(Math.abs((hits[0]?.damage ?? 0.0) - NEUTRAL_AIR_LINK.damage), DAMAGE_TOLERANCE);
      assertLessThan(Math.abs((hits[1]?.damage ?? 0.0) - NEUTRAL_AIR_LAUNCH.damage), DAMAGE_TOLERANCE);
      assertTrue(hits[1]?.heldInHitstun === true);
    }
  }
});

test("Blademaster's down air spikes an airborne foe struck by the blade tip and sends one struck by the inner blade upward for less damage, facing either way, and its short hop reaches a standing foe [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const outcome = (spot: { readonly ahead: number; readonly below: number }): Contact | undefined => {
      const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing }, { character: Character.blademaster, x: facing * spot.ahead, facing: -facing }]);
      const user = fighter(s), foe = fighter(s, 1);
      airborne(user, 0.0, AIR_Z);
      airborne(foe, facing * spot.ahead, AIR_Z - spot.below);
      const hits = contacts(s, user, foe, once(Action.smashDown));
      assertEquals(hits.length, 1);
      return hits[0];
    };
    const tip = outcome(TIP_AT), inner = outcome(INNER_AT);
    assertEquals(tip?.damage, DOWN_AIR_TIPPER.damage);
    assertEquals(inner?.damage, DOWN_AIR_SOURSPOT.damage);
    assertLessThan(tip?.knockbackZ ?? 0.0, 0.0);
    assertGreaterThan(inner?.knockbackZ ?? 0.0, 0.0);

    const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing }, { character: Character.warden, x: facing * FOE_AHEAD, facing: -facing }]);
    const user = fighter(s), foe = fighter(s, 1);
    assertEquals(contacts(s, user, foe, shortHop(s, user, Action.smashDown)).length, 1);
  }
});
