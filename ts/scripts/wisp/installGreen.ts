import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { currentPlaytest } from "./currentPlaytest";
import { SMASHCRAFT_ACCEPT } from "./acceptChecks";
import { GREEN_GATE_LOOKS, greenGateFailures, type GreenGateReport, type Candidate, isGreen, parseInstalled, pickGreen } from "./greenBuilds";
import { installLatest } from "./mapLibrary";
import { fullGreenMain } from "./fullGreenMain";

const GateReport = Schema.Struct({
  candidateMapSha256: Schema.String,
  graphicsLook: Schema.Literals(["classic"]),
  results: Schema.Array(Schema.Struct({ id: Schema.String, verdict: Schema.Literals(["pass", "fail", "needs-look"]), reason: Schema.String })),
});
const decodeGateReport = Schema.decodeUnknownEffect(Schema.fromJsonString(GateReport));
const greenState = join(homedir(), ".local/state/smashcraft/green-builds");

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });

function installedCommits(documents: string): string[] {
  const root = join(documents, "Maps/00-Smashcraft");
  return [root, join(root, "older")].flatMap((folder) => existsSync(folder) ? readdirSync(folder) : [])
    .flatMap((file) => parseInstalled(file)?.commit ?? []);
}

export const installAcceptedGreen = (documents: string, map: string, revision: string, declared: readonly string[], stateDirectory = greenState) => Effect.gen(function*() {
  const mapSha256 = yield* Effect.try({
    try: () => createHash("sha256").update(readFileSync(map)).digest("hex"), catch: (cause) => new PlayProblem({ problem: String(cause) }),
  });
  const reports: GreenGateReport[] = [];
  const unreadable: { look: string; id: string; reason: string }[] = [];
  for (const look of GREEN_GATE_LOOKS) {
    const file = join(stateDirectory, "accept", mapSha256, look, "report.json");
    const report = yield* Effect.tryPromise({ try: () => Bun.file(file).text(), catch: (cause) => new PlayProblem({ problem: `${file}: ${String(cause)}` }) }).pipe(
      Effect.flatMap(text => decodeGateReport(text).pipe(Effect.mapError(problem))), Effect.result,
    );
    if (report._tag === "Success") reports.push(report.success);
    else unreadable.push({ look, id: "gate-report", reason: report.failure.problem });
  }
  const failures = [...unreadable, ...greenGateFailures(mapSha256, declared, reports)];
  yield* Effect.try({
    try: () => {
      mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
      const status = join(stateDirectory, "status.json");
      const staged = `${status}.${process.pid}.next`;
      writeFileSync(staged, `${JSON.stringify({ revision, candidate: map, candidateMapSha256: mapSha256,
        state: failures.length === 0 ? "accepted" : unreadable.length > 0 ? "pending-native" : "blocked", failures,
        acceptanceDirectory: join(stateDirectory, "accept", mapSha256) }, null, 2)}\n`, { mode: 0o600 });
      renameSync(staged, status);
    }, catch: (cause) => new PlayProblem({ problem: String(cause) }),
  });
  if (failures.length > 0) return yield* new PlayProblem({ problem: `Kept last good installed map: ${failures.map(({ look, id, reason }) => `${look} ${id}: ${reason}`).join("; ")}; status ${join(stateDirectory, "status.json")}` });
  yield* Effect.try({ try: () => installLatest(documents, map), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
});

const acceptedBuild = (documents: string, candidate: Candidate) => Effect.gen(function*() {
  const current = yield* currentPlaytest(join(documents, "Maps/00-Smashcraft"), { revision: candidate.sha, named: true, helper: false });
  const fresh = yield* fullGreenMain;
  const installed = installedCommits(documents).filter(commit => !candidate.sha.startsWith(commit));
  if (pickGreen(fresh, installed)?.sha !== candidate.sha) return yield* new PlayProblem({ problem: "Kept installed map: full-green selection changed while building" });
  yield* installAcceptedGreen(documents, current.map.source, candidate.sha, SMASHCRAFT_ACCEPT.checks.filter(({ id }) => id.startsWith("gate-")).map(({ id }) => id));
  return current;
});

export const installGreen = (documents: string, dryRun = false) => Effect.gen(function*() {
  const considered = yield* fullGreenMain;

  const installed = installedCommits(documents);
  const pick = pickGreen(considered, installed);
  if (dryRun) {
    console.log(`Dry run: newest green main ${considered.find(isGreen)?.sha ?? "none"}; ${pick === undefined ? "no install (already installed, newer installed, or no green commit)" : `would stage ${pick.sha}; install requires exact candidate gate-* PASS in Classic`}`);
    return;
  }

  if (pick === undefined) {
    console.log(considered.some(isGreen)
      ? "The newest green commit on main is already installed (or an installed build is newer)"
      : `No green commit among the newest ${considered.length} on main (${considered.map(({ sha, farm }) => `${sha.slice(0, 7)} farm-full ${farm}`).join("; ")})`);
    return;
  }

  const { map } = yield* acceptedBuild(documents, pick);
  console.log(`Installed ${map.title} under Maps/${map.folder}`);
});

export const playGreen = (documents: string) => Effect.gen(function*() {
  const considered = yield* fullGreenMain;
  const candidate = considered.find(isGreen);
  if (candidate === undefined) return yield* new PlayProblem({ problem: "No exact farm-full success on recent main" });
  const installed = installedCommits(documents).filter(commit => !candidate.sha.startsWith(commit));
  if (pickGreen(considered, installed) === undefined) return yield* new PlayProblem({ problem: "Kept newer installed map while full suite is pending" });
  return yield* acceptedBuild(documents, candidate);
});
