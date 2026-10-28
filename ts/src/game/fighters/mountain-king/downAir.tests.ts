import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action } from "../../input/actions";
import { type Scene, airborne, fighter, frame, scene } from "../../match/padScene";
import { AttackStyle, Character, HitElement } from "../../sim/codes";
import type { Fighter } from "../../sim/fighter";
import { landsInAutoCancel } from "../../sim/moves";
import { DOWN_AIR, DOWN_AIR_BODY, DOWN_AIR_DRILL, MOUNTAIN_KING_MOVES, NEUTRAL_AIR_HEAD } from "./moves";

const FIRST_ACTIVE = 12;
const LAST_ACTIVE = 24;
const TOTAL_FRAMES = 46;
const LANDING_LAG = 20;
const LATE_CANCEL_FROM = 36;
const WATCH_FRAMES = 60;

function contacts(s: Scene, user: Fighter, foe: Fighter): number[] {
  const seen: number[] = [];
  let sent = false;
  for (let tick = 1; tick <= WATCH_FRAMES; tick++) {
    const before = foe.status.damage;
    frame(s, sent ? [] : [Action.cDown]);
    sent = true;
    if (foe.status.damage > before) seen.push(f32(foe.status.damage - before));
    if (user.motion.grounded && tick > 2 && user.attack.style === undefined) break;
  }
  return seen;
}

test("Mountain King's down air drills into a standing foe under him once and only once for its electric hit as he falls onto it, from 110 and 140 units up, facing either way [k1 scenario]", () => {
  for (const facing of [1, -1]) {
    for (const above of [110.0, 140.0]) {
      const s = scene(0, [{ character: Character.mountainKing, x: 0.0, facing }, { character: Character.mountainKing, x: facing * 4.0, facing: -facing }]);
      const user = fighter(s), foe = fighter(s, 1);
      airborne(user, 0.0, f32(foe.motion.z + above));
      const hits = contacts(s, user, foe);
      assertEquals(hits.length, 1);
      assertEquals(hits[0], DOWN_AIR.damage);
    }
  }
  assertEquals(DOWN_AIR.element, HitElement.electric);
  assertTrue(DOWN_AIR.electric);
});

test("Mountain King's down air is active on frames 12 to 24 in one hit window, a body capsule from his head-down crown to his raised feet and a capsule from his hand to the drawn hammer head on every active frame [k3 measure docs/design/roster.md]", () => {
  const move = MOUNTAIN_KING_MOVES.normals[AttackStyle.downAir];
  assertTrue(move !== undefined);
  if (move === undefined) return;
  assertEquals(move.startupFrames, FIRST_ACTIVE - 1);
  assertEquals(move.activeFrames, LAST_ACTIVE - FIRST_ACTIVE + 1);
  assertEquals(move.totalFrames, TOTAL_FRAMES);
  assertEquals(new Set(move.regions.map(region => region.hit.window)).size, 1);
  for (let shown = FIRST_ACTIVE; shown <= LAST_ACTIVE; shown++) {
    const regions = move.regions.filter(region => region.firstFrame === shown - 1 && region.lastFrame === shown - 1);
    const drill = DOWN_AIR_DRILL.find(drawn => drawn.frame === shown);
    assertTrue(drill !== undefined);
    if (drill === undefined) return;
    assertEquals(regions.length, 2);
    assertTrue(regions.every(region => region.hit.effect === DOWN_AIR));
    assertTrue(drill.crownZ < drill.feetZ);
    assertTrue(regions.some(({ hit: { strike } }) => strike !== undefined && strike.x1 === drill.gripX && strike.z1 === drill.gripZ
      && strike.x2 === drill.headX && strike.z2 === drill.headZ && strike.radius === NEUTRAL_AIR_HEAD));
    assertTrue(regions.some(({ hit: { strike } }) => strike !== undefined && strike.x1 === drill.crownX && strike.z1 === drill.crownZ
      && strike.x2 === drill.feetX && strike.z2 === drill.feetZ && strike.radius === DOWN_AIR_BODY));
  }
  assertFalse(move.regions.some(region => region.firstFrame < FIRST_ACTIVE - 1 || region.lastFrame > LAST_ACTIVE - 1));
});

test("Mountain King's down air lands with 20 frames of lag, never auto-cancels before its hit and auto-cancels its landing from frame 36 [k3 measure docs/design/roster.md]", () => {
  const move = MOUNTAIN_KING_MOVES.normals[AttackStyle.downAir];
  assertEquals(move?.landingLag, LANDING_LAG);
  const cancels = (shown: number): boolean => landsInAutoCancel(Character.mountainKing, AttackStyle.downAir, shown - 1, MOUNTAIN_KING_MOVES);
  assertFalse(cancels(1));
  assertFalse(cancels(FIRST_ACTIVE));
  assertFalse(cancels(LATE_CANCEL_FROM - 1));
  assertTrue(cancels(LATE_CANCEL_FROM));
});
