import { assertDefined, assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { STAGE_CATALOG } from "../../menu/stageCatalog";
import { stepMatch } from "../../match/step";
import { firstStateDifference } from "../../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { sweep } from "../../core/sweep";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { fillMeter } from "../../sim/meter";
import { setWorldMotionValue } from "../../sim/motion";
import { type Controls, copyControls, fighterAt } from "../../sim/roster";
import { mainDeckZAt } from "../../sim/stage";
import { controls } from "../../sim/testWorld";
import type { TargetedStrike } from "../../sim/specials/schema";
import { createMatchState } from "../../lobby/lobbyState";
import { createRoster } from "../../sim/roster";
import { createPacingAndPresentation } from "../../match/pacingAndPresentation";
import { createFrameControls } from "../../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../../match/frameInput";
import { produceComputerInput } from "../../match/botPlay";
import { clearAttackBuffer } from "../../input/attackBuffer";
import { neutralControls } from "../../sim/roster";

const DOOM = controls({ specialPressed: true, ultimatePressed: true, attackHeld: true });
const MIDRANGE = 300.0;
const CONNECT_SEEDS = [17, 83, 241] as const;
const CONNECT_FRAMES = 128;

interface Bout {
  readonly state: ReplayState;
  readonly pitLord: Fighter;
  readonly foe: Fighter;
  readonly strike: TargetedStrike;
  tick: number;
}

function bout(foeX: number, pitLordPercent = 0.0, pitLordX = 0.0): Bout {
  const state = createReplaySnapshot();
  copyFighterState(fighterAt(state.world, 0), createFighter(Character.pitLord, pitLordX, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.warden, foeX, -1), 3);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 503;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  const pitLord = fighterAt(state.world, 0);
  const strike = assertDefined(pitLord.tuning.ultimate?.targetedStrike, "Doom's targeted strike");
  const b: Bout = { state, pitLord, foe: fighterAt(state.world, 1), strike, tick: 0 };
  for (let frame = 0; frame < 8; frame++) step(b);
  fillMeter(pitLord);
  pitLord.status.damage = pitLordPercent;
  return b;
}

function step(b: Bout, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  b.tick++;
  copyControls(b.state.controls.inputs[0], first);
  copyControls(b.state.controls.inputs[1], second);
  stepMatch(b.state.match, b.state.world, b.state.controls, b.tick);
}

function moveTo(f: Fighter, x: number): void {
  f.motion.x = x;
  setWorldMotionValue(f.motion.meleeX, x);
}

/** Casts Doom and runs to its end, feeding the foe `foeInput` by Doom frame; returns whether the foe was doomed. */

test("Doom rolls back: a snapshot mid-glyph, restored after the foe fled out of range on the abandoned branch, replays the bolt and curse to the same state as the straight run [k1 scenario]", () => {
  const straight = bout(MIDRANGE);
  const replayed = bout(MIDRANGE);
  step(straight, DOOM);
  step(replayed, DOOM);
  for (let n = 0; n < 8; n++) {
    step(straight);
    step(replayed);
  }
  assertGreaterThan(replayed.pitLord.special.seekTarget, 0);
  const saved = createReplaySnapshot();
  copyReplayState(saved, replayed.state);
  const savedTick = replayed.tick;
  moveTo(replayed.foe, 800.0);
  for (let n = 0; n < 20; n++) step(replayed);
  assertEquals(replayed.foe.status.cursedBy, undefined);
  copyReplayState(replayed.state, saved);
  replayed.tick = savedTick;
  for (let n = 0; n < 90; n++) {
    step(straight);
    step(replayed);
  }
  assertEquals(replayed.foe.status.cursedBy, 0);
  assertEquals(firstStateDifference(straight.state, replayed.state), undefined);
});

type Approach = "standing" | "moving";

function connects(stage: number, seed: number, facing: number, approach: Approach): boolean {
  const owner = createFighter(Character.pitLord, f32(-MIDRANGE * facing * 0.5), facing);
  const target = createFighter(Character.blademaster, f32(MIDRANGE * facing * 0.5), -facing);
  owner.motion.z = mainDeckZAt(stage, owner.motion.x);
  target.motion.z = mainDeckZAt(stage, target.motion.x);
  const world = createRoster(3, [owner, target]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.hazards = false;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  match.cpuOpponents[1] = "wren";
  match.cpuResolvedOpponents[1] = "wren";
  match.cpuTiers[1] = "warchief";
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const executed = createFrameControls();
  const row = createMatchFrameInput();
  for (let frame = 1; frame <= CONNECT_FRAMES; frame++) {
    const tick = frame - 8;
    copyControls(produced.inputs[0], tick === 1 ? DOOM : neutralControls());
    copyControls(produced.inputs[1], neutralControls());
    clearAttackBuffer(produced.commands[0]);
    clearAttackBuffer(produced.commands[1]);
    if (tick === 1) fillMeter(owner);
    if (tick >= 1 && approach === "moving") produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
    assertTrue(captureFrame(row, frame, 3, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, executed, runtime, frame));
    if (tick === 1) assertEquals(owner.special.action, SpecialAction.heroUltimate, `stage ${stage} seed ${seed} facing ${facing}`);
  }
  return target.status.damage > 0.0;
}

function connectRate(stages: readonly number[], approach: Approach): { hits: number; total: number } {
  let hits = 0;
  let total = 0;
  for (const stage of stages) for (const seed of CONNECT_SEEDS) for (const facing of [-1, 1]) {
    total++;
    if (connects(stage, seed, facing, approach)) hits++;
  }
  return { hits, total };
}

sweep("Doom deals damage in at least 70% of fixed gap 300 standing and Wren Warchief approaches on every stage [k3 measure docs/design/ultimates.md]", () => {
  for (const approach of ["standing", "moving"] as const) for (const stage of STAGE_CATALOG) {
    const result = connectRate([stage.id], approach);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${stage.name} ${approach}: ${result.hits}/${result.total}`);
  }
});
