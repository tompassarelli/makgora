import { join } from "node:path";
import { Console, Effect } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { EffectCheckFailure, readEffectReport, CALIBRATION_SUMMARY, EFFECT_CALIBRATION } from "./wisp/effectVisibility";
import { CUE_MODEL_RECORD, cueModels, formatRecord, listedRedraws, parseRecord, recordProblem, redrawCandidates, formatEffectRecord, effectRecordProblem, effectRecordUnknowns, effectFindings, effectCalibrationProblem } from "./wisp/cueModels";
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
    yield* Console.log(`cue models: recorded ${looks.size} models and Classic facts for ${report.facts.size} models in ${CUE_MODEL_RECORD}`);
  }
  const text = yield* Effect.tryPromise({ try: async () => await Bun.file(record).exists() ? await Bun.file(record).text() : "", catch: (cause) => new EffectCheckFailure({ problem: `read cue record: ${String(cause)}` }) });
  if (process.argv.includes("--verdicts")) {
    const judged = effectFindings(text);
    for (const finding of "findings" in judged ? judged.findings : []) yield* Console.log(`${finding.fighter}\t${finding.move}\t${finding.model}\t${finding.status}\t${finding.reason.replace(/[\t\r\n]/g, " ")}`);
    const calibration = effectFindings(text, EFFECT_CALIBRATION.map(({ use }) => use));
    for (const [index, finding] of ("findings" in calibration ? calibration.findings : []).entries()) yield* Console.log(`calibration ${EFFECT_CALIBRATION[index]?.expect ?? ""}\t${finding.fighter}\t${finding.move}\t${finding.model}\t${finding.status}\t${finding.reason}`);
  }
  const problem = recordProblem(models, candidates, listedRedraws(), parseRecord(text)) ?? effectRecordProblem(text) ?? effectCalibrationProblem(text);
  if (problem !== undefined) return yield* new EffectCheckFailure({ problem });
  const unknowns = effectRecordUnknowns(text);
  for (const finding of unknowns) yield* Console.log(finding);
  yield* Console.log(CALIBRATION_SUMMARY);
  yield* Console.log(`cue models: ${models.length} cue models and ${candidates.length} accents or projectiles recorded in both looks; Classic effect report has ${unknowns.length} Unknown uses awaiting calibration; no missing/invisible uses; MODEL-DATA visibility only`);
  const screenAt = process.argv.indexOf("--screen-captures"), captures = screenAt < 0 ? undefined : process.argv[screenAt + 1];
  if (screenAt >= 0 && captures === undefined) return yield* new EffectCheckFailure({ problem: "--screen-captures needs the native capture pack JSON" });
  const native = captures === undefined ? screenReport([], "0".repeat(64)) : yield* readScreenCaptures(captures);
  const acceptance = screenAcceptanceProblem(native);
  yield* Console.log(`native Classic acceptance (#496): ${native.rows.filter(row => row.status === "visible").length}/${native.rows.length} specials/ultimates visible; ${acceptance === undefined ? "screen footprint/duration accepted; motion/hit-region/cold-reader checks remain" : acceptance}`);
  if (process.argv.includes("--native") && acceptance !== undefined) return yield* new EffectCheckFailure({ problem: acceptance });
}));
