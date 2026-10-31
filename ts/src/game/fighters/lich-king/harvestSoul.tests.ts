import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { firstStateDifference } from "../../replay/difference";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { beginFighterAttack } from "../../sim/attacks";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
import { createFighter, type Fighter, mutablePlacedObject } from "../../sim/fighter";
import { type Controls, copyControls, fighterAt, setRosterMask } from "../../sim/roster";
import { stageBounds } from "../../sim/stageBounds";
import { controls } from "../../sim/testWorld";
import { GHOUL_PLACEMENT, GHOUL_RISE_FRAME, SOUL_CHARGE } from "./specials";

const KING_X = -300.0;
const FAR_FOE_X = 600.0;
const HOLD = controls({ specialHeld: true, verticalDirection: -1, down: true });
const PRESS = controls({ specialPressed: true, specialHeld: true, specialZ: -1, verticalDirection: -1, down: true });
const FULL_CHANNEL = SOUL_CHARGE.hold + SOUL_CHARGE.full;

interface Bout {
  readonly state: ReplayState;
  readonly king: Fighter;
  readonly foe: Fighter;
  tick: number;
  foeInput: Controls;
}

function bout(foeX = FAR_FOE_X, third?: number): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.lichKing, KING_X, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  if (third !== undefined) {
    copyFighterState(fighterAt(state.world, 2), createFighter(Character.rifleman, third, -1), 3);
    setRosterMask(state.world, 7);
  }
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 360;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  const b: Bout = { state, king: fighterAt(state.world, 0), foe: fighterAt(state.world, 1), tick: 0, foeInput: controls() };
  for (let frame = 0; frame < 8; frame++) step(b);
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], b.foeInput);
  copyControls(b.state.controls.inputs[2], controls());
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function channel(b: Bout, frames: number): void {
  step(b, PRESS);
  for (let n = 1; n < frames; n++) step(b, HOLD);
}

function raise(b: Bout): void {
  b.king.special.charge = SOUL_CHARGE.full;
  step(b, PRESS);
  for (let n = 0; n < 50; n++) step(b);
}

test("Harvest Soul: holding down special tethers the foe from across the stage and banks one soul a frame from frame 15, filling the meter in 180 frames [k3 measure docs/design/roster.md]", () => {
  const b = bout();
  channel(b, SOUL_CHARGE.hold + 1);
  assertEquals(b.king.special.action, SpecialAction.heroDown);
  assertEquals(b.king.special.charge, 1);
  assertEquals(b.king.special.seekTarget, 2);
  for (let n = 0; n < 59; n++) step(b, HOLD);
  assertEquals(b.king.special.charge, 60);
  for (let n = 0; n < FULL_CHANNEL; n++) step(b, HOLD);
  assertEquals(b.king.special.charge, SOUL_CHARGE.full);
  assertEquals(SOUL_CHARGE.full, 180);
  assertEquals(b.king.special.action, SpecialAction.none);
});

test("Harvest Soul: releasing the button ends the channel and keeps the souls; the next hold carries on from there [k1 scenario]", () => {
  const b = bout();
  channel(b, SOUL_CHARGE.hold + 40);
  assertEquals(b.king.special.charge, 40);
  for (let n = 0; n < 30; n++) step(b);
  assertEquals(b.king.special.action, SpecialAction.none);
  assertEquals(b.king.special.charge, 40);
  channel(b, SOUL_CHARGE.hold + 10);
  assertEquals(b.king.special.charge, 50);
});

test("Harvest Soul: a hit breaks the channel but he keeps every soul drained so far [k1 scenario]", () => {
  const b = bout(KING_X + 90.0);
  channel(b, SOUL_CHARGE.hold + 30);
  assertEquals(b.king.special.charge, 30);
  beginFighterAttack(b.state.world, 1, AttackStyle.forwardTilt, false);
  for (let n = 0; n < 20 && b.king.launch.hitstun === 0; n++) step(b, HOLD);
  assertGreaterThan(b.king.launch.hitstun, 0);
  assertEquals(b.king.special.action, SpecialAction.none);
  const kept = b.king.special.charge;
  assertGreaterThan(kept, 29);
  for (let n = 0; n < 30; n++) step(b, HOLD);
  assertEquals(b.king.special.charge, kept);
});

test("Harvest Soul: a foe that is intangible or respawning cannot be tethered, so nothing is banked [k1 scenario]", () => {
  const b = bout();
  channel(b, SOUL_CHARGE.hold);
  for (let n = 0; n < 30; n++) {
    b.foe.status.invincible = 10;
    step(b, HOLD);
  }
  assertEquals(b.king.special.charge, 0);
  assertEquals(b.king.special.seekTarget, 0);
  assertEquals(b.king.special.action, SpecialAction.heroDown);
});

test("Harvest Soul with three fighters tethers the nearest foe and moves to the other when it cannot be tethered [k1 scenario]", () => {
  const b = bout(FAR_FOE_X, KING_X + 250.0);
  channel(b, SOUL_CHARGE.hold + 1);
  assertEquals(b.king.special.seekTarget, 3);
  fighterAt(b.state.world, 2).status.invincible = 30;
  step(b, HOLD);
  assertEquals(b.king.special.seekTarget, 2);
  assertEquals(b.king.special.charge, 2);
});

test("Raise Ghoul: down special at a full meter spends it and a Ghoul rises 0.55H ahead on frame 18 [k1 scenario]", () => {
  const b = bout();
  b.king.special.charge = SOUL_CHARGE.full;
  step(b, PRESS);
  assertEquals(b.king.special.charge, 0);
  for (let n = 1; n < GHOUL_RISE_FRAME; n++) {
    assertEquals(b.king.placed.life, 0);
    step(b);
  }
  assertGreaterThan(b.king.placed.life, 0);
  assertEquals(b.king.placed.spec, GHOUL_PLACEMENT);
  assertEquals(b.king.placed.percent, 0.0);
});

test("Raise Ghoul: only one at a time; while it stands, down special does nothing and banks nothing [k1 scenario]", () => {
  const b = bout();
  raise(b);
  assertGreaterThan(b.king.placed.life, 0);
  const serial = b.king.placed.serial;
  step(b, PRESS);
  for (let n = 0; n < 40; n++) step(b, HOLD);
  assertEquals(b.king.special.action, SpecialAction.none);
  assertEquals(b.king.special.charge, 0);
  assertEquals(b.king.placed.serial, serial);
});

test("The Ghoul walks to the foe and claws it for 4 percent [k1 scenario]", () => {
  const b = bout(KING_X + 400.0);
  raise(b);
  let clawed = 0;
  for (let n = 0; n < 240 && clawed === 0; n++) {
    step(b);
    if (b.foe.status.damage > 0.0) clawed = n;
  }
  assertGreaterThan(clawed, 0);
  assertEquals(b.foe.status.damage, 4.0);
  assertGreaterThan(b.king.placed.life, 0);
});

test("The Ghoul takes percent and knockback from a foe's strike, and more percent launches it farther [k1 scenario]", () => {
  const launched = (percent: number): number => {
    const b = bout(KING_X + 400.0);
    raise(b);
    const ghoul = mutablePlacedObject(b.king);
    ghoul.percent = percent;
    b.foe.facing = ghoul.x < b.foe.motion.x ? -1 : 1;
    b.foe.motion.x = f32(ghoul.x - f32(b.foe.facing * 70.0));
    b.foe.motion.vx = 0.0;
    beginFighterAttack(b.state.world, 1, AttackStyle.forwardTilt, false);
    let struck = false;
    for (let n = 0; n < 30 && !struck; n++) {
      step(b);
      struck = ghoul.percent > percent;
    }
    assertTrue(struck);
    assertGreaterThan(ghoul.hitstun, 0);
    return Math.abs(ghoul.velocityX) + Math.abs(ghoul.velocityZ);
  };
  const fresh = launched(0.0);
  assertGreaterThan(fresh, 0.0);
  assertGreaterThan(launched(120.0), fresh);
});

test("The Ghoul dies only past the blast zone, like a fighter, and the king may raise another [k1 scenario]", () => {
  const b = bout();
  raise(b);
  const ghoul = mutablePlacedObject(b.king);
  for (let n = 0; n < 600; n++) step(b);
  assertGreaterThan(ghoul.life, 0);
  ghoul.surface = undefined;
  ghoul.velocityX = 60.0;
  ghoul.velocityZ = 10.0;
  ghoul.hitstun = 60;
  let frames = 0;
  while (ghoul.life > 0 && frames < 120) {
    step(b);
    frames++;
  }
  assertEquals(ghoul.life, 0);
  assertGreaterThan(ghoul.x, stageBounds(0).blast.right);
  b.king.special.charge = SOUL_CHARGE.full;
  step(b, PRESS);
  assertEquals(b.king.special.action, SpecialAction.heroDown);
});

test("The Ghoul and the banked souls go when the king loses a stock [k1 scenario]", () => {
  const b = bout();
  raise(b);
  b.king.special.charge = 90;
  assertGreaterThan(b.king.placed.life, 0);
  const stocks = b.king.status.stocks;
  b.king.motion.grounded = false;
  b.king.motion.surface = undefined;
  b.king.motion.x = f32(stageBounds(0).blast.left - 50.0);
  step(b);
  assertLessThan(b.king.status.stocks, stocks);
  assertEquals(b.king.placed.life, 0);
  assertEquals(b.king.special.charge, 0);
});

test("Harvest Soul and the Ghoul roll back: a snapshot taken with the Ghoul out, restored after a branch where the foe launched it, replays to the same state as the straight run [k1 scenario]", () => {
  const straight = bout(KING_X + 400.0);
  const replayed = bout(KING_X + 400.0);
  for (const b of [straight, replayed]) {
    b.king.special.charge = SOUL_CHARGE.full - 20;
    channel(b, SOUL_CHARGE.hold + 30);
    for (let n = 0; n < 5; n++) step(b);
    raise(b);
  }
  const saved = createReplaySnapshot();
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  const ghoul = replayed.king.placed;
  replayed.foe.facing = ghoul.x < replayed.foe.motion.x ? -1 : 1;
  replayed.foe.motion.x = f32(ghoul.x - f32(replayed.foe.facing * 70.0));
  beginFighterAttack(replayed.state.world, 1, AttackStyle.forwardTilt, false);
  for (let n = 0; n < 12; n++) step(replayed, HOLD);
  assertGreaterThan(replayed.king.placed.percent, 0.0);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  for (let n = 0; n < 200; n++) {
    step(straight);
    step(replayed);
  }
  assertGreaterThan(straight.king.placed.life, 0);
  assertGreaterThan(straight.foe.status.damage, 0.0);
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
});
