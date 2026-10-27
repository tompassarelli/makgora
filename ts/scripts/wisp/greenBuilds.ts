import { movesShardId, smokeShardIds, smokeShardLabel, smokeShards } from "./smokeShards";

export type Verdict = "success" | "failure" | "pending" | "missing";

export interface RunSummary {
  readonly status: string;
  readonly conclusion: string;
  readonly createdAt: string;
}

export interface Candidate {
  readonly sha: string;
  readonly build: number;
  readonly ci: Verdict;
  readonly farm: Verdict;
}

export const SHORT_COMMIT = 7;
export const PREDICT_COST = "--predict-cost";
export const costPrediction = (args: readonly string[]) => ({ predict: args.includes(PREDICT_COST), args: args.filter((arg) => arg !== PREDICT_COST) });

export const LANE_FILE = /^Smashcraft (\d+\.\d+(?:\.\d+)?)-([a-z0-9]+(?:-[a-z0-9]+)*)\.w3x$/;
export const PLAYABLE_FILE = /^Smashcraft (\d+\.\d+(?:\.\d+)?)(?:-dev\.(\d+)| RC-(\d+))?\.w3x$/;
export const buildLabel = (file: string) => PLAYABLE_FILE.test(file) ? file.slice("Smashcraft ".length, -".w3x".length) : undefined;


export function verdictOf(runs: readonly RunSummary[]): Verdict {
  const latest = runs.reduce<RunSummary | undefined>((best, run) => best === undefined || run.createdAt > best.createdAt ? run : best, undefined);
  if (latest === undefined) return "missing";
  if (latest.status !== "completed") return "pending";
  return latest.conclusion === "success" ? "success" : "failure";
}

export type LandingDecision = "build" | "wait" | "red";

export const landingDecision = (ci: Verdict): LandingDecision =>
  ci === "success" ? "build" : ci === "failure" ? "red" : "wait";

export const isGreen = ({ ci, farm }: Candidate): boolean => ci === "success" && farm === "success";

export interface AutolandStatus {
  readonly state: string;
  readonly description: string;
}

export function farmVerdict(sha: string, tree: string, exact: Verdict, statuses: readonly AutolandStatus[], passedTrees: readonly string[]): Verdict {
  if (exact !== "missing") return exact;
  const landed = statuses.some(({ state, description }) => state === "SUCCESS" && description === `landed as ${sha}`);
  const passed = statuses.some(({ state, description }) => state === "PENDING"
    && /^passed alone on [a-f0-9]{40} as tree [a-f0-9]{40}$/.test(description)
    && description.endsWith(` as tree ${tree}`));
  return landed || passed || passedTrees.includes(tree) ? "success" : "missing";
}

export function installName(version: string, build: number): string {
  return `Smashcraft ${version}-dev.${build}`;
}

export interface Installed {
  readonly version: readonly [number, number, number];
  readonly build: number | undefined;
  readonly candidate: number | undefined;
}

export function parseInstalled(file: string): Installed | undefined {
  const match = PLAYABLE_FILE.exec(file);
  if (match === null) return undefined;
  const [major = 0, minor = 0, patch = 0] = (match[1] ?? "").split(".").map(Number);
  return { version: [major, minor, patch], build: match[2] === undefined ? undefined : Number(match[2]), candidate: match[3] === undefined ? undefined : Number(match[3]) };
}

export function pickGreen(commits: readonly Candidate[], installed: readonly number[]): Candidate | undefined {
  const has = (build: number) => installed.includes(build);
  const index = commits.findIndex(isGreen);
  if (index === -1) return undefined;
  if (commits.slice(0, index + 1).some(({ build }) => has(build))) return undefined;
  return commits[index];
}

export type GreenStep =
  | { readonly kind: "install"; readonly candidate: Candidate }
  | { readonly kind: "hold"; readonly candidate: Candidate; readonly reason: string }
  | { readonly kind: "none" };

export function greenStep(commits: readonly Candidate[], installed: readonly number[], hold: string | undefined): GreenStep {
  const candidate = pickGreen(commits, installed);
  if (candidate === undefined) return { kind: "none" };
  if (hold !== undefined) return { kind: "hold", candidate, reason: hold };
  return { kind: "install", candidate };
}

export const GREEN_GATE_CHECKS: readonly string[] = [
  "gate-cursor-visible", "gate-start-anywhere", "gate-bindings", ...smokeShardIds(),
];
export const GREEN_GATE_LOOKS = ["classic"] as const;

export interface GreenGateReport {
  readonly candidateMapSha256: string;
  readonly graphicsLook: string;
  readonly results: readonly { readonly id: string; readonly verdict: string; readonly reason: string }[];
}

export interface GreenGateFailure {
  readonly look: string;
  readonly id: string;
  readonly reason: string;
}

export function greenGateFailures(mapSha256: string, declared: readonly string[], reports: readonly GreenGateReport[]): GreenGateFailure[] {
  const failures: GreenGateFailure[] = [];
  const required = [...new Set([...GREEN_GATE_CHECKS, ...declared])];
  for (const id of required) {
    if (!declared.includes(id)) failures.push({ look: "classic", id, reason: "gate check is not declared" });
  }
  for (const look of GREEN_GATE_LOOKS) {
    const matching = reports.filter(report => report.graphicsLook === look);
    if (matching.length === 0) {
      failures.push({ look, id: "gate-report", reason: "expected a report, found none" });
      continue;
    }
    if (matching.some(report => report.candidateMapSha256 !== mapSha256)) {
      failures.push({ look, id: "gate-map", reason: "report map SHA256 differs from the built candidate" });
      continue;
    }
    for (const id of required) {
      const results = matching.flatMap(report => report.results).filter(result => result.id === id);
      const result = results[0];
      if (results.length !== 1 || result === undefined) failures.push({ look, id, reason: `expected one result, found ${results.length}` });
      else if (result.verdict !== "pass") failures.push({ look, id, reason: `${result.verdict}: ${result.reason}` });
    }
  }
  return failures;
}

export interface SmokeShardReport {
  readonly shard: string;
  readonly run: string;
  readonly crash: boolean;
  readonly deadBindings: readonly string[];
  readonly movesNotStarted: readonly string[];
  readonly restart?: string;
}

export interface SmokeReport {
  readonly candidateMapSha256: string;
  readonly shards: readonly SmokeShardReport[];
}

export function smokeBlocks(mapSha256: string, smoke: SmokeReport | undefined): GreenGateFailure[] {
  if (smoke === undefined) return [{ look: "classic", id: "smoke", reason: "smoke crash: no move smoke report for the candidate" }];
  if (smoke.candidateMapSha256 !== mapSha256) return [{ look: "classic", id: "smoke", reason: "smoke crash: the move smoke report's map SHA256 differs from the built candidate" }];
  return smokeShards().flatMap((shard): GreenGateFailure[] => {
    const id = movesShardId(shard);
    const report = smoke.shards.find(item => item.shard === smokeShardLabel(shard));
    if (report === undefined) return [{ look: "classic", id, reason: "smoke crash: the shard has no smoke result" }];
    return [
      ...report.crash ? [{ look: "classic", id, reason: `smoke crash: ${report.run}` }] : [],
      ...report.deadBindings.map(step => ({ look: "classic", id, reason: `dead binding: ${step}` })),
      ...report.movesNotStarted.map(step => ({ look: "classic", id, reason: `move did not start: ${step}` })),
    ];
  });
}

export type GreenInstallState = "accepted" | "installed-unverified" | "pending-native" | "blocked";

export interface GreenInstallDecision {
  readonly state: GreenInstallState;
  readonly install: boolean;
}

export function greenInstallDecision(failures: readonly GreenGateFailure[], blocking: readonly GreenGateFailure[], unreadable: boolean, enforce: boolean): GreenInstallDecision {
  if (blocking.length > 0) return { state: "blocked", install: false };
  if (failures.length === 0) return { state: "accepted", install: true };
  if (!enforce) return { state: "installed-unverified", install: true };
  return { state: unreadable ? "pending-native" : "blocked", install: false };
}
