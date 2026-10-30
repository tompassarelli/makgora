import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Phase } from "../../lobby/lobbyState";
import { copyControls, createRoster, fighterAt, neutralControls } from "../../sim/roster";
import { chooseRecoveryInput } from "../../match/botRecovery";
import { useMatchSeed } from "../../match/botRandom";
import { initializeMatchFighters, stepMatch } from "../../match/step";
import { createReplaySnapshot, type ReplayState } from "../../replay/snapshot";
import { Character, LedgeState, SpecialCarry } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { setWorldMotionValue } from "../../sim/motion";
import { mainDeckLeft, mainDeckZ } from "../../sim/stage";

const LEADER = 0;
const FOE = 1;
const PARTNER = 2;
const FLAT_STAGE = 0;
const SURF_WATCH = 70;
const POWERED_LAST = 26;
const RECOVERY_WATCH = 400;
const NEUTRAL = neutralControls();

function duel(partnerOffset: number): ReplayState {
  const state = createReplaySnapshot();
  const world = createRoster(3, [createFighter(Character.murloc, 0.0, 1), createFighter(Character.peon, -900.0, 1)]);
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

interface Surf {
  readonly leaderRise: number;
  readonly partnerRise: number;
  readonly partnerRode: boolean;
  readonly leaderHelpless: boolean;
  readonly partnerHelpless: boolean;
}

function surf(state: ReplayState): Surf {
  const leader = fighterAt(state.world, LEADER);
  const partner = fighterAt(state.world, PARTNER);
  const leaderStart = leader.motion.z;
  const partnerStart = partner.motion.z;
  let leaderTop = leaderStart;
  let partnerTop = partnerStart;
  let partnerRode = false;
  let leaderHelpless = false;
  let partnerHelpless = false;
  for (let tick = 1; tick <= SURF_WATCH; tick++) {
    const input = state.controls.inputs[LEADER];
    copyControls(input, NEUTRAL);
    if (tick === 1) {
      input.specialPressed = true;
      input.specialZ = 1;
      input.verticalDirection = 1;
    }
    stepMatch(state.match, state.world, state.controls, tick);
    if (leader.special.frame > 0 && leader.special.frame <= POWERED_LAST) leaderTop = leader.motion.z;
    if (partner.special.frame > 0 && partner.special.frame <= POWERED_LAST) partnerTop = partner.motion.z;
    leaderHelpless ||= leader.special.fall;
    partnerHelpless ||= partner.special.fall;
    partnerRode ||= partner.special.carry === SpecialCarry.rider;
  }
  return { leaderRise: leaderTop - leaderStart, partnerRise: partnerTop - partnerStart, partnerRode, leaderHelpless, partnerHelpless };
}

test("A Mrgl who surfs with Grgl beside him carries both 330 units or more up and leaves both helpless [k3 measure docs/design/murloc.md]", () => {
  const result = surf(duel(60.0));
  assertEquals(result.leaderRise >= 330.0, true, `Mrgl rises ${result.leaderRise}`);
  assertEquals(result.partnerRise >= 330.0, true, `Grgl rises ${result.partnerRise}`);
  assertTrue(result.partnerRode);
  assertTrue(result.leaderHelpless && result.partnerHelpless);
});

test("A Grgl beyond 120 units on frame 6 is left behind and surfs alone, rising 230 units or less [k3 measure docs/design/murloc.md]", () => {
  const result = surf(duel(200.0));
  assertEquals(result.partnerRode, false);
  assertEquals(result.partnerRise > 0.0 && result.partnerRise <= 230.0, true, `Grgl rises ${result.partnerRise}`);
  assertEquals(result.leaderRise <= 230.0, true, `Mrgl rises ${result.leaderRise}`);
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
