import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Console, Effect } from "effect";
import { PerfFailure, measureRun } from "wisp/scripts/wisp/commands/perf";
import { parsePerfRun } from "wisp/scripts/wisp/perf";
import { sourceHash } from "../generated";
import { SMASHCRAFT_PERF } from "./commands/perf";
import { tsDirectory } from "./project";

const RUN = "playable-bot-four";
const FRAMES = 1800;

// The predictor's inputs: both Lua entries with every local module they reach,
// their configs, the Wisp pin and the Lua binary. Equal hashes reuse one run.
const inputsHash = () => {
  const hash = new Bun.CryptoHasher("sha256").update(`${RUN} ${FRAMES} ${process.env.LUA ?? "stock"}\n`);
  for (const entry of ["src/host/entries/playableMain.ts", "scripts/wisp/perfLua.ts"]) hash.update(sourceHash(join(tsDirectory, entry))).update("\n");
  for (const file of ["package.json", "wisp.lock", "tsconfig.map.json", ".tsconfig.playable.json", ".tsconfig.perf.json"]) hash.update(`${file}\0`).update(readFileSync(join(tsDirectory, file))).update("\n");
  return hash.digest("hex");
};

const cachedRun = (inputs: string) => Effect.gen(function*() {
  const cache = Bun.file(join(tsDirectory, "build/playtest-cost", `${inputs}.perf`));
  const cached = yield* Effect.promise(() => cache.exists());
  if (cached) {
    const output = yield* Effect.promise(() => cache.text());
    yield* Console.log(`reusing predicted Lua cost for inputs ${inputs.slice(0, 12)}`);
    return { output, measured: yield* Effect.try({ try: () => parsePerfRun(output), catch: (cause) => new PerfFailure({ problem: `cached playtest cost ${inputs}: ${String(cause)}` }) }) };
  }
  const { output, measured } = yield* measureRun(SMASHCRAFT_PERF, RUN, FRAMES, true);
  if (measured.problems === 0) yield* Effect.promise(() => Bun.write(cache, output));
  return { output, measured };
});

export const writePlaytestCost = (map: string) => Effect.gen(function*() {
  const inputs = yield* Effect.try({ try: inputsHash, catch: (cause) => new PerfFailure({ problem: `hashing playtest cost inputs: ${String(cause)}` }) });
  const { output, measured } = yield* cachedRun(inputs);
  if (measured.problems > 0) return yield* new PerfFailure({ problem: `playtest cost found ${measured.problems} problems; its callbacks are not a measurement` });
  const values = measured.clients.get(0)?.["native-us"];
  if (values === undefined) return yield* new PerfFailure({ problem: "playtest cost has no player 0 callbacks" });
  const report = {
    map: basename(map),
    note: "Lua cost predicted; whole frame not measured",
    run: RUN,
    inputs,
    player: 0,
    callbacks: measured.frames,
    calibration: {
      reference: "wisp#19",
      scope: "solo and four-bot callbacks only; playable-bot-four",
      percentiles: ["p50", "p95"],
      nativeToleranceShare: 0.2,
    },
    predictedLuaMs: { p50: values.median / 1000, p95: values.p95 / 1000 },
    diagnostics: { worstPredictedLuaMs: values.max / 1000 },
    samples: basename(`${map}.lua-cost.perf`),
  };
  yield* Effect.tryPromise({
    try: async () => {
      await Bun.write(`${map}.lua-cost.perf`, output);
      await Bun.write(`${map}.lua-cost.json`, `${JSON.stringify(report, null, 2)}\n`);
    },
    catch: (cause) => new PerfFailure({ problem: `writing playtest cost beside ${map}: ${String(cause)}` }),
  });
  yield* Console.log(`${report.note}; p50 ${report.predictedLuaMs.p50.toFixed(2)} ms, p95 ${report.predictedLuaMs.p95.toFixed(2)} ms; worst ${report.diagnostics.worstPredictedLuaMs.toFixed(2)} ms diagnostic (${map}.lua-cost.json)`);
});
