import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../../lobby/lobbyState";
import { copyControls, createRoster, fighterAt, neutralControls } from "../../sim/roster";
import { chooseRecoveryInput } from "../../match/botRecovery";
import { useMatchSeed } from "../../match/botRandom";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { canonicalState } from "../../replay/canonical";
import { copyReplayState, createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { AttackStyle, Character, LedgeState, SpecialCarry } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { HERO_REFERENCE_HEIGHT } from "../../sim/heroMoves";
import { applyAttackHit } from "../../sim/hits";
import { setWorldMotionValue } from "../../sim/motion";
import { mainDeckLeft, mainDeckZ } from "../../sim/stage";
import { contactBatch, hitEffect } from "../../sim/testWorld";
import { SURF } from "./specials";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FLAT_STAGE = 0;
const SURF_WATCH = 90;
const SOLO_POWERED_LAST = SURF.soloLast + 1;
const DISMOUNT_FRAME = SURF.linkedLast + 1;
const HIT_TICK = 20;
const RECOVERY_WATCH = 400;
const NEUTRAL = neutralControls();
const BREAKING_HIT = hitEffect(8.0, 50.0, 30.0, f32(0.7), f32(0.7));

function duel(partnerOffset: number, foeX = -900.0): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, foeX, 1)]);
  const match = state.match;
  match.phase = Phase.match;
  match.stageChoice = FLAT_STAGE;
  match.startHold = 0;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  initializeMatchFighters(match, world);
  const partner = fighterAt(world, PARTNER);
  partner.motion.x = f32(fighterAt(world, LEADER).motion.x - partnerOffset);
  return { ...state, world };
}

function offstage(state: ReplayState, out: number, below: number): void {
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  for (const body of [leader, partner]) {
    body.motion.grounded = false;
    body.motion.surface = undefined;
    body.motion.z = f32(mainDeckZ(FLAT_STAGE) - below);
    setWorldMotionValue(body.motion.meleeZ, body.motion.z);
    body.jump.remaining = 0;
    body.facing = 1;
  }
  leader.motion.x = f32(mainDeckLeft(FLAT_STAGE) - out);
  partner.motion.x = f32(leader.motion.x - 40.0);
  setWorldMotionValue(leader.motion.meleeX, leader.motion.x);
  setWorldMotionValue(partner.motion.meleeX, partner.motion.x);
}

function step(state: ReplayState, tick: number, stick: number): void {
  const input = state.controls.inputs[LEADER];
  copyControls(input, NEUTRAL);
  input.direction = stick;
  if (tick === 1) {
    input.specialPressed = true;
    input.specialZ = 1;
    input.verticalDirection = 1;
  }
  stepMatch(state.match, state.world, state.controls, tick);
}

function hit(state: ReplayState, slot: number): void {
  contactBatch(state.world, () => applyAttackHit(state.world, FOE, slot, AttackStyle.jab, -1, BREAKING_HIT, true, false));
}

interface Point { x: number; z: number }

interface Surf {
  readonly leaderRise: number;
  readonly partnerRise: number;
  readonly partnerRode: boolean;
  readonly boardGap: number;
  readonly leaderHelpless: boolean;
  readonly partnerHelpless: boolean;
}

function surf(state: ReplayState, poweredLast: number): Surf {
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  const leaderStart = leader.motion.z;
  const partnerStart = partner.motion.z;
  let leaderTop = leaderStart;
  let partnerTop = partnerStart;
  let partnerRode = false;
  let boardGap = 0.0;
  let leaderHelpless = false;
  let partnerHelpless = false;
  for (let tick = 1; tick <= SURF_WATCH; tick++) {
    step(state, tick, 0);
    if (leader.special.frame > 0 && leader.special.frame <= poweredLast) leaderTop = leader.motion.z;
    if (partner.special.frame > 0 && partner.special.frame <= poweredLast) partnerTop = partner.motion.z;
    if (partner.special.carry === SpecialCarry.rider && leader.special.frame >= SURF.rideFirst + 6) {
      boardGap = Math.max(boardGap, Math.abs(f32(partner.motion.x - leader.motion.x)), Math.abs(f32(f32(leader.motion.z - partner.motion.z) - SURF.boardDrop)));
    }
    leaderHelpless ||= leader.special.fall;
    partnerHelpless ||= partner.special.fall;
    partnerRode ||= partner.special.carry === SpecialCarry.rider;
  }
  return { leaderRise: leaderTop - leaderStart, partnerRise: partnerTop - partnerStart, partnerRode, boardGap, leaderHelpless, partnerHelpless };
}

test("A Mrgl who surfs with Grgl beside him rides him as a board 430 to 450 units up and leaves both helpless [k3 measure docs/design/murloc.md]", () => {
  const result = surf(duel(60.0), DISMOUNT_FRAME);
  assertEquals(result.leaderRise >= 430.0 && result.leaderRise <= 450.0, true, `Mrgl rises ${result.leaderRise}`);
  assertEquals(result.partnerRise >= 360.0, true, `Grgl rises ${result.partnerRise}`);
  assertTrue(result.partnerRode);
  assertEquals(result.boardGap <= 1.0, true, `Grgl strays ${result.boardGap} from under Mrgl`);
  assertTrue(result.leaderHelpless && result.partnerHelpless);
});

test("A Grgl beyond 120 units on frame 6 is left behind and surfs alone, rising 230 units or less [k3 measure docs/design/murloc.md]", () => {
  const result = surf(duel(200.0), SOLO_POWERED_LAST);
  assertEquals(result.partnerRode, false);
  assertEquals(result.partnerRise > 200.0 && result.partnerRise <= 230.0, true, `Grgl rises ${result.partnerRise}`);
  assertEquals(result.leaderRise > 200.0 && result.leaderRise <= 230.0, true, `Mrgl rises ${result.leaderRise}`);
});

test("At the end of the linked ride Mrgl backflips back and up while Grgl is kicked 0.5 to 0.8 heights on along the travel, ahead of him [k3 measure docs/design/murloc.md]", () => {
  const state = duel(60.0);
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  let travel: Point | undefined;
  let leaderStart: Point | undefined;
  let partnerStart: Point | undefined;
  let leaderTop = 0.0;
  let lead = 0.0;
  let push = 0.0;
  let apex = false;
  for (let tick = 1; tick <= SURF_WATCH && !apex; tick++) {
    const before = { x: leader.motion.vx, z: leader.motion.vz };
    step(state, tick, 1);
    if (leader.special.frame === DISMOUNT_FRAME) {
      const speed = Math.sqrt(before.x * before.x + before.z * before.z);
      travel = { x: before.x / speed, z: before.z / speed };
      leaderStart = { x: f32(leader.motion.x - leader.motion.deltaX), z: f32(leader.motion.z - leader.motion.deltaZ) };
      partnerStart = { x: f32(partner.motion.x - partner.motion.deltaX), z: f32(partner.motion.z - partner.motion.deltaZ) };
    }
    if (travel === undefined || leaderStart === undefined || partnerStart === undefined) continue;
    leaderTop = Math.max(leaderTop, f32(leader.motion.z - leaderStart.z));
    push = (partner.motion.x - partnerStart.x) * travel.x + (partner.motion.z - partnerStart.z) * travel.z;
    lead = (partner.motion.x - leader.motion.x) * travel.x + (partner.motion.z - leader.motion.z) * travel.z;
    apex = partner.motion.vz <= 0.0;
  }
  assertTrue(apex);
  assertEquals(push >= f32(0.5 * HERO_REFERENCE_HEIGHT) && push <= f32(f32(0.8) * HERO_REFERENCE_HEIGHT), true, `Grgl is kicked ${push} along the travel`);
  assertEquals(lead > 0.0, true, `Grgl leads Mrgl by ${lead}`);
  assertEquals(leaderStart !== undefined && (leader.motion.x - leaderStart.x) * leader.facing < -10.0, true, "Mrgl flips backward");
  assertEquals(leaderTop >= 10.0 && leaderTop <= 40.0, true, `Mrgl's flip rises ${leaderTop}`);
  for (let tick = 1; tick <= 12; tick++) step(state, SURF_WATCH + tick, 0);
  assertTrue(leader.special.fall && partner.special.fall);
});

function breakRide(struck: number): { readonly other: Fighter; readonly struck: Fighter; readonly climb: number } {
  const state = duel(60.0);
  const other = fighterAt(state.world, struck === PARTNER ? LEADER : PARTNER);
  let atHit = 0.0;
  let top = 0.0;
  for (let tick = 1; tick <= HIT_TICK + 12; tick++) {
    if (tick === HIT_TICK) {
      assertEquals(fighterAt(state.world, PARTNER).special.carry, SpecialCarry.rider, "Grgl rides when struck");
      hit(state, struck);
    }
    step(state, tick, 0);
    if (tick === HIT_TICK) {
      atHit = other.motion.z;
      top = atHit;
    }
    if (tick > HIT_TICK) top = Math.max(top, other.motion.z);
  }
  return { other, struck: fighterAt(state.world, struck), climb: f32(top - atHit) };
}

test("A hit on Grgl mid-ride breaks the link: Mrgl stops where he is and falls helpless, and so does Grgl when Mrgl is struck [k1 scenario]", () => {
  for (const struck of [PARTNER, LEADER]) {
    const result = breakRide(struck);
    assertTrue(result.struck.launch.hitstun > 0);
    assertEquals(result.struck.special.carry, SpecialCarry.none);
    assertTrue(result.other.special.fall);
    assertEquals(result.other.special.carry, SpecialCarry.none);
    assertEquals(result.climb <= 2.0, true, `slot ${struck === PARTNER ? LEADER : PARTNER} climbs ${result.climb} after the break`);
  }
});

test("From 500 units under the deck the linked surf reaches the ledge for either body: Mrgl from 160 out, Grgl from 240 out [k1 scenario]", () => {
  const reaches: readonly { readonly out: number; readonly holder: number }[] = [{ out: 160.0, holder: LEADER }, { out: 240.0, holder: PARTNER }];
  for (const { out, holder } of reaches) {
    const state = duel(60.0, 600.0);
    offstage(state, out, 500.0);
    let hung = -1;
    for (let tick = 1; tick <= SURF_WATCH && hung < 0; tick++) {
      step(state, tick, 1);
      if (fighterAt(state.world, LEADER).ledge.state === LedgeState.hang) hung = LEADER;
      if (fighterAt(state.world, PARTNER).ledge.state === LedgeState.hang) hung = PARTNER;
    }
    assertEquals(hung, holder, `from ${out} out`);
  }
});

test("A linked ride restored from a mid-ride state replays to the same match, through the dismount [k1 scenario]", () => {
  for (const save of [HIT_TICK, DISMOUNT_FRAME + 1]) {
    const live = duel(60.0);
    for (let tick = 1; tick < save; tick++) step(live, tick, 1);
    const replay = createReplaySnapshot();
    copyReplayState(replay, live);
    for (let tick = save; tick <= SURF_WATCH; tick++) {
      step(live, tick, 1);
      step(replay, tick, 1);
      assertEquals(canonicalState(replay), canonicalState(live), `saved at ${save}, tick ${tick}`);
    }
  }
});

test("The computer recovers the Murlocs duo from 300 units out on stage 0 [k1 scenario]", () => {
  const state = duel(60.0);
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  const foe = fighterAt(state.world, FOE);
  for (const body of [leader, partner]) {
    body.motion.grounded = false;
    body.motion.surface = undefined;
    body.motion.z = f32(mainDeckZ(FLAT_STAGE) - 40.0);
    setWorldMotionValue(body.motion.meleeZ, body.motion.z);
    body.jump.remaining = 0;
  }
  leader.motion.x = f32(mainDeckLeft(FLAT_STAGE) - 300.0);
  leader.facing = 1;
  partner.motion.x = f32(leader.motion.x - 40.0);
  useMatchSeed(0);
  let hung = false;
  let rode = false;
  let grounded = false;
  for (let tick = 1; tick <= RECOVERY_WATCH && !grounded; tick++) {
    copyControls(state.controls.inputs[LEADER], NEUTRAL);
    chooseRecoveryInput(leader, FLAT_STAGE, tick, state.controls.inputs[LEADER], foe);
    stepMatch(state.match, state.world, state.controls, tick);
    hung ||= leader.ledge.state === LedgeState.hang;
    rode ||= partner.special.carry === SpecialCarry.rider;
    grounded = leader.motion.grounded && !leader.status.out;
  }
  assertEquals(hung || grounded, true, `Mrgl ends at ${leader.motion.x}, ${leader.motion.z}`);
  assertTrue(rode);
  assertTrue(!leader.status.out);
  assertTrue(!partner.status.out);
});
