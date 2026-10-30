import { createHash } from "node:crypto";
import { effectUses, judgeUse, modelFactsKey, calibrationProblem, EFFECT_CALIBRATION, FACTS_VERSION, type EffectUse, type EffectFinding, type ModelFacts } from "./effectVisibility";
import { fighterCueList, MISSING_CUE_MODEL } from "../../src/game/presentation/specialCues";
import { allAttackCueModels } from "../../src/game/presentation/attackCues";
import { allProjectileModels } from "../../src/game/presentation/projectileArt";
import { Character } from "../../src/game/sim/codes";
import { shipsInMap } from "../../src/game/roster/kits";
import { METER_CUES, ultimateBurst } from "../../src/game/presentation/meterCues";
import { RECORD_COMMAND } from "./cueInputs";

export const cueModels = (characters: readonly Character[] = Object.values(Character)) => [...new Set([...characters.flatMap(character => fighterCueList(character).map(cue => cue.model)), ...allAttackCueModels(), ...allProjectileModels(), ...METER_CUES.map(cue => cue.model), ...characters.map(character => ultimateBurst(character).model), MISSING_CUE_MODEL])];

export const mapCueModels = () => cueModels(Object.values(Character).filter(shipsInMap));


const factRows = (text: string): string[] => text.split("\n").filter((line) => line.startsWith("classic-model\t"));
const rowDigest = (cacheInfo: string, row: string): string => createHash("sha256").update(`${FACTS_VERSION}\t${cacheInfo}\t${row}`).digest("hex");
const encodeFacts = (facts: ModelFacts | null): string => JSON.stringify(facts, (_, value: unknown) => typeof value === "number" && !Number.isFinite(value) ? { number: String(value) } : value);
const decodeFacts = (text: string): ModelFacts | null => JSON.parse(text, (_, value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 1 && typeof (value as { number?: unknown }).number === "string" ? Number((value as { number: string }).number) : value) as ModelFacts | null;

export function formatEffectRecord(report: { readonly cacheInfo: string; readonly models: ReadonlyMap<string, string>; readonly facts: ReadonlyMap<string, ModelFacts | null> }): string {
  const rows = [...report.facts].map(([model, facts]) => `classic-model\t${modelFactsKey(model)}\t${report.models.get(model) ?? "unread"}\t${encodeFacts(facts)}`).sort();
  return `classic-facts\t${FACTS_VERSION}\t${report.cacheInfo}\n` + rows.map((row) => `${row}\t${rowDigest(report.cacheInfo, row)}\n`).join("");
}

type RecordedFacts = { readonly problem: string } | { readonly facts: ReadonlyMap<string, ModelFacts | null> };

export function recordedFacts(text: string): RecordedFacts {
  const headers = text.split("\n").filter((line) => line.startsWith("classic-facts\t")).map((line) => line.split("\t"));
  const header = headers[0];
  if (headers.length !== 1 || header?.[1] !== String(FACTS_VERSION) || !/^[0-9a-f]{64}$/.test(header[2] ?? "")) return { problem: `Classic effect record is missing or stale: it holds no model facts from extractor version ${FACTS_VERSION}; from ts/ on a machine with the Warcraft III 3.0.0.24268 or 3.0.1.24371 install run ${RECORD_COMMAND} and commit the record` };
  const facts = new Map<string, ModelFacts | null>();
  let edited = 0;
  for (const line of factRows(text)) {
    const at = line.lastIndexOf("\t"), row = line.slice(0, at), [, key, , json] = row.split("\t");
    if (line.slice(at + 1) !== rowDigest(header[2] ?? "", row) || key === undefined || json === undefined) { edited++; continue; }
    facts.set(key, decodeFacts(json));
  }
  return edited > 0 ? { problem: `Classic effect record has ${edited} model facts rows edited by hand or extracted by another extractor version or cache; re-record them with ${RECORD_COMMAND}` } : { facts };
}

export function effectFindings(text: string, uses: readonly EffectUse[] = effectUses()): { readonly problem: string } | { readonly findings: readonly EffectFinding[] } {
  const recorded = recordedFacts(text);
  if ("problem" in recorded) return recorded;
  const unrecorded = uses.filter((use) => !recorded.facts.has(modelFactsKey(use.model)));
  if (unrecorded.length > 0) {
    const models = [...new Set(unrecorded.map((use) => modelFactsKey(use.model)))];
    return { problem: `Classic effect record is missing or stale: no model facts for ${models.length} newly used models; from ts/ on a machine with the Warcraft III 3.0.0.24268 or 3.0.1.24371 install run ${RECORD_COMMAND} and commit the record: ${models.map((model) => `${model} (${unrecorded.filter((use) => modelFactsKey(use.model) === model).map((use) => `${use.fighter}/${use.move}`).join(", ")})`).join("; ")}` };
  }
  return { findings: uses.map((use) => judgeUse(use, recorded.facts.get(modelFactsKey(use.model)) ?? null)) };
}

export function effectRecordProblem(text: string, uses: readonly EffectUse[] = effectUses()): string | undefined {
  const judged = effectFindings(text, uses);
  if ("problem" in judged) return judged.problem;
  const refused = judged.findings.filter(({ status }) => status === "invisible");
  return refused.length === 0 ? undefined : `Classic effects: ${refused.length} invisible uses refuse the gate: ${refused.map((use) => `${use.fighter}/${use.move}`).join("; ")}`;
}

export function effectRecordUnknowns(text: string, uses: readonly EffectUse[] = effectUses()): string[] {
  const judged = effectFindings(text, uses);
  return "problem" in judged ? [] : judged.findings.filter(({ status }) => status === "unknown").map((use) => `${use.fighter}\t${use.move}\tUnknown\t${use.model}\t${use.reason}`);
}

export function effectCalibrationProblem(text: string): string | undefined {
  const judged = effectFindings(text, EFFECT_CALIBRATION.map(({ use }) => use));
  return "problem" in judged ? judged.problem : calibrationProblem(judged.findings);
}

export function staleRecordRows(recorded: string, fresh: string): string[] {
  const keyed = (text: string) => new Map([...text.split("\n").filter((line) => line.startsWith("classic-facts\t")).map((line): [string, string] => ["classic-facts", line]), ...factRows(text).map((line): [string, string] => [line.split("\t")[1] ?? line, line])]);
  const now = keyed(fresh), then = keyed(recorded);
  return [...new Set([...then.keys(), ...now.keys()])].filter((key) => then.get(key) !== now.get(key)).sort();
}
