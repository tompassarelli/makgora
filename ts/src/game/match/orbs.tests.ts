import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../lobby/lobbyState";
import { copyFighterState } from "../../generated/state/fighterState";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { Character } from "../sim/codes";
import { enterExSpecial } from "../sim/exSpecials";
import { type Fighter, createFighter } from "../sim/fighter";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { METER, exCharged, fillEx, regenerateMeter, spendEx, ultimateCharged } from "../sim/meter";
import { setWorldMotionValue } from "../sim/motion";
import { fighterAt } from "../sim/roster";
import { startUltimate } from "../sim/specials";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { STAGE_AT_REST, floorBelow, surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight } from "../sim/stage";
import { controls } from "../sim/testWorld";
import {
  ORB_HEIGHT, ORB_INTERVAL_FRAMES, ORB_REACH, ORB_WARNING_FRAMES, ULTIMATE_ORB_GAIN, orbPoint, orbWarningFrames, scheduledOrb, touchesOrb, warnedOrb,
} from "../sim/orbs";
import { OrbKind } from "../sim/orbState";
import { ORB_BURST_FRAMES, createOrbSighting, sightOrb } from "../presentation/orbLook";
import { matchSpawnX, stepMatch } from "./step";

const HOLD = 30;

interface Bout {
  readonly state: ReplayState;
  readonly first: Fighter;
  readonly second: Fighter;
  tick: number;
}

function bout(orbs = true): Bout {
  const state = createReplaySnapshot();
  const first = fighterAt(state.world, 0);
  const second = fighterAt(state.world, 1);
  copyFighterState(first, createFighter(Character.rifleman, matchSpawnX(0), 1), 3);
  copyFighterState(second, createFighter(Character.rifleman, matchSpawnX(1), -1), 3);
  const { match } = state;
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.startHold = HOLD;
  match.orbs.on = orbs;
  return { state, first, second, tick: 0 };
}

const played = (b: Bout): number => b.state.match.matchFrame - b.state.match.startHold;

function step(b: Bout): void {
  b.tick++;
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function playTo(b: Bout, frames: number): void {
  while (played(b) < frames) step(b);
}

function standAtOrb(f: Fighter, stage: number, lift = 0.0): void {
  const point = orbPoint(stage);
  f.motion.x = point.x;
  f.motion.z = f32(point.z + lift);
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}

test("EX regenerates to one charge 720 frames after GO, the ultimate meter fills in 7200, and neither builds in the start hold [k3 measure docs/design/mana.md]", () => {
  const b = bout(false);
  playTo(b, 0);
  assertEquals(b.first.meter.ex, 0);
  assertEquals(b.first.meter.ultimate, 0);
  playTo(b, METER.exFrames - 1);
  assertFalse(exCharged(b.first));
  playTo(b, METER.exFrames);
  assertTrue(exCharged(b.first));
  assertTrue(exCharged(b.second));
  assertEquals(b.first.meter.ultimate, METER.exFrames);
  const lone = createFighter(Character.rifleman, 0.0, 1);
  for (let frame = 1; frame < METER.ultimateFrames; frame++) regenerateMeter(lone);
  assertFalse(ultimateCharged(lone));
  regenerateMeter(lone);
  assertTrue(ultimateCharged(lone));
});

test("Regen pauses while a meter is full and restarts from empty when the EX charge is spent [k1 scenario]", () => {
  const f = createFighter(Character.rifleman, 0.0, 1);
  fillEx(f);
  for (let frame = 0; frame < 300; frame++) regenerateMeter(f);
  assertEquals(f.meter.ex, METER.exFrames);
  spendEx(f);
  for (let frame = 1; frame < METER.exFrames; frame++) regenerateMeter(f);
  assertFalse(exCharged(f));
  regenerateMeter(f);
  assertTrue(exCharged(f));
  f.meter.ultimate = METER.ultimateFrames;
  regenerateMeter(f);
  assertEquals(f.meter.ultimate, METER.ultimateFrames);
});

test("Orbs follow the minute: EX orbs at 15, 30 and 45 s, an ultimate orb on the minute in their place, each warned 3 s ahead and replacing an untaken one [k3 measure docs/design/mana.md]", () => {
  assertEquals([1, 2, 3, 4, 5, 6, 7, 8].map(index => scheduledOrb(index)).join(","), [OrbKind.ex, OrbKind.ex, OrbKind.ex, OrbKind.ultimate, OrbKind.ex, OrbKind.ex, OrbKind.ex, OrbKind.ultimate].join(","));
  const b = bout();
  assertFalse(touchesOrb(b.first, orbPoint(0)));
  assertFalse(touchesOrb(b.second, orbPoint(0)));
  const spawns: string[] = [];
  let serial = 0;
  let warnedAt = -1;
  while (played(b) < 4 * ORB_INTERVAL_FRAMES) {
    step(b);
    if (warnedAt < 0 && orbWarningFrames(b.state.match) !== undefined) warnedAt = played(b);
    if (b.state.match.orbs.spawnSerial !== serial) {
      serial = b.state.match.orbs.spawnSerial;
      spawns.push(`${played(b)}:${b.state.match.orbs.live}`);
    }
  }
  assertEquals(warnedAt, ORB_INTERVAL_FRAMES - ORB_WARNING_FRAMES);
  assertEquals(spawns.join(" "), [`900:${OrbKind.ex}`, `1800:${OrbKind.ex}`, `2700:${OrbKind.ex}`, `3600:${OrbKind.ultimate}`].join(" "));
  assertEquals(b.state.match.orbs.pickupSerial, 0);
});

test("A spawn waits while a player respawns and comes on the frame their respawn invincibility ends [k1 scenario]", () => {
  const b = bout();
  playTo(b, ORB_INTERVAL_FRAMES - 50);
  b.second.status.out = true;
  b.second.status.respawn = 120;
  playTo(b, ORB_INTERVAL_FRAMES);
  assertEquals(b.state.match.orbs.held, OrbKind.ex);
  assertEquals(b.state.match.orbs.spawnSerial, 0);
  assertEquals(warnedOrb(b.state.match), OrbKind.ex);
  let protectedBefore = false;
  while (b.state.match.orbs.spawnSerial === 0 && played(b) < 2 * ORB_INTERVAL_FRAMES) {
    protectedBefore = b.second.status.out || b.second.status.invincible > 0;
    step(b);
  }
  assertEquals(b.state.match.orbs.spawnSerial, 1);
  assertTrue(protectedBefore);
  assertFalse(b.second.status.out);
  assertEquals(b.second.status.invincible, 0);
  assertTrue(played(b) > ORB_INTERVAL_FRAMES + 120);
  assertEquals(b.state.match.orbs.live, OrbKind.ex);
  assertEquals(b.state.match.orbs.held, OrbKind.none);
});

test("Every fighter standing under the orb reaches it, the shortest and tallest included, as does a jump through it; a step past the reach misses [k1 scenario]", () => {
  let shortest: Character = Character.rifleman, tallest: Character = Character.rifleman;
  const top = (character: Character): number => f32(hurtCapsule(character).z2 + hurtCapsule(character).radius);
  for (const character of SELECTABLE_CHARACTERS) {
    if (top(character) < top(shortest)) shortest = character;
    if (top(character) > top(tallest)) tallest = character;
  }
  assertEquals(shortest, Character.kobold);
  assertEquals(tallest, Character.demonHunter);
  for (const stage of STAGE_CATALOG.map(info => info.id)) {
    for (const character of SELECTABLE_CHARACTERS) {
      const f = createFighter(character, 0.0, 1);
      standAtOrb(f, stage);
      assertEquals(touchesOrb(f, orbPoint(stage)), true, `${character} standing on stage ${stage}`);
      standAtOrb(f, stage, f32(ORB_HEIGHT * 2.0));
      assertEquals(touchesOrb(f, orbPoint(stage)), true, `${character} jumping on stage ${stage}`);
      standAtOrb(f, stage);
      f.motion.x = f32(orbPoint(stage).x + f32(ORB_REACH + hurtCapsule(character).radius) + 1.0);
      assertEquals(touchesOrb(f, orbPoint(stage)), false, `${character} beside the orb on stage ${stage}`);
    }
  }
});

test("The orb sits over solid, fixed ground at the deck point nearest centre on every stage [k1 scenario]", () => {
  for (const stage of STAGE_CATALOG.map(info => info.id)) {
    const point = orbPoint(stage);
    let onDeck = false;
    for (let index = 0; index < surfaceCount(stage); index++) {
      if (surfaceMoves(stage, index) || surfacePass(stage, index)) continue;
      if (point.x >= surfaceLeft(stage, index, STAGE_AT_REST) && point.x <= surfaceRight(stage, index, STAGE_AT_REST)) onDeck = true;
    }
    assertEquals(onDeck, true, `stage ${stage} orb at ${point.x}`);
    assertEquals(floorBelow(stage, STAGE_AT_REST, point.x, f32(point.z + ORB_HEIGHT)), point.z, `stage ${stage} orb floor`);
  }
});

test("An EX orb fills the EX charge, an ultimate orb half the ultimate meter, neither touches the other meter, and a pickup into a full meter is wasted [k1 scenario]", () => {
  const b = bout();
  playTo(b, ORB_INTERVAL_FRAMES - 1);
  b.first.meter.ex = 100;
  const ultimate = b.first.meter.ultimate;
  standAtOrb(b.first, 0);
  step(b);
  assertEquals(b.state.match.orbs.pickupSerial, 1);
  assertEquals(b.state.match.orbs.lastTaker, 0);
  assertFalse(b.state.match.orbs.lastWasted);
  assertTrue(exCharged(b.first));
  assertEquals(b.first.meter.ultimate, ultimate + 1);
  playTo(b, 2 * ORB_INTERVAL_FRAMES - 1);
  step(b);
  assertEquals(b.state.match.orbs.pickupSerial, 2);
  assertTrue(b.state.match.orbs.lastWasted);
  assertTrue(exCharged(b.first));
  playTo(b, 4 * ORB_INTERVAL_FRAMES - 1);
  b.first.meter.ex = 0;
  const before = b.first.meter.ultimate;
  step(b);
  assertEquals(b.state.match.orbs.lastKind, OrbKind.ultimate);
  assertEquals(b.first.meter.ultimate, Math.min(METER.ultimateFrames, before + 1 + ULTIMATE_ORB_GAIN));
  assertEquals(b.first.meter.ex, 1);
});

test("Spending EX leaves the ultimate meter and spending the ultimate leaves the EX charge [k1 scenario]", () => {
  const ex = createFighter(Character.blademaster, 0.0, 1);
  fillEx(ex);
  ex.meter.ultimate = 1234;
  enterExSpecial(ex, controls({ specialPressed: true, exPressed: true }));
  assertTrue(ex.special.ex);
  assertEquals(ex.meter.ex, 0);
  assertEquals(ex.meter.ultimate, 1234);
  const b = bout(false);
  copyFighterState(b.first, createFighter(Character.blademaster, matchSpawnX(0), 1), 3);
  playTo(b, 60);
  b.first.meter.ultimate = METER.ultimateFrames;
  b.first.meter.ex = 300;
  assertTrue(startUltimate(b.first, controls({ ultimatePressed: true, specialPressed: true, attackPressed: true }), 0, b.state.match.matchFrame));
  assertEquals(b.first.meter.ultimate, 0);
  assertEquals(b.first.meter.ex, 300);
});

test("Meters and orbs roll back and replay to the same state across a spawn and a pickup [k1 scenario]", () => {
  const straight = bout();
  const replayed = bout();
  const saved = createReplaySnapshot();
  playTo(straight, ORB_INTERVAL_FRAMES - 40);
  playTo(replayed, ORB_INTERVAL_FRAMES - 40);
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  standAtOrb(replayed.first, 0);
  playTo(replayed, ORB_INTERVAL_FRAMES + 20);
  assertEquals(replayed.state.match.orbs.pickupSerial, 1);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  standAtOrb(straight.first, 0);
  standAtOrb(replayed.first, 0);
  playTo(straight, ORB_INTERVAL_FRAMES + 20);
  playTo(replayed, ORB_INTERVAL_FRAMES + 20);
  assertEquals(straight.state.match.orbs.pickupSerial, 1);
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
  assertEquals(replayed.first.meter.ex, straight.first.meter.ex);
  assertEquals(replayed.first.meter.ultimate, straight.first.meter.ultimate);
});

test("An orb taken on the frame it spawns is still seen: it bursts at centre, and a live orb shows until taken [k1 scenario]", () => {
  const b = bout();
  const seen = createOrbSighting();
  playTo(b, ORB_INTERVAL_FRAMES - 1);
  sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
  assertEquals(seen.shown, OrbKind.none);
  standAtOrb(b.first, 0);
  step(b);
  assertEquals(b.state.match.orbs.live, OrbKind.none);
  assertEquals(b.state.match.orbs.pickupSerial, 1);
  const shown: string[] = [];
  for (let frame = 0; frame <= ORB_BURST_FRAMES; frame++) {
    sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
    shown.push(`${seen.shown}${seen.bursting ? "b" : ""}`);
    b.first.motion.x = f32(orbPoint(0).x + 400.0);
    setWorldMotionValue(b.first.motion.meleeX, b.first.motion.x);
    step(b);
  }
  assertEquals(shown.filter(entry => entry === `${OrbKind.ex}b`).length, ORB_BURST_FRAMES);
  assertEquals(shown[ORB_BURST_FRAMES], `${OrbKind.none}`);
  b.second.motion.x = f32(orbPoint(0).x + 400.0);
  setWorldMotionValue(b.second.motion.meleeX, b.second.motion.x);
  playTo(b, 2 * ORB_INTERVAL_FRAMES);
  sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
  assertEquals(b.state.match.orbs.live, OrbKind.ex);
  assertEquals(`${seen.shown}${seen.bursting ? "b" : ""}`, `${OrbKind.ex}`);
});
