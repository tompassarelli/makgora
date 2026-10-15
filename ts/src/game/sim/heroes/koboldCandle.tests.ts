import { f32 } from "wisp/src/sim/f32";
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, CandleState, Character, ContactKind, SpecialAction } from "../codes";
import { beginFighterAttack } from "../attacks";
import { collectDamageContact } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { runningHeroSpecial } from "../specials/engine";
import { type Controls, type Roster, createRoster, fighterAt } from "../roster";
import { mainDeckRight, mainDeckZAt, surfaceLeft, surfaceRight, surfaceZAt } from "../stage";
import { duelPair, stepDuel } from "../testDuel";
import { contactBatch, controls, hitEffect } from "../testWorld";
import { Phase } from "../../lobby/lobbyState";
import { stepMatch } from "../../match/step";
import { firstFighterDifference } from "../../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { max } from "../../core/numbers";
import { CANDLE_DROP_KNOCKBACK, CANDLE_GUARD_FRAMES, CANDLE_HEAT_PER_DAMAGE, CANDLE_LEVEL_HEAT, CANDLE_UNTOUCHED_FRAMES, CANDLE_AWAY_FRAMES, CANDLE_KICK_SPEED, advanceCandleBodies, candleLevel } from "./koboldCandle";

test("Kobold's candle gains 8 heat per whole percent he lands, at most 75 a hit, burns down 1 every third frame and goes out with his stock [k3 measure docs/design/roster.md]", () => {
  const state = { ...createReplaySnapshot(), world: createRoster(3, [createFighter(Character.kobold, -100.0, 1), createFighter(Character.rifleman, 100.0, -1)]) };
  state.match.phase = Phase.match;
  state.match.humanMask = 3;
  state.match.humanFighterMask = 3;
  state.match.practice = true;
  const { world } = state;
  const kobold = fighterAt(world, 0);
  const land = (damage: number, growth: number, base: number) => contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(damage, growth, base, 1.0, 1.0), 1, ContactKind.launch, true, undefined, false));
  land(9.0, 63.0, 18.0);
  assertEquals(kobold.candle.heat, 72);
  assertEquals(candleLevel(kobold), 0);
  land(18.0, 104.0, 26.0);
  assertEquals(kobold.candle.heat, 147);
  assertEquals(candleLevel(kobold), 1);
  land(2.0, 50.0, 20.0);
  assertEquals(kobold.candle.heat, 163);
  assertEquals(candleLevel(kobold), 2);
  for (let frame = 1; frame <= 300; frame++) stepMatch(state.match, world, state.controls, frame);
  assertEquals(kobold.candle.heat, 63);
  kobold.motion.x = -100000.0;
  stepMatch(state.match, world, state.controls, 301);
  assertTrue(kobold.status.out);
  assertEquals(kobold.candle.heat, 0);
});

function litKobold(level: number, gap: number, input: Readonly<Controls>): { world: ReturnType<typeof createRoster>; kobold: Fighter; target: Fighter; startX: number } {
  const { world, owner, target } = duelPair(createFighter(Character.kobold, -400.0, 1), createFighter(Character.rifleman, -400.0 + gap, -1));
  owner.candle.heat = level * CANDLE_LEVEL_HEAT;
  const startX = owner.motion.x;
  stepDuel(world, input);
  return { world, kobold: owner, target, startX };
}

test("Kobold's candle level lengthens Wick Flick to 270/318/350/382 with an ember at full flame, Panic Dig to 165/182/198/215 with armor from level 2, and Mine! to 101 a side at level 3 [k3 measure docs/design/roster.md]", () => {
  const wickReach = [270.0, 318.0, 350.0, 382.0];
  const digTravel = [165.0, 182.0, 198.0, 215.0];
  const mineReach = [78.0, 86.0, 94.0, 101.0];
  for (let level = 0; level <= 3; level++) {
    const wick = litKobold(level, 1000.0, controls({ specialPressed: true }));
    assertEquals(wick.kobold.special.variant, level);
    let far = 0.0;
    let emberFrames = 0;
    for (let frame = 0; frame < 120; frame++) {
      for (const shot of wick.kobold.projectiles) {
        if (shot.spec === undefined) continue;
        far = max(far, shot.x - wick.startX);
        if (shot.life > 0 && shot.spec.velocityX === 0.0) emberFrames++;
      }
      stepDuel(wick.world);
    }
    assertNear(far, wickReach[level] ?? 0.0, 2.0);
    assertEquals(emberFrames, level === 3 ? 45 : 0);

    const dig = litKobold(level, 1000.0, controls({ specialPressed: true, specialX: 1 }));
    for (let frame = 2; frame <= 8; frame++) stepDuel(dig.world);
    const digFrom = dig.kobold.motion.x;
    for (let frame = 9; frame <= 23; frame++) stepDuel(dig.world);
    assertNear(dig.kobold.motion.x - digFrom, digTravel[level] ?? 0.0, 2.0);

    const jabbed = litKobold(level, 1000.0, controls({ specialPressed: true, specialX: 1 }));
    for (let frame = 2; frame <= 12; frame++) stepDuel(jabbed.world);
    contactBatch(jabbed.world, () => collectDamageContact(jabbed.world, 1, 0, hitEffect(5.0, 50.0, 20.0, -1.0, 0.0), 1, ContactKind.launch, true, undefined, false));
    stepDuel(jabbed.world);
    assertEquals(jabbed.kobold.special.action === SpecialAction.heroSide && jabbed.kobold.launch.hitstun === 0, level >= 2);

    const mine = litKobold(level, 1000.0, controls({ specialPressed: true, specialZ: -1 }));
    let ahead = 0.0;
    let behind = 0.0;
    for (const region of runningHeroSpecial(mine.kobold)?.regions ?? []) {
      const strike = region.hit.strike;
      if (strike === undefined) continue;
      ahead = max(ahead, strike.x2 + strike.radius);
      behind = max(behind, strike.radius - strike.x2);
    }
    assertNear(ahead, mineReach[level] ?? 0.0, 1.0);
    assertNear(behind, mineReach[level] ?? 0.0, 1.0);

    const struck = litKobold(level, 200.0, controls({ specialPressed: true }));
    for (let frame = 0; frame < 120; frame++) stepDuel(struck.world);
    const flame = level === 3 ? 7.5 : level === 2 ? 6.25 : 5.0;
    assertNear(struck.target.status.damage, level === 3 ? flame + 3.0 : flame, 0.125);
  }
});

function candleMatch(fighters: Fighter[]) {
  const mask = (1 << fighters.length) - 1;
  const state = { ...createReplaySnapshot(), world: createRoster(mask, fighters) };
  state.match.phase = Phase.match;
  state.match.humanMask = mask;
  state.match.humanFighterMask = mask;
  state.match.practice = true;
  let frame = 0;
  const step = (frames = 1) => {
    for (let i = 0; i < frames; i++) stepMatch(state.match, state.world, state.controls, ++frame);
  };
  return { state, world: state.world, step };
}

function strike(world: Roster, source: number, target: number, knockback: number, launchX = 0.0, launchZ = 1.0, damage = 10.0): void {
  collectDamageContact(world, source, target, hitEffect(damage, 0.0, knockback, launchX, launchZ), 1, ContactKind.launch, true, undefined, false);
}

function knockedOut(heat = 0, koboldX = -100.0) {
  const match = candleMatch([createFighter(Character.kobold, koboldX, 1), createFighter(Character.rifleman, 300.0, -1)]);
  const kobold = fighterAt(match.world, 0);
  kobold.candle.heat = heat;
  return { ...match, kobold };
}

test("a 141-knockback hit knocks Kobold's candle out of his hand and a 139 one does not [k1 scenario]", () => {
  const { world, kobold, step } = knockedOut();
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK - 1.0));
  assertEquals(kobold.candle.state, CandleState.held);
  assertEquals(kobold.candle.dropSerial, 0);
  step(80);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  assertEquals(kobold.candle.state, CandleState.airborne);
  assertEquals(kobold.candle.dropSerial, 1);
});

test("for 180 frames after his candle comes back a strong hit cannot knock it out again [k1 scenario]", () => {
  const { world, kobold, step } = knockedOut();
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  step(CANDLE_UNTOUCHED_FRAMES);
  assertEquals(kobold.candle.state, CandleState.held);
  step(CANDLE_GUARD_FRAMES - 1);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  assertEquals(kobold.candle.state, CandleState.held);
  step(1);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  assertEquals(kobold.candle.state, CandleState.airborne);
  assertEquals(kobold.candle.dropSerial, 2);
});

test("a knocked-out candle pops toward stage centre and lands on the deck within 40 frames [k1 scenario]", () => {
  const { world, kobold, step } = knockedOut();
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  let frames = 0;
  while (kobold.candle.state === CandleState.airborne && frames < 40) {
    step();
    frames++;
  }
  assertEquals(kobold.candle.state, CandleState.resting);
  assertEquals(kobold.candle.z, mainDeckZAt(0, kobold.candle.x));
  assertGreaterThan(kobold.candle.x, -100.0);
});

test("Kobold runs back to his fallen candle and takes it with the heat it had when it fell [k1 scenario]", () => {
  const { state, world, kobold, step } = knockedOut(150);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  step(80);
  state.controls.inputs[0].direction = 1;
  let frames = 80;
  while (kobold.candle.state !== CandleState.held && frames < CANDLE_UNTOUCHED_FRAMES - 1) {
    step();
    frames++;
  }
  assertEquals(kobold.candle.state, CandleState.held);
  assertEquals(kobold.candle.heat, 150);
  assertEquals(kobold.candle.returnSerial, 1);
});

test("an untouched candle relights in Kobold's hand after 300 frames with its heat gone [k1 scenario]", () => {
  const { world, kobold, step } = knockedOut(150);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  step(CANDLE_UNTOUCHED_FRAMES - 1);
  assertEquals(kobold.candle.state, CandleState.resting);
  assertEquals(kobold.candle.heat, 150);
  step();
  assertEquals(kobold.candle.state, CandleState.held);
  assertEquals(kobold.candle.heat, 0);
  assertTrue(kobold.candle.lit);
  assertEquals(kobold.candle.returnSerial, 1);
});

test("a candle knocked out past the ledge falls below the bottom blast line, is lost and still relights after 300 frames [k1 scenario]", () => {
  const { world, kobold, step } = knockedOut(0, -800.0);
  kobold.motion.grounded = false;
  kobold.motion.surface = undefined;
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0, 1.0, 0.5));
  step(200);
  assertEquals(kobold.candle.state, CandleState.lost);
  assertFalse(kobold.status.out);
  step(CANDLE_UNTOUCHED_FRAMES - 201);
  assertEquals(kobold.candle.state, CandleState.lost);
  step();
  assertEquals(kobold.candle.state, CandleState.held);
});

test("restoring a snapshot taken while the candle falls replays every fighter field [k1 scenario]", () => {
  const { state, world, kobold, step } = knockedOut(150);
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  step(10);
  const saved = createReplaySnapshot();
  copyReplayState(saved, state);
  step(20);
  assertEquals(kobold.candle.state, CandleState.airborne);
  const ended = createReplaySnapshot();
  copyReplayState(ended, state);
  copyReplayState(state, saved);
  for (let frame = 11; frame <= 30; frame++) stepMatch(state.match, world, state.controls, frame);
  for (let slot = 0; slot < 2; slot++) assertEquals(firstFighterDifference(fighterAt(ended.world, slot), fighterAt(world, slot), 3, 3), undefined);
});

function trade(koboldSlot: number): Fighter {
  const { world } = candleMatch(koboldSlot === 0
    ? [createFighter(Character.kobold, -100.0, 1), createFighter(Character.rifleman, 100.0, -1)]
    : [createFighter(Character.rifleman, -100.0, 1), createFighter(Character.kobold, 100.0, -1)]);
  const kobold = fighterAt(world, koboldSlot);
  kobold.candle.heat = 100;
  contactBatch(world, () => {
    strike(world, koboldSlot, 1 - koboldSlot, 30.0, 0.0, 1.0, 9.0);
    strike(world, 1 - koboldSlot, koboldSlot, CANDLE_DROP_KNOCKBACK + 1.0);
  });
  return kobold;
}

test("a Kobold trading a hit for a strong one keeps his heat gain and drops his candle from either slot [k1 scenario]", () => {
  for (const slot of [0, 1]) {
    const kobold = trade(slot);
    assertEquals(kobold.candle.heat, 100 + 9 * CANDLE_HEAT_PER_DAMAGE);
    assertEquals(kobold.candle.state, CandleState.airborne);
  }
});

test("in a four-fighter trade both Kobolds in the back slots keep their heat gains and drop their candles [k1 scenario]", () => {
  const { world } = candleMatch([createFighter(Character.rifleman, -300.0, 1), createFighter(Character.rifleman, -100.0, 1),
    createFighter(Character.kobold, 100.0, -1), createFighter(Character.kobold, 300.0, -1)]);
  contactBatch(world, () => {
    strike(world, 2, 0, 30.0, 0.0, 1.0, 9.0);
    strike(world, 3, 1, 30.0, 0.0, 1.0, 9.0);
    strike(world, 0, 3, CANDLE_DROP_KNOCKBACK + 1.0);
    strike(world, 1, 2, CANDLE_DROP_KNOCKBACK + 1.0);
  });
  for (const slot of [2, 3]) {
    const kobold = fighterAt(world, slot);
    assertEquals(kobold.candle.heat, 9 * CANDLE_HEAT_PER_DAMAGE);
    assertEquals(kobold.candle.state, CandleState.airborne);
  }
});

test("a candle resting on a sliding deck rides along with it instead of falling off [k1 scenario]", () => {
  const world = createRoster(1, [createFighter(Character.kobold, 0.0, 1)]);
  const candle = fighterAt(world, 0).candle;
  const centre = (frame: number) => f32((surfaceLeft(3, 1, frame) + surfaceRight(3, 1, frame)) * 0.5);
  candle.state = CandleState.resting;
  candle.surface = 1;
  candle.x = centre(0);
  candle.z = surfaceZAt(3, 1, 0, candle.x);
  for (let frame = 1; frame <= 120; frame++) {
    advanceCandleBodies(world, 3, frame);
    assertEquals(candle.state, CandleState.resting, `frame ${frame}`);
    assertNear(candle.x, centre(frame), f32(0.01));
  }
});

function fallenCandle(foes: Fighter[], heat = 150) {
  const match = candleMatch([createFighter(Character.kobold, -100.0, 1), ...foes]);
  const kobold = fighterAt(match.world, 0);
  kobold.candle.heat = heat;
  contactBatch(match.world, () => strike(match.world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  match.step(40);
  return { ...match, kobold, candle: kobold.candle };
}

function besideCandle(world: Roster, slot: number, candleX: number, side: number): Fighter {
  const foe = fighterAt(world, slot);
  foe.motion.x = f32(candleX - side * 30.0);
  foe.facing = side;
  return foe;
}

function settle(candle: Fighter["candle"], step: (frames?: number) => void): void {
  for (let frame = 0; frame < 60 && (candle.vx !== 0.0 || candle.state === CandleState.airborne); frame++) step();
}

test("a rival Kobold's jab kicks Kobold's resting candle 128 units along the deck and restarts its untouched timer [k1 scenario]", () => {
  const { world, candle, step } = fallenCandle([createFighter(Character.kobold, 300.0, -1)]);
  assertEquals(candle.state, CandleState.resting);
  const from = candle.x;
  besideCandle(world, 1, from, 1);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  step(4);
  assertEquals(candle.timer, CANDLE_UNTOUCHED_FRAMES - 4 + 1);
  settle(candle, step);
  assertNear(candle.x - from, 128.0, 4.0);
  assertEquals(candle.state, CandleState.resting);
  assertEquals(candle.heat, 150);
});

test("Dreadlord's standing forward tilt kicks Kobold's resting candle [k1 scenario]", () => {
  const { world, candle, step } = fallenCandle([createFighter(Character.dreadlord, 300.0, -1)]);
  assertEquals(candle.state, CandleState.resting);
  const from = candle.x;
  const kicker = besideCandle(world, 1, from, 1);
  assertTrue(kicker.motion.grounded);
  beginFighterAttack(world, 1, AttackStyle.forwardTilt, false);
  step(30);
  settle(candle, step);
  assertEquals(candle.struck[1], kicker.attack.serial);
  assertGreaterThan(candle.x, from);
  assertEquals(candle.state, CandleState.resting);
  assertEquals(candle.heat, 150);
  assertEquals(candle.snuffSerial, 0);
});

test("a rival Kobold's down tilt stamps out the candle where it lies, taking its heat and restarting its untouched timer [k1 scenario]", () => {
  const { world, candle, step } = fallenCandle([createFighter(Character.kobold, 300.0, -1)]);
  const from = candle.x;
  besideCandle(world, 1, from, 1);
  beginFighterAttack(world, 1, AttackStyle.downTilt, false);
  step(30);
  assertEquals(candle.snuffSerial, 1);
  assertEquals(candle.x, from);
  assertEquals(candle.state, CandleState.resting);
  assertEquals(candle.heat, 0);
  assertFalse(candle.lit);
  assertGreaterThan(candle.timer, CANDLE_UNTOUCHED_FRAMES - 40);
});

test("a Rifleman's blaster shot kicks the popping candle away from him and is spent on it [k1 scenario]", () => {
  const { state, world, kobold, step } = knockedOut(150);
  const rifleman = fighterAt(world, 1);
  rifleman.motion.x = -250.0;
  rifleman.facing = 1;
  contactBatch(world, () => strike(world, 1, 0, CANDLE_DROP_KNOCKBACK + 1.0));
  state.controls.inputs[1].specialPressed = true;
  let frames = 0;
  while (rifleman.special.action === SpecialAction.none && frames < 30) {
    step();
    frames++;
  }
  state.controls.inputs[1].specialPressed = false;
  while (kobold.candle.vx < CANDLE_KICK_SPEED && frames < 30) {
    step();
    frames++;
  }
  assertEquals(kobold.candle.vx, CANDLE_KICK_SPEED);
  assertEquals(kobold.candle.state, CandleState.airborne);
  for (const shot of rifleman.projectiles) assertEquals(shot.life, 0);
  assertEquals(kobold.status.damage, 10.0);
});

test("a candle kicked off the ledge falls below the bottom blast line, is lost and relights 300 frames after the kick [k1 scenario]", () => {
  const { world, kobold, candle, step } = fallenCandle([createFighter(Character.kobold, 300.0, -1)]);
  candle.x = f32(mainDeckRight(0) - 40.0);
  candle.z = mainDeckZAt(0, candle.x);
  besideCandle(world, 1, candle.x, 1);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  let frames = 0;
  while (candle.timer !== CANDLE_UNTOUCHED_FRAMES - 1 && frames < 10) {
    step();
    frames++;
  }
  step(200);
  assertEquals(candle.state, CandleState.lost);
  step(CANDLE_UNTOUCHED_FRAMES - 202);
  assertEquals(candle.state, CandleState.lost);
  step();
  assertEquals(candle.state, CandleState.held);
  assertEquals(kobold.candle.heat, 0);
});

test("kicking the candle every 200 frames cannot keep it from relighting in Kobold's hand 600 frames after the drop [k1 scenario]", () => {
  const { world, candle, step } = fallenCandle([createFighter(Character.kobold, 300.0, -1)]);
  step(160);
  besideCandle(world, 1, candle.x, 1);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  step(200);
  besideCandle(world, 1, candle.x, -1);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  step(CANDLE_AWAY_FRAMES - 401);
  assertEquals(candle.state, CandleState.resting);
  assertGreaterThan(candle.timer, 1);
  step();
  assertEquals(candle.state, CandleState.held);
  assertEquals(candle.heat, 0);
});

test("Kobold's teammates can neither kick nor stamp out his candle, with or without friendly fire [k1 scenario]", () => {
  for (const friendlyFire of [false, true]) {
    for (const style of [AttackStyle.jab, AttackStyle.downTilt]) {
      const { state, world, candle, step } = fallenCandle([createFighter(Character.rifleman, 300.0, -1), createFighter(Character.kobold, 400.0, -1)]);
      state.match.teamBattle = true;
      state.match.friendlyFire = friendlyFire;
      const from = candle.x;
      const timer = candle.timer;
      besideCandle(world, 2, from, 1);
      beginFighterAttack(world, 2, style, false);
      step(30);
      assertEquals(candle.x, from);
      assertEquals(candle.timer, timer - 30);
      assertEquals(candle.heat, 150);
      assertEquals(candle.snuffSerial, 0);
    }
  }
});

test("a stamp and a kick landing on the candle in the same frame stamp it out where it lies [k1 scenario]", () => {
  const { world, candle, step } = fallenCandle([createFighter(Character.kobold, 300.0, -1), createFighter(Character.kobold, 400.0, -1)]);
  const from = candle.x;
  const kicker = besideCandle(world, 1, from, 1);
  besideCandle(world, 2, from, -1);
  beginFighterAttack(world, 2, AttackStyle.downTilt, false);
  step(2);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  step(30);
  assertEquals(candle.struck[1], kicker.attack.serial);
  assertEquals(candle.snuffSerial, 1);
  assertEquals(candle.x, from);
  assertEquals(candle.heat, 0);
});
