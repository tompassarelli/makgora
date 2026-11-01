import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../../input/attackBuffer";
import { Phase, createMatchState } from "../../lobby/lobbyState";
import { produceComputerInput } from "../../match/botPlay";
import { createFrameControls } from "../../match/controls";
import { FULL_SKILL } from "../../match/cpuSkill";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../../match/frameInput";
import { createPacingAndPresentation } from "../../match/pacingAndPresentation";
import { Character, SpecialAction } from "../../sim/codes";
import { type Fighter, createFighter } from "../../sim/fighter";
import { copyControls, createRoster, neutralControls } from "../../sim/roster";
import { setWorldMotionValue } from "../../sim/motion";
import { mainDeckZAt } from "../../sim/stage";
import { WolfForm } from "./wolves";

const FRAMES = 360;
const MIDRANGE = 220.0;
const LONG_RANGE = 480.0;
const PUNISH_RANGE = 200.0;
const LANDING_LAG = 90;
const SEEDS = [7, 61, 409] as const;

function pin(f: Fighter, x: number): void {
  if (!f.motion.grounded || f.special.action !== SpecialAction.none) return;
  f.motion.x = x;
  setWorldMotionValue(f.motion.meleeX, x);
}

type Foe = (foe: Fighter) => void;

const standing: Foe = () => undefined;

const landing: Foe = (foe) => {
  foe.landing.lag = Math.max(foe.landing.lag, LANDING_LAG);
};

function firstWolf(gap: number, facing: number, seed: number, foeScript: Foe): number | undefined {
  const stage = 0;
  const thrall = createFighter(Character.thrall, f32(-gap * facing * 0.5), facing);
  const foe = createFighter(Character.peon, f32(gap * facing * 0.5), -facing);
  thrall.motion.z = mainDeckZAt(stage, thrall.motion.x);
  foe.motion.z = mainDeckZAt(stage, foe.motion.x);
  const world = createRoster(3, [thrall, foe]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.hazards = false;
  match.items.on = false;
  match.timeLimitMinutes = 0;
  match.ultimatesOff = true;
  match.matchSeed = seed;
  match.cpuOpponents[0] = "wren";
  match.cpuResolvedOpponents[0] = "wren";
  match.cpuTiers[0] = "expert";
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const executed = createFrameControls();
  const row = createMatchFrameInput();
  for (let frame = 1; frame <= FRAMES; frame++) {
    copyControls(produced.inputs[1], neutralControls());
    clearAttackBuffer(produced.commands[0]);
    clearAttackBuffer(produced.commands[1]);
    pin(thrall, f32(-gap * facing * 0.5));
    pin(foe, f32(gap * facing * 0.5));
    foeScript(foe);
    produceComputerInput(match, world, runtime, 0, frame, produced.inputs[0], produced.commands[0], FULL_SKILL);
    const before = thrall.special.action;
    if (!captureFrame(row, frame, 3, produced, runtime) || !executeMatchFrame(row, match, world, executed, runtime, frame)) throw new Error(`frame ${frame} did not run`);
    if (before !== SpecialAction.heroDown && thrall.special.action === SpecialAction.heroDown) return thrall.special.variant;
  }
  return undefined;
}

function firstWolves(gap: number, foeScript: Foe): string {
  const seen: string[] = [];
  for (const facing of [1, -1]) for (const seed of SEEDS) seen.push(`${facing}/${seed}:${firstWolf(gap, facing, seed, foeScript) ?? "none"}`);
  return seen.join(" ");
}

const every = (form: WolfForm): string => {
  const seen: string[] = [];
  for (const facing of [1, -1]) for (const seed of SEEDS) seen.push(`${facing}/${seed}:${form}`);
  return seen.join(" ");
};

test("A CPU Thrall casts each Feral Spirit form by its stick motion: the spirit wolf on plain down at midrange, the timber wolves on down-forward at long range, and the dire wolf on a quarter-circle forward to punish a landing foe, facing either way [k3 measure docs/design/thrall.md]", () => {
  assertEquals(firstWolves(MIDRANGE, standing), every(WolfForm.spirit), "midrange, standing foe");
  assertEquals(firstWolves(LONG_RANGE, standing), every(WolfForm.timber), "long range, standing foe");
  assertEquals(firstWolves(PUNISH_RANGE, landing), every(WolfForm.dire), "a foe held in landing lag");
});
