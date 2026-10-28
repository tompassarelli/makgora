import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { landsInAutoCancel } from "../../sim/moves";
import { MOUNTAIN_KING_MOVES, NEUTRAL_AIR_CLEAN, NEUTRAL_AIR_CLEAN_LAST, NEUTRAL_AIR_HAMMER, NEUTRAL_AIR_HEAD, NEUTRAL_AIR_LATE } from "./moves";

const FIRST_ACTIVE = 7;
const LAST_ACTIVE = 32;
const TOTAL_FRAMES = 43;
const LANDING_LAG = 8;
const EARLY_CANCEL_BEFORE = 7;
const LATE_CANCEL_FROM = 38;
const AIR_Z = 400.0;
const WATCH_FRAMES = 60;

interface Contact { readonly tick: number; readonly damage: number }

function contacts(s: Scene, user: Fighter, foe: Fighter, start: () => readonly Action[]): Contact[] {
  const seen: Contact[] = [];
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const before = foe.status.damage;
    frame(s, start());
    if (foe.status.damage > before) seen.push({ tick, damage: f32(foe.status.damage - before) });
    if (user.motion.grounded && tick > 2 && user.attack.style === undefined) break;
  }
  return seen;
}

function once(press: Action): () => readonly Action[] {
  let sent = false;
  return () => {
    if (sent) return [];
    sent = true;
    return [press];
  };
}

function shortHop(s: Scene, user: Fighter): () => readonly Action[] {
  frame(s, [Action.jump]);
  let pressed = false;
  return () => {
    const takeoff = !pressed && (!user.motion.grounded || user.jump.squat === 1);
    pressed ||= takeoff;
    return takeoff ? [Action.attack] : [];
  };
}

function airContacts(facing: number, ahead: number, below: number): Contact[] {
  const s = scene(0, [{ character: Character.mountainKing, x: 0.0, facing }, { character: Character.mountainKing, x: facing * ahead, facing: -facing }]);
  const user = fighter(s), foe = fighter(s, 1);
  airborne(user, 0.0, AIR_Z);
  airborne(foe, facing * ahead, f32(AIR_Z - below));
  return contacts(s, user, foe, once(Action.attack));
}

test("Mountain King's neutral air hits a foe once and only once, the clean hit in front early in the flip and the late hit behind him, facing either way, even with the foe inside the flip for its whole window [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    const inside = airContacts(facing, 30.0, 0.0);
    assertEquals(inside.length, 1);
    assertEquals(inside[0]?.damage, NEUTRAL_AIR_CLEAN.damage);
    const behind = airContacts(facing, -50.0, 0.0);
    assertEquals(behind.length, 1);
    assertEquals(behind[0]?.damage, NEUTRAL_AIR_LATE.damage);
    assertTrue((behind[0]?.damage ?? 0.0) < (inside[0]?.damage ?? 0.0));

    const s = scene(0, [{ character: Character.mountainKing, x: 0.0, facing }, { character: Character.shadowHunter, x: facing * 50.0, facing: -facing }]);
    const user = fighter(s), foe = fighter(s, 1);
    assertEquals(contacts(s, user, foe, shortHop(s, user)).length, 1);
  }
});

test("Mountain King's neutral air is active on frames 7 to 32, strong through frame 14 and weak after, one hit window whose capsule runs from his hand to the drawn hammer head on every active frame beside a body circle [k3 measure docs/design/roster.md]", () => {
  const move = MOUNTAIN_KING_MOVES.normals[AttackStyle.neutralAir];
  assertTrue(move !== undefined);
  if (move === undefined) return;
  assertEquals(move.startupFrames, FIRST_ACTIVE - 1);
  assertEquals(move.activeFrames, LAST_ACTIVE - FIRST_ACTIVE + 1);
  assertEquals(move.totalFrames, TOTAL_FRAMES);
  assertEquals(new Set(move.regions.map(region => region.hit.window)).size, 1);
  for (let shown = FIRST_ACTIVE; shown <= LAST_ACTIVE; shown++) {
    const regions = move.regions.filter(region => region.firstFrame === shown - 1 && region.lastFrame === shown - 1);
    const hammer = NEUTRAL_AIR_HAMMER.find(drawn => drawn.frame === shown);
    assertTrue(hammer !== undefined);
    if (hammer === undefined) return;
    assertEquals(regions.length, 2);
    const effect = shown <= NEUTRAL_AIR_CLEAN_LAST ? NEUTRAL_AIR_CLEAN : NEUTRAL_AIR_LATE;
    assertTrue(regions.every(region => region.hit.effect === effect));
    assertTrue(regions.some(({ hit: { strike } }) => strike !== undefined && strike.x1 === hammer.gripX && strike.z1 === hammer.gripZ
      && strike.x2 === hammer.headX && strike.z2 === hammer.headZ && strike.radius === NEUTRAL_AIR_HEAD));
  }
  assertFalse(move.regions.some(region => region.firstFrame < FIRST_ACTIVE - 1 || region.lastFrame > LAST_ACTIVE - 1));
});

test("Mountain King's neutral air lands with 8 frames of lag and auto-cancels its landing before frame 7 and from frame 38 [k3 measure docs/design/roster.md]", () => {
  const move = MOUNTAIN_KING_MOVES.normals[AttackStyle.neutralAir];
  assertEquals(move?.landingLag, LANDING_LAG);
  const cancels = (shown: number): boolean => landsInAutoCancel(Character.mountainKing, AttackStyle.neutralAir, shown - 1, MOUNTAIN_KING_MOVES);
  assertTrue(cancels(EARLY_CANCEL_BEFORE - 1));
  assertFalse(cancels(EARLY_CANCEL_BEFORE));
  assertFalse(cancels(LATE_CANCEL_FROM - 1));
  assertTrue(cancels(LATE_CANCEL_FROM));
});
