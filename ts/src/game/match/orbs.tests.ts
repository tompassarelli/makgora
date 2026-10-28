import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, maskOf } from "../input/actions";
import { type RowFields, inputRow } from "../input/inputRow";
import { Phase } from "../lobby/lobbyState";
import { copyFighterState } from "../../generated/state/fighterState";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { SELECTABLE_CHARACTERS } from "../roster/kits";
import { AttackStyle, Character, GroundAction, ProjectileKind, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { ULTIMATE_METER_FRAMES, fillMeter } from "../sim/meter";
import { setWorldMotionValue } from "../sim/motion";
import { fighterAt } from "../sim/roster";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { STAGE_AT_REST, floorBelow, surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight } from "../sim/stage";
import { ORB_GAIN, ORB_HEIGHT, ORB_INTERVAL_FRAMES, ORB_REACH, ORB_WARNING_FRAMES, orbPoint, orbWarned, orbWarningFrames, touchesOrb } from "../sim/orbs";
import { ORB_BURST_FRAMES, createOrbSighting, sightOrb } from "../presentation/orbLook";
import { adaptInput } from "./inputAdapter";
import { spawnOrb } from "./orbs";
import { matchSpawnX, stepMatch } from "./step";

const HOLD = 30;
const A = maskOf(Action.attack), S = maskOf(Action.special), T = maskOf(Action.leftTrigger), RIGHT = maskOf(Action.moveRight);

interface Bout {
  readonly state: ReplayState;
  readonly first: Fighter;
  readonly second: Fighter;
  tick: number;
}

function bout(orbs = true, character: Character = Character.rifleman, other: Character = Character.rifleman): Bout {
  const state = createReplaySnapshot();
  const first = fighterAt(state.world, 0);
  const second = fighterAt(state.world, 1);
  copyFighterState(first, createFighter(character, matchSpawnX(0), 1), 3);
  copyFighterState(second, createFighter(other, matchSpawnX(1), -1), 3);
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

function step(b: Bout, first: RowFields = {}): void {
  b.tick++;
  const row = inputRow(first);
  if (row === undefined) throw new Error("orb test row");
  adaptInput(row, b.first, b.tick, b.state.controls.inputs[0], b.state.controls.commands[0]);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function playTo(b: Bout, frames: number): void {
  while (played(b) < frames) step(b);
}

function place(f: Fighter, x: number, z: number): void {
  f.motion.x = x;
  f.motion.z = z;
  setWorldMotionValue(f.motion.meleeX, f.motion.x);
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}

function standAtOrb(f: Fighter, stage: number, lift = 0.0): void {
  const point = orbPoint(stage);
  place(f, point.x, f32(point.z + lift));
}

const bodyReach = (f: Readonly<Fighter>): number => f32(ORB_REACH + hurtCapsule(f.character).radius);

function liveOrb(b: Bout): void {
  playTo(b, 0);
  spawnOrb(b.state.match.orbs);
}

function watchPickup(b: Bout, frames: number, first: (frame: number) => RowFields, during: (f: Fighter) => boolean): { readonly taken: boolean; readonly takenDuring: boolean; readonly passedDuring: boolean } {
  let passedDuring = false;
  for (let frame = 0; frame < frames; frame++) {
    step(b, first(frame));
    const now = during(b.first);
    if (b.state.match.orbs.pickupSerial > 0) return { taken: true, takenDuring: now, passedDuring };
    passedDuring ||= now;
  }
  return { taken: false, takenDuring: false, passedDuring };
}

test("No meter comes from three minutes of play without orbs [k3 measure docs/design/mana.md]", () => {
  const b = bout(false);
  while (played(b) < 3 * 60 * 60) {
    step(b);
    assertEquals(b.first.meter.ultimate + b.second.meter.ultimate, 0, `played ${played(b)}`);
  }
  assertEquals(b.state.match.orbs.spawnSerial, 0);
});

test("An orb appears at 30 and 60 s, each warned 3 s ahead, and an untaken orb stays until the next replaces it [k3 measure docs/design/mana.md]", () => {
  const b = bout();
  assertFalse(touchesOrb(b.first, orbPoint(0)));
  assertFalse(touchesOrb(b.second, orbPoint(0)));
  const spawns: number[] = [];
  let serial = 0;
  let warnedAt = -1;
  while (played(b) < 2 * ORB_INTERVAL_FRAMES) {
    step(b);
    if (warnedAt < 0 && orbWarningFrames(b.state.match) !== undefined) warnedAt = played(b);
    if (b.state.match.orbs.spawnSerial !== serial) {
      serial = b.state.match.orbs.spawnSerial;
      spawns.push(played(b));
    }
  }
  assertEquals(ORB_INTERVAL_FRAMES, 1800);
  assertEquals(warnedAt, ORB_INTERVAL_FRAMES - ORB_WARNING_FRAMES);
  assertEquals(spawns.join(" "), "1800 3600");
  assertTrue(b.state.match.orbs.live);
  assertEquals(b.state.match.orbs.pickupSerial, 0);
});

test("A spawn waits while a player respawns and comes on the frame their respawn invincibility ends [k1 scenario]", () => {
  const b = bout();
  playTo(b, ORB_INTERVAL_FRAMES - 50);
  b.second.status.out = true;
  b.second.status.respawn = 120;
  playTo(b, ORB_INTERVAL_FRAMES);
  assertTrue(b.state.match.orbs.held);
  assertEquals(b.state.match.orbs.spawnSerial, 0);
  assertTrue(orbWarned(b.state.match));
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
  assertTrue(b.state.match.orbs.live);
  assertFalse(b.state.match.orbs.held);
});

test("Every fighter's body under the orb touches it, the shortest and tallest included, as does a jump through it; a step past the reach misses [k1 scenario]", () => {
  let shortest: Character = Character.rifleman, tallest: Character = Character.rifleman;
  const top = (character: Character): number => f32(hurtCapsule(character).z2 + hurtCapsule(character).radius);
  for (const character of SELECTABLE_CHARACTERS) {
    if (top(character) < top(shortest)) shortest = character;
    if (top(character) > top(tallest)) tallest = character;
  }
  assertEquals(shortest, Character.murloc);
  assertEquals(tallest, Character.archimonde);
  for (const stage of STAGE_CATALOG.map(info => info.id)) {
    for (const character of SELECTABLE_CHARACTERS) {
      const f = createFighter(character, 0.0, 1);
      standAtOrb(f, stage);
      assertEquals(touchesOrb(f, orbPoint(stage)), true, `${character} standing on stage ${stage}`);
      standAtOrb(f, stage, f32(ORB_HEIGHT * 2.0));
      assertEquals(touchesOrb(f, orbPoint(stage)), true, `${character} jumping on stage ${stage}`);
      standAtOrb(f, stage);
      f.motion.x = f32(orbPoint(stage).x + bodyReach(f) + 1.0);
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

function jabReach(character: Character): number | undefined {
  const f = createFighter(character, 0.0, 1);
  const point = orbPoint(0);
  for (let gap = Math.ceil(bodyReach(f)) + 1; gap < 200; gap++) {
    place(f, f32(point.x - gap), point.z);
    f.attack.style = undefined;
    if (touchesOrb(f, point)) continue;
    f.attack.style = AttackStyle.jab;
    for (let frame = 0; frame < 20; frame++) {
      f.attack.frame = frame;
      if (touchesOrb(f, point)) return gap;
    }
  }
  return undefined;
}

test("A jab whose hitbox reaches the orb collects it and adds half a meter, from a spot where the body does not touch it [k1 scenario]", () => {
  const gap = jabReach(Character.blademaster);
  assertTrue(gap !== undefined);
  if (gap === undefined) return;
  const b = bout(true, Character.blademaster);
  liveOrb(b);
  place(b.first, f32(orbPoint(0).x - gap), orbPoint(0).z);
  b.first.facing = 1;
  for (let frame = 0; frame < 10; frame++) step(b);
  assertEquals(b.state.match.orbs.pickupSerial, 0, "standing beside it takes nothing");
  const jab = watchPickup(b, 30, frame => frame === 0 ? { held: A, pressed: A } : {}, f => f.attack.style === AttackStyle.jab);
  assertTrue(jab.taken);
  assertTrue(jab.takenDuring);
  assertEquals(b.state.match.orbs.lastTaker, 0);
  assertEquals(b.first.meter.ultimate, ORB_GAIN);
  assertEquals(ORB_GAIN, ULTIMATE_METER_FRAMES / 2);
  assertFalse(b.state.match.orbs.live);
});

test("Running into the orb collects it, and two orbs make a full meter; one taken into a full meter is wasted [k1 scenario]", () => {
  const b = bout();
  liveOrb(b);
  place(b.first, f32(orbPoint(0).x - 400.0), orbPoint(0).z);
  b.first.facing = 1;
  const run = watchPickup(b, 120, () => ({ held: RIGHT, axisX: 127 }), f => f.ground.action === GroundAction.run || f.ground.action === GroundAction.dash);
  assertTrue(run.taken);
  assertTrue(run.takenDuring);
  assertEquals(b.first.meter.ultimate, ORB_GAIN);
  spawnOrb(b.state.match.orbs);
  step(b);
  assertEquals(b.state.match.orbs.pickupSerial, 2);
  assertEquals(b.first.meter.ultimate, ULTIMATE_METER_FRAMES);
  assertFalse(b.state.match.orbs.lastWasted);
  spawnOrb(b.state.match.orbs);
  step(b);
  assertEquals(b.state.match.orbs.pickupSerial, 3);
  assertTrue(b.state.match.orbs.lastWasted);
  assertEquals(b.first.meter.ultimate, ULTIMATE_METER_FRAMES);
});

test("A special passes through the orb, and the orb is taken once the special ends [k1 scenario]", () => {
  const b = bout();
  playTo(b, 0);
  standAtOrb(b.first, 0);
  step(b, { held: S, pressed: S });
  assertTrue(b.first.special.action !== SpecialAction.none);
  spawnOrb(b.state.match.orbs);
  const cast = watchPickup(b, 120, () => ({}), f => f.special.action !== SpecialAction.none);
  assertTrue(cast.passedDuring);
  assertTrue(cast.taken);
  assertFalse(cast.takenDuring);
});

test("An air dodge passes through the orb, and the orb is taken once the dodge ends [k1 scenario]", () => {
  const b = bout();
  playTo(b, 0);
  standAtOrb(b.first, 0, f32(ORB_HEIGHT * 2.0));
  b.first.motion.grounded = false;
  b.first.motion.vz = 0.0;
  step(b, { held: T, pressed: T });
  assertTrue(b.first.dodge.airDodging);
  spawnOrb(b.state.match.orbs);
  const dodge = watchPickup(b, 120, () => ({}), f => f.dodge.airDodging);
  assertTrue(dodge.passedDuring);
  assertTrue(dodge.taken);
  assertFalse(dodge.takenDuring);
});

test("An ultimate passes through the orb, and the orb is taken once the ultimate ends [k1 scenario]", () => {
  const b = bout();
  playTo(b, 0);
  standAtOrb(b.first, 0);
  fillMeter(b.first);
  step(b, { held: A, pressed: A });
  step(b, { held: A | S, pressed: S });
  assertEquals(b.first.special.action, SpecialAction.heroUltimate);
  assertEquals(b.first.meter.ultimate, 0);
  spawnOrb(b.state.match.orbs);
  const ultimate = watchPickup(b, 240, () => ({}), f => f.special.action === SpecialAction.heroUltimate);
  assertTrue(ultimate.passedDuring);
  assertTrue(ultimate.taken);
  assertFalse(ultimate.takenDuring);
  assertEquals(b.first.meter.ultimate, ORB_GAIN);
});

test("A projectile flying through the orb never collects it [k1 scenario]", () => {
  const b = bout();
  liveOrb(b);
  place(b.first, f32(orbPoint(0).x - 300.0), orbPoint(0).z);
  b.first.facing = 1;
  step(b, { held: S, pressed: S });
  let crossed = false;
  for (let frame = 0; frame < 60; frame++) {
    step(b);
    for (const shot of b.first.projectiles) if (shot.life > 0 && shot.kind === ProjectileKind.blaster && Math.abs(f32(shot.x - orbPoint(0).x)) <= ORB_REACH) crossed = true;
  }
  assertTrue(crossed);
  assertEquals(b.state.match.orbs.pickupSerial, 0);
  assertTrue(b.state.match.orbs.live);
});

test("Two fighters touching the orb on the same frame: the nearer centre takes it, and an exact tie goes to the lower slot [k1 scenario]", () => {
  const point = orbPoint(0);
  const tie = bout();
  liveOrb(tie);
  place(tie.first, f32(point.x - 10.0), point.z);
  place(tie.second, f32(point.x + 10.0), point.z);
  step(tie);
  assertEquals(tie.state.match.orbs.pickupSerial, 1);
  assertEquals(tie.state.match.orbs.lastTaker, 0);
  assertEquals(tie.first.meter.ultimate, ORB_GAIN);
  assertEquals(tie.second.meter.ultimate, 0);
  const nearer = bout();
  liveOrb(nearer);
  place(nearer.first, f32(point.x - 10.0), point.z);
  place(nearer.second, f32(point.x + 4.0), point.z);
  step(nearer);
  assertEquals(nearer.state.match.orbs.lastTaker, 1);
  assertEquals(nearer.first.meter.ultimate, 0);
  assertEquals(nearer.second.meter.ultimate, ORB_GAIN);
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
  assertEquals(replayed.first.meter.ultimate, ORB_GAIN);
  assertEquals(replayed.first.meter.ultimate, straight.first.meter.ultimate);
});

test("An orb taken on the frame it spawns is still seen: it bursts at centre, and a live orb shows until taken [k1 scenario]", () => {
  const b = bout();
  const seen = createOrbSighting();
  playTo(b, ORB_INTERVAL_FRAMES - 1);
  sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
  assertFalse(seen.shown);
  standAtOrb(b.first, 0);
  step(b);
  assertFalse(b.state.match.orbs.live);
  assertEquals(b.state.match.orbs.pickupSerial, 1);
  const shown: string[] = [];
  for (let frame = 0; frame <= ORB_BURST_FRAMES; frame++) {
    sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
    shown.push(`${seen.shown}${seen.bursting ? "b" : ""}`);
    place(b.first, f32(orbPoint(0).x + 400.0), b.first.motion.z);
    step(b);
  }
  assertEquals(shown.filter(entry => entry === "trueb").length, ORB_BURST_FRAMES);
  assertEquals(shown[ORB_BURST_FRAMES], "false");
  place(b.second, f32(orbPoint(0).x + 400.0), b.second.motion.z);
  playTo(b, 2 * ORB_INTERVAL_FRAMES);
  sightOrb(seen, b.state.match.orbs, b.state.match.matchFrame);
  assertTrue(b.state.match.orbs.live);
  assertEquals(`${seen.shown}${seen.bursting ? "b" : ""}`, "true");
});
