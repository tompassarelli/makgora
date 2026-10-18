export type Verdict = "success" | "failure" | "pending" | "missing";

export interface RunSummary {
  readonly status: string;
  readonly conclusion: string;
  readonly createdAt: string;
}

export interface Candidate {
  readonly sha: string;
  readonly ci: Verdict;
  readonly farm: Verdict;
}

export const SHORT_COMMIT = 7;
export const PREDICT_COST = "--predict-cost";
export const costPrediction = (args: readonly string[]) => ({ predict: args.includes(PREDICT_COST), args: args.filter((arg) => arg !== PREDICT_COST) });

export const LANE_FILE = /^Smashcraft (\d+\.\d+\.\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)\.w3x$/;
export const PLAYABLE_FILE = /^Smashcraft (\d+\.\d+\.\d+)(?: ([0-9a-f]{7,40}))?\.w3x$/;


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

export function installName(version: string, sha: string): string {
  return `Smashcraft ${version} ${sha.slice(0, SHORT_COMMIT)}`;
}

export interface Installed {
  readonly version: readonly [number, number, number];
  readonly commit: string | undefined;
}

export function parseInstalled(file: string): Installed | undefined {
  const match = PLAYABLE_FILE.exec(file);
  if (match === null) return undefined;
  const [major = 0, minor = 0, patch = 0] = (match[1] ?? "").split(".").map(Number);
  return { version: [major, minor, patch], commit: match[2] };
}

export function pickGreen(commits: readonly Candidate[], installed: readonly string[]): Candidate | undefined {
  const has = (sha: string) => installed.some((commit) => commit.length > 0 && sha.startsWith(commit));
  const index = commits.findIndex(isGreen);
  if (index === -1) return undefined;
  if (commits.slice(0, index + 1).some(({ sha }) => has(sha))) return undefined;
  return commits[index];
}

export const GREEN_GATE_CHECKS = [
  "gate-cursor-visible", "gate-start-anywhere", "gate-bindings", "gate-moves", "gate-specials-spot",
] as const;
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
    const report = matching[0];
    if (matching.length !== 1 || report === undefined) {
      failures.push({ look, id: "gate-report", reason: `expected one report, found ${matching.length}` });
      continue;
    }
    if (report.candidateMapSha256 !== mapSha256) {
      failures.push({ look, id: "gate-map", reason: "report map SHA256 differs from the built candidate" });
      continue;
    }
    for (const id of required) {
      const results = report.results.filter(result => result.id === id);
      const result = results[0];
      if (results.length !== 1 || result === undefined) failures.push({ look, id, reason: `expected one result, found ${results.length}` });
      else if (result.verdict !== "pass") failures.push({ look, id, reason: `${result.verdict}: ${result.reason}` });
    }
  }
  return failures;
}
