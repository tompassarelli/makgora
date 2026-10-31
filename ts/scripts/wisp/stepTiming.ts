import { readFileSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { Console, Effect } from "effect";
import { type Command, UsageFailure, flagValues } from "wisp/scripts/wisp/command";
import { PerfFailure } from "wisp/scripts/wisp/commands/perf";
import { captureScene, sceneWithUnits } from "wisp/scripts/wisp/headlessRender";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { headlessRender } from "./headlessRender";
import { NEUTRAL_INPUT, createStandaloneSession } from "./standalone";

const DEFAULT_STEPS = 3600;
const DEFAULT_STAGE = "Tomb of Sargeras";

export interface Spread { readonly p50: number; readonly p99: number; readonly max: number }

export interface StepTiming {
  readonly steps: number;
  readonly stage: string;
  readonly load: number;
  readonly cores: number;
  readonly wall: Spread;
  readonly onCpu: Spread;
  readonly waitShare: number;
  readonly digest: string;
}

const spread = (values: readonly number[]): Spread => {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
  return { p50: rank(0.5), p99: rank(0.99), max: sorted.at(-1) ?? 0 };
};

const threadClock = () => {
  const [run = "0", wait = "0"] = readFileSync("/proc/thread-self/schedstat", "utf8").split(" ");
  return { run: Number(run) / 1e6, wait: Number(wait) / 1e6 };
};

export async function timeSteps(steps: number, stageName: string): Promise<StepTiming> {
  const stage = STAGE_CATALOG.find((info) => info.name.toLowerCase() === stageName.toLowerCase());
  if (stage === undefined) throw new Error(`no stage named ${stageName}; one of ${STAGE_CATALOG.map((info) => info.name).join(", ")}`);
  const render = headlessRender();
  const load = loadavg()[0] ?? 0;
  const session = await createStandaloneSession({ fourFighters: true, stage: stage.id });
  try {
    const wall: number[] = [], onCpu: number[] = [];
    let waited = 0, elapsed = 0;
    for (let step = 0; step < steps; step++) {
      const clock = threadClock();
      const began = performance.now();
      session.step(NEUTRAL_INPUT);
      const scene = sceneWithUnits(render, captureScene(session.client, { visibleOnly: true }));
      scene.effects.filter((effect) => effect.alpha > 0 && effect.scale > 0 && !effect.flat);
      scene.ui.filter((element) => element.visible && element.alpha > 0);
      const took = performance.now() - began;
      const after = threadClock();
      wall.push(took);
      onCpu.push(after.run - clock.run);
      waited += after.wait - clock.wait;
      elapsed += took;
    }
    return { steps, stage: stage.name, load, cores: availableParallelism(), wall: spread(wall), onCpu: spread(onCpu), waitShare: elapsed === 0 ? 0 : waited / elapsed, digest: session.digest().digest };
  } finally {
    session.close();
  }
}

const cell = (value: number) => value.toFixed(2).padStart(8);

export const formatStepTiming = (timing: StepTiming) => [
  `step: four fighters on ${timing.stage}, ${timing.steps} steps, load ${timing.load.toFixed(1)} on ${timing.cores} cores`,
  `              p50      p99      max`,
  `wall ms   ${cell(timing.wall.p50)} ${cell(timing.wall.p99)} ${cell(timing.wall.max)}`,
  `on-CPU ms ${cell(timing.onCpu.p50)} ${cell(timing.onCpu.p99)} ${cell(timing.onCpu.max)}`,
  `runqueue wait ${(timing.waitShare * 100).toFixed(0)}% of wall time; digest ${timing.digest}`,
].join("\n");

export const stepTiming: Command = (args) => Effect.gen(function*() {
  const [stepsText = String(DEFAULT_STEPS)] = flagValues(args, "steps");
  const [stage = DEFAULT_STAGE] = flagValues(args, "stage");
  if (!/^\d+$/.test(stepsText) || Number(stepsText) < 1) return yield* new UsageFailure({ problem: "--steps needs a positive step count" });
  const timing = yield* Effect.tryPromise({ try: () => timeSteps(Number(stepsText), stage), catch: (cause) => new PerfFailure({ problem: String(cause) }) });
  yield* Console.log(formatStepTiming(timing));
});
