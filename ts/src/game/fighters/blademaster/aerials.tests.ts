import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { landsInAutoCancel } from "../../sim/moves";
import { BLADEMASTER_MOVES, DOWN_AIR_SOURSPOT, DOWN_AIR_TIPPER, NEUTRAL_AIR_LAUNCH, NEUTRAL_AIR_LINK } from "./moves";

const REPLACED_DOWN_AIR_FRAMES = 46;
const DOWN_AIR_ACTIONABLE_FRAME = 44;
const DOWN_AIR_LATE_CANCEL_FRAME = 38;
const DOWN_AIR_EARLY_CANCEL_BEFORE = 6;
const DOWN_AIR_LANDING_LAG = 16;
const HIGH_AIR_Z = 1500.0;
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

interface Reaction { readonly name: string; readonly press: readonly Action[] }

const REACTIONS: readonly Reaction[] = [
  { name: "double jump", press: [Action.jump] },
  { name: "up special", press: [Action.special, Action.moveUp] },
  { name: "air dodge", press: [Action.leftTrigger] },
  { name: "aerial", press: [Action.attack] },
];

function reactsAfterDownAir(reaction: Reaction, pressTick: number): boolean {
  const s = scene(0, [{ character: Character.blademaster, x: 0.0, facing: 1 }, { character: Character.warden, x: 500.0, facing: -1 }]);
  const user = fighter(s);
  airborne(user, 0.0, HIGH_AIR_Z);
  frame(s, [Action.smashDown]);
  for (let tick = 1; tick < pressTick; tick++) frame(s, []);
  assertEquals(user.attack.style, AttackStyle.downAir);
  const jumps = user.jump.remaining, serial = user.attack.serial, special = user.special.action, dodging = user.dodge.airDodging;
  frame(s, reaction.press);
  return user.jump.remaining !== jumps || user.attack.serial !== serial || user.special.action !== special || user.dodge.airDodging !== dodging;
}

test("Blademaster's down air frees him to double jump, up special, air dodge and attack in the air on frame 44 and not on the frame before [k1 scenario]", () => {
  for (const reaction of REACTIONS) {
    assertFalse(reactsAfterDownAir(reaction, DOWN_AIR_ACTIONABLE_FRAME - 1));
    assertTrue(reactsAfterDownAir(reaction, DOWN_AIR_ACTIONABLE_FRAME));
  }
});

test("Blademaster's down air auto-cancels its landing before frame 6 and from frame 38 and keeps its hit frames 6 to 9 and its 16 frames of landing lag [k3 measure docs/design/roster.md]", () => {
  const move = BLADEMASTER_MOVES.normals[AttackStyle.downAir];
  assertTrue(move !== undefined);
  if (move === undefined) return;
  assertEquals(move.startupFrames, 5);
  assertEquals(move.activeFrames, 4);
  assertEquals(move.landingLag, DOWN_AIR_LANDING_LAG);
  const cancels = (displayFrame: number): boolean => landsInAutoCancel(Character.blademaster, AttackStyle.downAir, displayFrame - 1, BLADEMASTER_MOVES);
  assertTrue(cancels(DOWN_AIR_EARLY_CANCEL_BEFORE - 1));
  assertFalse(cancels(DOWN_AIR_EARLY_CANCEL_BEFORE));
  assertFalse(cancels(DOWN_AIR_LATE_CANCEL_FRAME - 1));
  assertTrue(cancels(DOWN_AIR_LATE_CANCEL_FRAME));
});
