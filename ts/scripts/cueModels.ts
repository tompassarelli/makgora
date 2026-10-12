import { join } from "node:path";
import { Effect } from "effect";
import { CUE_MODEL_RECORD, cueModels, formatRecord, listedRedraws, parseRecord, recordProblem, redrawCandidates } from "./wisp/cueModels";

const record = join(import.meta.dir, "../..", CUE_MODEL_RECORD);
const models = cueModels(), candidates = redrawCandidates();

if (process.argv.includes("--record")) {
  const { cueModelLooks } = await import("./wisp/headlessRender");
  const looks = await Effect.runPromise(cueModelLooks());
  await Bun.write(record, formatRecord(looks));
  console.log(`cue models: recorded ${looks.size} models in ${CUE_MODEL_RECORD}`);
}

const file = Bun.file(record);
const problem = recordProblem(models, candidates, listedRedraws(), parseRecord(await file.exists() ? await file.text() : ""));
if (problem !== undefined) {
  console.error(problem);
  process.exit(1);
}
console.log(`cue models: ${models.length} cue models and ${candidates.length} accents or projectiles recorded in both looks`);
