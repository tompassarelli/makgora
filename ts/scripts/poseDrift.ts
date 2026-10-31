// Usage: bun scripts/poseDrift.ts [--frames N] [--only SLUG]
// Plays each selectable fighter through an Expert CPU match on the real fighter pool with Wisp's effect store, drawing one 1/60 s frame after every
// presentation tick as the game does, and reports how far the shown body's clock sits from the clip time the pool jumped it to (in frames), and
// whether the shown body's global-sequence clock runs. A clip's opening frame cannot be jumped before its start, so it is counted apart and the rest must sit within 0.01 frame.
import { parseArgs } from "node:util";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/lobby/lobbyState";
import { produceComputerInput } from "../src/game/match/botPlay";
import { captureFrame, executeMatchFrame } from "../src/game/match/frameInput";
import { openFieldMatch } from "./cpuField";
import { createFighterDraw, fitFighterDraw } from "../src/game/presentation/fighterDraw";
import { FighterPoolPresentation } from "../src/game/render/fighterPool";
import { originalClip } from "../src/generated/clips/fighterOriginalClipInfo";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/roster/kits";
import { copyControls, fighterAt, neutralControls } from "../src/game/sim/roster";
import { Effects } from "../node_modules/wisp/src/game/native/effectStore";
import { FRAMES_PER_SECOND } from "../node_modules/wisp/src/game/native/frameRate";
import { bindWorld, type World } from "../node_modules/wisp/src/game/native/world";
import type { Handle } from "../node_modules/wisp/src/game/native/types";

const FRAME_SECONDS = 1 / FRAMES_PER_SECOND;
const NEUTRAL = neutralControls();
const STAGE = "three-bridges";

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { frames: { type: "string" }, only: { type: "string" } } });
const limit = Number(values.frames ?? 7200);

let nextHandle = 0;
let currentFrame = 0;
const effects = new Effects((kind) => ({ kind, id: nextHandle++ }), undefined, () => currentFrame);
bindWorld({ effects, players: undefined, log: undefined } as unknown as World);

interface Report {
  readonly name: string;
  frames: number;
  openingFrames: number;
  openingDrift: number;
  minDrift: number;
  maxDrift: number;
  clockRuns: boolean;
}

const reports: Report[] = [];
const characters = SELECTABLE_CHARACTERS.filter((character) => values.only === undefined || fighterSlug(character) === values.only);
for (const [index, character] of characters.entries()) {
  const opponent = SELECTABLE_CHARACTERS[(SELECTABLE_CHARACTERS.indexOf(character) + 1) % SELECTABLE_CHARACTERS.length] ?? character;
  const opened = openFieldMatch(character, opponent, STAGE, 0, {}, index + 1);
  if (opened === undefined) throw new Error(`${fighterSlug(character)}: no spawn on ${STAGE}`);
  const { match, world, controls, produced, runtime, row } = opened;
  const origin = { x: 0, y: 0, z: 0 };
  const pool = new FighterPoolPresentation(character, 0, origin, 0, 1.0);
  if (!pool.admitted()) throw new Error(`${fighterSlug(character)}: no pooled body`);
  const draw = createFighterDraw();
  const report: Report = { name: fighterSlug(character), frames: 0, openingFrames: 0, openingDrift: 0, minDrift: Infinity, maxDrift: -Infinity, clockRuns: false };
  const bodies: effect[] = [];
  pool.drawnEffects(bodies);
  effects.draw(FRAME_SECONDS);
  let clock: number | undefined;
  let frame = 0;
  while (match.phase === Phase.match && frame < limit) {
    frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 0 || slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot], undefined);
    }
    if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    currentFrame = frame;
    const fighter = fighterAt(world, 0);
    const pose = runtime.poses[0];
    if (pose === undefined) throw new Error("pose");
    const drawn = fitFighterDraw(draw, character, fighter, pose, match.stageChoice, frame, frame);
    pool.present(fighter, draw, drawn, frame);
    effects.draw(FRAME_SECONDS);
    if (!drawn || draw.index === undefined) continue;
    const clip = originalClip(character, draw.index);
    const shown = bodies[draw.index] as unknown as Handle | undefined;
    const state = shown === undefined ? undefined : effects.snapshot({ visibleOnly: true }).find((candidate) => candidate.handle === shown);
    if (clip === undefined || state === undefined) continue;
    const drift = (state.animationElapsed - ((clip.timeline ? clip.startSeconds : 0) + draw.seconds)) / FRAME_SECONDS;
    report.frames++;
    if (draw.seconds < FRAME_SECONDS - 1e-6) {
      report.openingFrames++;
      report.openingDrift = Math.max(report.openingDrift, drift);
    }
    else {
      report.minDrift = Math.min(report.minDrift, drift);
      report.maxDrift = Math.max(report.maxDrift, drift);
    }
    if (clock !== undefined && state.animationClock !== clock) report.clockRuns = true;
    clock = state.animationClock;
  }
  pool.destroy();
  reports.push(report);
  console.log(`${report.name.padEnd(18)} frames ${String(report.frames).padStart(5)} (${report.openingFrames} opening, up to ${report.openingDrift.toFixed(3)}) drift ${report.minDrift.toFixed(3)}..${report.maxDrift.toFixed(3)} frames, global clock ${report.clockRuns ? "runs" : "frozen"}`);
}
const worst = Math.max(...reports.map((report) => Math.max(Math.abs(report.minDrift), Math.abs(report.maxDrift))));
console.log(`${reports.length} fighters, worst drift ${worst.toFixed(3)} frames, ${reports.filter((report) => report.clockRuns).length} with a running global clock`);
process.exit(worst <= 0.01 ? 0 : 1);
