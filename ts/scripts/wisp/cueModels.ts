import { effectUses, effectUseDigest, effectSourceDigest, type EffectVerdict, type EffectFinding } from "./effectVisibility";
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


export function formatEffectRecord(report: { readonly source: string; readonly provenance: string; readonly findings: readonly EffectFinding[] }): string {
  return `classic-source\t${report.source}\t${report.provenance}\n` + report.findings.map(({ status, reason, ...use }) => `classic-use\t${effectUseDigest(use)}\t${status}\t${report.provenance}\t${reason.replace(/[\t\r\n]/g, " ")}\n`).sort().join("");
}

export function effectRecordProblem(text: string): string | undefined {
  const header = text.split("\n").find((line) => line.startsWith("classic-source\t"))?.split("\t");
  const digest = /^[0-9a-f]{64}$/;
  if (header?.[1] !== effectSourceDigest() || !digest.test(header[2] ?? "")) return "Classic effect record is missing or stale; record one exact24268 cache with bun scripts/cueModels.ts --record --stock-cache DIRECTORY";
  const records = new Map<string, EffectVerdict["status"]>();
  for (const line of text.split("\n")) {
    const [kind, key, status, provenance] = line.split("\t");
    if (kind !== "classic-use" || key === undefined || provenance !== header[2]) continue;
    if (status === "visible" || status === "invisible" || status === "unknown") records.set(key, status);
  }
  const refused = effectUses().filter((use) => {
    const status = records.get(effectUseDigest(use));
    return status === undefined || status === "invisible";
  });
  return refused.length === 0 ? undefined : `Classic effects: ${refused.length} missing/invisible uses refuse the gate: ${refused.map((use) => `${use.fighter}/${use.move}`).join("; ")}`;
}

export function effectRecordUnknowns(text: string): string[] {
  const records = new Map(text.split("\n").flatMap((line) => {
    const [kind, key, status, , reason] = line.split("\t");
    return kind === "classic-use" && key !== undefined && status === "unknown" ? [[key, reason ?? "reason not recorded"] as const] : [];
  }));
  return effectUses().flatMap((use) => {
    const reason = records.get(effectUseDigest(use));
    return reason === undefined ? [] : [`${use.fighter}\t${use.move}\tUnknown\t${use.model}\t${reason}`];
  });
}
