import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../../../generated/state/fighterState";
import { Phase } from "../../lobby/lobbyState";
import { STAGE_CATALOG } from "../../menu/stageCatalog";
import { stepMatch } from "../../match/step";
import { firstStateDifference } from "../../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { sweep } from "../../core/sweep";
import { beginFighterAttack } from "../../sim/attacks";
import { AttackStyle, Character, SpecialAction } from "../../sim/codes";
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
const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const SPOT_DODGE = controls({ ...SHIELD, groundDodgePressed: true, groundDodgeDirection: 0 });
const ADJACENT = 60.0;
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
function cast(b: Bout, foeInput: (frame: number) => Readonly<Controls> = () => controls(), onFrame: (frame: number) => void = () => {}): boolean {
  step(b, DOOM);
  assertEquals(b.pitLord.special.action, SpecialAction.heroUltimate);
  for (let n = 0; n < 70 && b.pitLord.special.action === SpecialAction.heroUltimate; n++) {
    onFrame(b.pitLord.special.frame);
    step(b, controls(), foeInput(b.pitLord.special.frame + 1));
  }
  return b.foe.status.cursedBy === 0;
}

test("Doom locks a foe 300 away, draws the glyph on it from frame 1, and the bolt lands on the strike frame for 10% with a small pop up and the curse [k1 scenario]", () => {
  const b = bout(MIDRANGE);
  let struckOn: number | undefined;
  let glyphFrames = 0;
  const doomed = cast(b, () => controls(), (frame) => {
    if (frame >= 1 && frame < b.strike.frame && b.pitLord.projectiles.some(p => p.life > 0 && p.spec === b.strike.glyph && p.x === b.foe.motion.x)) glyphFrames++;
    if (struckOn === undefined && b.foe.status.damage > 0.0) struckOn = frame;
  });
  assertTrue(doomed);
  assertEquals(struckOn, b.strike.frame);
  assertEquals(glyphFrames, b.strike.frame - 1);
  assertGreaterThan(b.foe.status.damage, f32(9.9));
  assertLessThan(b.foe.status.damage, 12.0);
});

test("Doom beats a held shield [k1 scenario]", () => {
  const b = bout(MIDRANGE);
  step(b, controls(), { ...SHIELD, shieldPressed: true });
  assertTrue(cast(b, () => SHIELD));
  assertGreaterThan(b.foe.status.damage, f32(9.9));
});

function spotDodgeEscapes(pressFrame: number): boolean {
  const b = bout(MIDRANGE);
  return !cast(b, (frame) => frame === pressFrame ? SPOT_DODGE : frame > pressFrame && frame < pressFrame + 3 ? SHIELD : controls());
}

test("A spot dodge whose intangible frames cover the bolt's landing frame escapes Doom; one pressed on the glyph's first frame has ended and is doomed [k1 scenario]", () => {
  const strikeFrame = bout(MIDRANGE).strike.frame;
  assertTrue(spotDodgeEscapes(strikeFrame - 4));
  assertFalse(spotDodgeEscapes(2));
});

test("Doom misses a foe beyond its 600 lock range, and one that runs out of range before the bolt lands, and still ends on frame 60 [k1 scenario]", () => {
  const far = bout(300.0, 0.0, -500.0);
  assertFalse(cast(far));
  assertEquals(far.foe.status.damage, 0.0);
  const fled = bout(-200.0, 0.0, -500.0);
  const stocks = fled.foe.status.stocks;
  assertFalse(cast(fled, () => controls(), (frame) => { if (frame === 10) moveTo(fled.foe, 550.0); }));
  assertEquals(fled.foe.status.stocks, stocks);
  assertEquals(fled.foe.status.damage, 0.0);
  assertEquals(fled.pitLord.special.action, SpecialAction.none);
});

test("A jab during Doom's startup is absorbed by its knockback armor: Pit Lord takes the damage, keeps casting and the bolt still dooms the jabber [k1 scenario]", () => {
  const b = bout(ADJACENT);
  let jabbed = false;
  const doomed = cast(b, () => controls(), (frame) => {
    if (frame === 4 && !jabbed) {
      beginFighterAttack(b.state.world, 1, AttackStyle.jab, false);
      jabbed = true;
    }
  });
  assertGreaterThan(b.pitLord.status.damage, 0.0);
  assertEquals(b.pitLord.visuals.armorAbsorbs, 1);
  assertTrue(doomed);
});

test("A forward smash on Pit Lord at 100% breaks Doom's armor and cancels the cast before the bolt [k1 scenario]", () => {
  const b = bout(ADJACENT, 100.0);
  let smashed = false;
  const doomed = cast(b, () => controls(), (frame) => {
    if (frame === 1 && !smashed) {
      beginFighterAttack(b.state.world, 1, AttackStyle.forwardSmash, false);
      smashed = true;
    }
  });
  assertFalse(doomed);
  assertEquals(b.foe.status.damage, 0.0);
  assertGreaterThan(b.pitLord.launch.hitstun, 0);
});

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
  match.cpuTiers[1] = "expert";
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

test("Doom deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches [k3 measure docs/design/ultimates.md]", () => {
  for (const approach of ["standing", "moving"] as const) {
    const result = connectRate([0], approach);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${approach}: ${result.hits}/${result.total}`);
  }
});

sweep("Doom deals damage in at least 70% of fixed gap 300 standing and Wren Expert approaches on every stage [k3 measure docs/design/ultimates.md]", () => {
  for (const approach of ["standing", "moving"] as const) for (const stage of STAGE_CATALOG) {
    const result = connectRate([stage.id], approach);
    assertEquals(result.hits * 10 >= result.total * 7, true, `${stage.name} ${approach}: ${result.hits}/${result.total}`);
  }
});
