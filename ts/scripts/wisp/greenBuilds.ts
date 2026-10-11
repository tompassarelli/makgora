export type Verdict = "success" | "failure" | "pending" | "missing";

export interface Candidate {
  readonly sha: string;
  readonly farm: Verdict;
}

export const SHORT_COMMIT = 7;
export const PLAYTEST_COST_SUFFIXES = [".lua-cost.json", ".lua-cost.perf"] as const;

export const PLAYABLE_FILE = /^Smashcraft (\d+\.\d+\.\d+)(?: ([0-9a-f]{7,40}))?\.w3x$/;

export const KEPT_PRIOR_VERSIONS = 2;

export const isGreen = ({ farm }: Candidate): boolean => farm === "success";

export interface FullSuiteEvidence {
  readonly sha: string;
  readonly statuses: readonly { readonly context: string; readonly state: string }[];
}

export function fullSuiteVerdict(sha: string, evidence: readonly FullSuiteEvidence[]): Verdict {
  const statuses = evidence.filter(item => item.sha === sha).flatMap(item => item.statuses)
    .filter(({ context }) => context === "farm-full");
  if (statuses.length !== 1) return "missing";
  switch (statuses[0]?.state) {
    case "SUCCESS": return "success";
    case "PENDING": case "EXPECTED": return "pending";
    case "FAILURE": case "ERROR": return "failure";
    default: return "missing";
  }
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

const newerVersion = (a: Installed, b: Installed): number =>
  b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2];

export function pickGreen(commits: readonly Candidate[], installed: readonly string[]): Candidate | undefined {
  const has = (sha: string) => installed.some((commit) => commit.length > 0 && sha.startsWith(commit));
  const index = commits.findIndex(isGreen);
  if (index === -1) return undefined;
  if (commits.slice(0, index + 1).some(({ sha }) => has(sha))) return undefined;
  return commits[index];
}

export function pruneTargets(present: readonly string[], keep: string): string[] {
  const versions = present.flatMap((file) => {
    const parsed = file === keep ? undefined : parseInstalled(file);
    return parsed === undefined ? [] : [{ file, parsed }];
  });
  versions.sort((a, b) => newerVersion(a.parsed, b.parsed) || (a.file < b.file ? 1 : a.file > b.file ? -1 : 0));
  return versions.slice(KEPT_PRIOR_VERSIONS).map(({ file }) => file);
}

export const GREEN_GATE_CHECKS = [
  "gate-cursor-visible", "gate-start-anywhere", "gate-bindings", "gate-specials-spot",
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
