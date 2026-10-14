import { join } from "node:path";
import { Console, Effect } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { EffectCheckFailure, readEffectReport } from "./wisp/effectVisibility";
import { CUE_MODEL_RECORD, cueModels, formatRecord, listedRedraws, parseRecord, recordProblem, redrawCandidates, formatEffectRecord, effectRecordProblem, effectRecordUnknowns } from "./wisp/cueModels";
import { readScreenCaptures } from "./classicEffectScreen";
import { screenReport, screenAcceptanceProblem } from "./wisp/classicEffectScreen";

const record = join(import.meta.dir, "../..", CUE_MODEL_RECORD);
const models = cueModels(), candidates = redrawCandidates();

BunRuntime.runMain(Effect.gen(function*() {
  if (process.argv.includes("--record")) {
    const at = process.argv.indexOf("--stock-cache"), cache = at < 0 ? process.env.CLASSIC_EFFECT_CACHE : process.argv[at + 1];
    if (cache === undefined) return yield* new EffectCheckFailure({ problem: "--record needs one exact24268 --stock-cache DIRECTORY" });
    const { cueModelLooks } = yield* Effect.promise(() => import("./wisp/headlessRender"));
    const looks = yield* cueModelLooks();
    const report = yield* readEffectReport(cache);
    yield* Effect.tryPromise({ try: () => Bun.write(record, formatRecord(looks) + formatEffectRecord(report)), catch: (cause) => new EffectCheckFailure({ problem: `write cue record: ${String(cause)}` }) });
    yield* Console.log(`cue models: recorded ${looks.size} models and ${report.findings.length} Classic effect uses in ${CUE_MODEL_RECORD}`);
  }
  const text = yield* Effect.tryPromise({ try: async () => await Bun.file(record).exists() ? await Bun.file(record).text() : "", catch: (cause) => new EffectCheckFailure({ problem: `read cue record: ${String(cause)}` }) });
  const problem = recordProblem(models, candidates, listedRedraws(), parseRecord(text)) ?? effectRecordProblem(text);
  if (problem !== undefined) return yield* new EffectCheckFailure({ problem });
  const unknowns = effectRecordUnknowns(text);
  for (const finding of unknowns) yield* Console.log(finding);
  yield* Console.log(`cue models: ${models.length} cue models and ${candidates.length} accents or projectiles recorded in both looks; Classic effect report has ${unknowns.length} Unknown uses awaiting calibration; no missing/invisible uses; MODEL-DATA visibility only`);
  const screenAt = process.argv.indexOf("--screen-captures"), captures = screenAt < 0 ? undefined : process.argv[screenAt + 1];
  if (screenAt >= 0 && captures === undefined) return yield* new EffectCheckFailure({ problem: "--screen-captures needs the native capture pack JSON" });
  const native = captures === undefined ? screenReport([], "0".repeat(64)) : yield* readScreenCaptures(captures);
  const acceptance = screenAcceptanceProblem(native);
  yield* Console.log(`native Classic acceptance (#496): ${native.rows.filter(row => row.status === "visible").length}/${native.rows.length} specials/ultimates visible; ${acceptance === undefined ? "screen footprint/duration accepted; motion/hit-region/cold-reader checks remain" : acceptance}`);
  if (process.argv.includes("--native") && acceptance !== undefined) return yield* new EffectCheckFailure({ problem: acceptance });
}));
