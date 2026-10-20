import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { Phase } from "../lobby/lobbyState";
import { stepMatch } from "../match/step";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { fighterAt } from "./roster";
import { TOMB_OF_SARGERAS_STAGE, mainDeckZ } from "./stage";
import { advanceSolo, controls } from "./testWorld";
import { f32 } from "wisp/src/sim/f32";
import { HYDRA_CATCH_DAMAGE, HYDRA_TELL_FRAMES, HYDRA_TRIGGER_FRAMES } from "./water";
import { SEA_SURFACE_Z, TIDE_SPEED, inSea } from "./stageHazards";
import { hydraStrikeZ } from "../presentation/stageHazards";
import { setWorldMotionValue } from "./motion";
import { mutableWater } from "./fighterRest";
import { copyControls, createRoster, neutralControls } from "./roster";
import { chooseRecoveryInput } from "../match/botRecovery";
import { createFrameControls } from "../match/controls";
import { createMatchState } from "../lobby/lobbyState";
import { stepMatch as stepGame } from "../match/step";

const TOMB = TOMB_OF_SARGERAS_STAGE;
const HYDRA_STRIKE = HYDRA_TRIGGER_FRAMES + HYDRA_TELL_FRAMES;

function seaMatch(x: number, z: number): ReplayState {
  const state = createReplaySnapshot();
  state.match.phase = Phase.match; state.match.stageChoice = TOMB;
  state.match.humanMask = 3; state.match.humanFighterMask = 3; state.match.practice = true;
  const f = fighterAt(state.world, 0);
  f.motion.x = x; f.motion.z = z; f.motion.grounded = false; f.motion.surface = undefined;
  return state;
}

function play(state: ReplayState, from: number, to: number, each?: (frame: number, f: Fighter) => void): void {
  for (let frame = from; frame <= to; frame++) {
    stepMatch(state.match, state.world, state.controls, frame);
    each?.(frame, fighterAt(state.world, 0));
  }
}

const NEUTRAL = controls();
const JUMP = controls({ jumpPressed: true, jumpHeld: true });
const OPEN_SEA = 900.0;

function floater(character: Character): Fighter {
  const f = createFighter(character, OPEN_SEA, -1);
  f.motion.grounded = false; f.motion.surface = undefined; f.motion.z = SEA_SURFACE_Z;
  advanceSolo(f, TOMB, NEUTRAL, 0.0);
  return f;
}

test("every fighter's water jump and double jump from the surface reach above the deck [k3 measure docs/design/water-stage.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const f = floater(character);
    mutableWater(f).entries = 1;
    advanceSolo(f, TOMB, JUMP, 0.0);
    let highest = f.motion.z;
    let doubled = false;
    for (let frame = 0; frame < 180 && (f.motion.z > SEA_SURFACE_Z || frame === 0); frame++) {
      const press = !doubled && f.motion.vz <= 0;
      if (press) doubled = true;
      advanceSolo(f, TOMB, press ? JUMP : controls({ jumpHeld: true }), 0.0);
      highest = Math.max(highest, f.motion.z);
    }
    if (!(doubled && highest > mainDeckZ(TOMB))) throw new Error(`fighter ${character} reaches ${highest} from the surface, below the deck at ${mainDeckZ(TOMB)}`);
  }
});

test("a hydra strike replays through rollback with no difference, and a dodged lunge at its drifting mark submerges after 18 frames and restores through rollback [k1 scenario]", () => {
  const live = seaMatch(-1000.0, SEA_SURFACE_Z);
  const saved = createReplaySnapshot(); const replay = createReplaySnapshot();
  play(live, 1, 170);
  copyReplayState(saved, live);
  play(live, 171, 230);
  copyReplayState(replay, saved);
  play(replay, 171, 230);
  assertGreaterThan(fighterAt(live.world, 0).status.damage, 0.0);
  assertEquals(firstStateDifference(live, replay), undefined);
  assertEquals(stateChecksum(live), stateChecksum(replay));
  const dodged = seaMatch(-1000.0, SEA_SURFACE_Z);
  play(dodged, 1, HYDRA_STRIKE - 1);
  const fighter = fighterAt(dodged.world, 0);
  const mark = fighter.water.hydraX;
  fighter.motion.x += 200.0;
  fighter.motion.z = SEA_SURFACE_Z + 200.0;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  const dodgedSaved = createReplaySnapshot();
  copyReplayState(dodgedSaved, dodged);
  play(dodged, HYDRA_STRIKE, HYDRA_STRIKE + 17, (frame, f) => {
    assertEquals(f.status.damage, 0.0);
    assertEquals(f.water.hydraStrikeFrame, HYDRA_STRIKE);
    assertEquals(f.water.hydraX, f32(mark + TIDE_SPEED));
    assertEquals(hydraStrikeZ(TOMB, f.water, frame), -210.0 - (frame - HYDRA_STRIKE) * 20.0);
  });
  const dodgedReplay = createReplaySnapshot();
  copyReplayState(dodgedReplay, dodgedSaved);
  play(dodgedReplay, HYDRA_STRIKE, HYDRA_STRIKE + 17);
  assertEquals(firstStateDifference(dodged, dodgedReplay), undefined);
  assertEquals(stateChecksum(dodged), stateChecksum(dodgedReplay));
  play(dodged, HYDRA_STRIKE + 18, HYDRA_STRIKE + 18);
  assertEquals(hydraStrikeZ(TOMB, fighter.water, HYDRA_STRIKE + 18), undefined);
});

function lift(f: Fighter): void {
  f.motion.z = SEA_SURFACE_Z + 200.0; f.motion.vz = 0.0;
  setWorldMotionValue(f.motion.meleeZ, f.motion.z);
}

test("the hydra drags a fighter still in the water at the end of its tell under for a stock on the strike frame, through shield and air dodge, wherever its mark is [k1 scenario]", () => {
  for (const guard of ["none", "shield", "dodge"] as const) for (const offset of [0.0, 600.0]) {
    const state = seaMatch(-1000.0, SEA_SURFACE_Z);
    state.match.practice = false;
    const f = fighterAt(state.world, 0);
    play(state, 1, HYDRA_STRIKE - 3);
    f.motion.x += offset;
    setWorldMotionValue(f.motion.meleeX, f.motion.x);
    if (guard === "dodge") copyControls(state.controls.inputs[0], controls({ airDodgePressed: true }));
    play(state, HYDRA_STRIKE - 2, HYDRA_STRIKE - 2);
    copyControls(state.controls.inputs[0], NEUTRAL);
    play(state, HYDRA_STRIKE - 1, HYDRA_STRIKE - 1);
    if (guard === "shield") f.shield.raised = true;
    if (guard === "dodge") assertEquals(f.dodge.airDodging, true);
    assertEquals(f.status.out, false);
    assertEquals(f.status.stocks, 3);
    assertEquals(inSea(TOMB, f.motion.x, f.motion.z), true);
    const before = f.status.damage;
    play(state, HYDRA_STRIKE, HYDRA_STRIKE);
    assertEquals(f.status.out, true);
    assertEquals(f.status.stocks, 2);
    assertEquals(f.status.damage, f32(before + HYDRA_CATCH_DAMAGE));
    assertEquals(f.water.hydraStrikeFrame, HYDRA_STRIKE);
  }
});

test("a fighter that leaves the water during the hydra's tell keeps its stock and takes no damage [k1 scenario]", () => {
  for (const leave of [HYDRA_STRIKE - 10, HYDRA_STRIKE - 1]) {
    const state = seaMatch(-1000.0, SEA_SURFACE_Z);
    state.match.practice = false;
    const f = fighterAt(state.world, 0);
    play(state, 1, leave - 1);
    assertGreaterThan(f.water.hydraFrame, 0);
    lift(f);
    play(state, leave, HYDRA_STRIKE);
    assertEquals(inSea(TOMB, f.motion.x, f.motion.z), false);
    assertEquals(f.water.hydraStrikeFrame, HYDRA_STRIKE);
    assertEquals(f.status.out, false);
    assertEquals(f.status.stocks, 3);
    assertEquals(f.status.damage, 0.0);
  }
});

test("every computer fighter in the water when the hydra's tell starts leaves it before the strike and keeps its stock [k1 scenario]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const x of [-1000.0, -300.0, 300.0, 1000.0]) for (const tideFrame of [1, 601]) {
    const fighter = createFighter(character, x, x < 0 ? 1 : -1);
    const opponent = createFighter(Character.rifleman, 0.0, 1);
    const world = createRoster(3, [fighter, opponent]);
    const game = createMatchState();
    game.phase = Phase.match; game.stageChoice = TOMB; game.matchFrame = tideFrame;
    fighter.motion.z = SEA_SURFACE_Z; fighter.motion.grounded = false; fighter.motion.surface = undefined;
    const water = mutableWater(fighter);
    water.frames = HYDRA_TRIGGER_FRAMES; water.inWater = true; water.entries = 1;
    water.hydraFrame = 1; water.hydraX = x;
    const frames = createFrameControls();
    const input = neutralControls();
    let struck = false;
    for (let frame = 1; frame <= HYDRA_TELL_FRAMES + 1 && !struck; frame++) {
      copyControls(input, NEUTRAL);
      chooseRecoveryInput(fighter, TOMB, game.matchFrame, input);
      copyControls(frames.inputs[0], input);
      stepGame(game, world, frames, frame);
      struck = fighter.water.hydraStrikeFrame >= 0;
    }
    if (!struck || fighter.status.out || fighter.status.stocks !== 3) throw new Error(`computer ${character} from x ${x} at tide frame ${tideFrame}: struck ${struck}, out ${fighter.status.out}, stocks ${fighter.status.stocks}`);
  }
});

test("falling into the sea gives back every once-per-airtime special, so up special can recover from the water [k1 scenario]", () => {
  const state = seaMatch(OPEN_SEA, f32(SEA_SURFACE_Z + 40.0));
  const f = fighterAt(state.world, 0);
  f.special.airtimeUses = 15;
  let entered = false;
  play(state, 1, 60, (_frame, fighter) => { if (fighter.water.inWater) entered = true; });
  assertEquals(entered, true);
  assertEquals(fighterAt(state.world, 0).special.airtimeUses, 0);
});
