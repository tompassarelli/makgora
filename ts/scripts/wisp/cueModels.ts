import { createHash } from "node:crypto";
import { effectUses, judgeUse, modelFactsKey, FACTS_VERSION, type EffectUse, type EffectFinding, type ModelFacts } from "./effectVisibility";
import { fighterCueList, MISSING_CUE_MODEL } from "../../src/game/presentation/specialCues";
import { allAttackCueModels } from "../../src/game/presentation/attackCues";
import { DEFINITIVE_ACCENT_REDRAWS, DISJOINT_CUES } from "../../src/game/presentation/disjointCues";
import { DEFINITIVE_PROJECTILE_REDRAWS, allProjectileModels } from "../../src/game/presentation/projectileArt";
import { Character } from "../../src/game/sim/codes";

export type Look = "same" | "redrawn";

export const CUE_MODEL_RECORD = "ts/scripts/wisp/cue-models.tsv";
export const RECORD_COMMAND = "bun scripts/cueModels.ts --record --stock-cache DIRECTORY";

export const cueModels = () => [...new Set([...Object.values(Character).flatMap(character => fighterCueList(character).map(cue => cue.model)), ...allAttackCueModels(), ...allProjectileModels(), MISSING_CUE_MODEL])];

export const redrawCandidates = () => [...new Set([...Object.values(DISJOINT_CUES).map(cue => cue.model), ...allProjectileModels()])];

export const listedRedraws = (): { readonly [model: string]: string } => ({ ...DEFINITIVE_ACCENT_REDRAWS, ...DEFINITIVE_PROJECTILE_REDRAWS });

export function unlistedRedraws(candidates: readonly string[], listed: { readonly [model: string]: string }, looks: ReadonlyMap<string, Look>): string[] {
  return candidates.filter(model => listed[model] === undefined && looks.get(model) === "redrawn");
}

export const redrawProblem = (redrawn: readonly string[]) => `Definitive redraws these contact accents or projectiles as different models; review each in Definitive and list it in DEFINITIVE_ACCENT_REDRAWS (disjointCues.ts) or DEFINITIVE_PROJECTILE_REDRAWS (projectileArt.ts), or choose another: ${redrawn.join("; ")}`;

export function recordProblem(models: readonly string[], candidates: readonly string[], listed: { readonly [model: string]: string }, looks: ReadonlyMap<string, Look>): string | undefined {
  const unrecorded = [...new Set([...models, ...candidates])].filter(model => !looks.has(model));
  if (unrecorded.length > 0) return `No Classic and Definitive check is recorded in ${CUE_MODEL_RECORD} for these cue, accent or projectile models; from ts/ on a machine with the render-asset cache run ${RECORD_COMMAND} and commit the record: ${unrecorded.join("; ")}`;
  const redrawn = unlistedRedraws(candidates, listed, looks);
  return redrawn.length > 0 ? redrawProblem(redrawn) : undefined;
}

export function parseRecord(text: string): Map<string, Look> {
  return new Map(text.split("\n").flatMap(line => {
    const [look, model] = line.split("\t");
    return (look === "same" || look === "redrawn") && model !== undefined && model.length > 0 ? [[model, look] as const] : [];
  }));
}

export function formatRecord(looks: ReadonlyMap<string, Look>): string {
  return [...looks].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([model, look]) => `${look}\t${model}\n`).join("");
}

export function touchesCueInputs(paths: readonly string[], inputs: ReadonlySet<string>): boolean {
  return paths.some(path => inputs.has(path) || [...inputs].some(input => input.endsWith("/") && path.startsWith(input)));
}


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
  if (headers.length !== 1 || header?.[1] !== String(FACTS_VERSION) || !/^[0-9a-f]{64}$/.test(header[2] ?? "")) return { problem: `Classic effect record is missing or stale: it holds no model facts from extractor version ${FACTS_VERSION}; from ts/ on a machine with the exact24268 cache run ${RECORD_COMMAND} and commit the record` };
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
    return { problem: `Classic effect record is missing or stale: no model facts for ${models.length} newly used models; from ts/ on a machine with the exact24268 cache run ${RECORD_COMMAND} and commit the record: ${models.map((model) => `${model} (${unrecorded.filter((use) => modelFactsKey(use.model) === model).map((use) => `${use.fighter}/${use.move}`).join(", ")})`).join("; ")}` };
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
