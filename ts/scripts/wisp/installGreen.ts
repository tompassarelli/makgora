import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { currentPlaytest, playName } from "./currentPlaytest";
import { SMASHCRAFT_ACCEPT } from "./acceptChecks";
import { GREEN_GATE_LOOKS, greenGateFailures, type GreenGateReport, type Candidate, type RunSummary, buildLabel, farmVerdict, greenStep, isGreen, parseInstalled, verdictOf } from "./greenBuilds";
import { installLatest, installedMaps } from "./mapLibrary";
import { checklistPath, writePlaytestChecklist } from "./playtestChecklist";
import { projectRoot } from "./project";
import { clientHold } from "./runningGames";

const COMMITS_CONSIDERED = 20;
const FARM_RUNS_LISTED = 200;

const Runs = Schema.Array(Schema.Struct({
  displayTitle: Schema.String,
  status: Schema.String,
  conclusion: Schema.String,
  createdAt: Schema.String,
  headSha: Schema.String,
}));
const decodeRuns = Schema.decodeUnknownEffect(Schema.fromJsonString(Runs));

const Evidence = Schema.Array(Schema.Struct({
  oid: Schema.String,
  tree: Schema.Struct({ oid: Schema.String }),
  status: Schema.NullOr(Schema.Struct({ contexts: Schema.Array(Schema.Struct({
    context: Schema.String, state: Schema.String, description: Schema.NullOr(Schema.String),
  })) })),
}));
const decodeEvidence = Schema.decodeUnknownEffect(Schema.fromJsonString(Evidence));

const GateReport = Schema.Struct({
  candidateMapSha256: Schema.String,
  graphicsLook: Schema.Literals(["classic"]),
  results: Schema.Array(Schema.Struct({ id: Schema.String, verdict: Schema.Literals(["pass", "fail", "needs-look"]), reason: Schema.String })),
});
const decodeGateReport = Schema.decodeUnknownEffect(Schema.fromJsonString(GateReport));
export const greenState = join(homedir(), ".local/state/smashcraft/green-builds");

export const gateReportFiles = (directory: string): string[] => existsSync(directory)
  ? [join(directory, "report.json"), ...readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(directory, entry.name, "report.json"))].filter(file => existsSync(file))
  : [];

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });

const host = (program: string, args: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd: projectRoot, stdin: "ignore" })).pipe(Effect.mapError(problem));

const runs = (args: readonly string[]) => host("gh", ["run", "list", ...args, "--json", "displayTitle,status,conclusion,createdAt,headSha"]).pipe(
  Effect.flatMap((text) => decodeRuns(text).pipe(Effect.mapError(problem))),
);

const writeStatus = (stateDirectory: string, status: object) => Effect.try({
  try: () => {
    mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
    const file = join(stateDirectory, "status.json");
    const staged = `${file}.${process.pid}.next`;
    writeFileSync(staged, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
    renameSync(staged, file);
  }, catch: (cause) => new PlayProblem({ problem: String(cause) }),
});

const hold = (revision: string, reason: string, stateDirectory = greenState) =>
  writeStatus(stateDirectory, { revision, state: "held-running-client", reason }).pipe(Effect.map(() => console.log(`Held ${revision.slice(0, 7)}: ${reason}`)));

const summary = ({ status, conclusion, createdAt }: RunSummary): RunSummary => ({ status, conclusion, createdAt });

function installedBuilds(documents: string) {
  return installedMaps(documents).flatMap((file) => parseInstalled(file) ?? []);
}

const installedCommits = (documents: string): string[] => installedBuilds(documents).flatMap(({ commit }) => commit ?? []);

/** The commit of the newest installed numbered build, the base of the next playtest checklist. */
function previousInstalled(documents: string): string | undefined {
  const [newest] = installedBuilds(documents).filter(({ commit }) => commit !== undefined)
    .sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2]);
  return newest?.commit;
}

export const installAcceptedGreen = (documents: string, map: string, revision: string, declared: readonly string[], stateDirectory = greenState, enforce = process.env.SMASHCRAFT_GREEN_GATE === "enforce") => Effect.gen(function*() {
  const mapSha256 = yield* Effect.try({
    try: () => createHash("sha256").update(readFileSync(map)).digest("hex"), catch: (cause) => new PlayProblem({ problem: String(cause) }),
  });
  const reports: GreenGateReport[] = [];
  const unreadable: { look: string; id: string; reason: string }[] = [];
  for (const look of GREEN_GATE_LOOKS) {
    for (const file of gateReportFiles(join(stateDirectory, "accept", mapSha256, look))) {
      const report = yield* Effect.tryPromise({ try: () => Bun.file(file).text(), catch: (cause) => new PlayProblem({ problem: `${file}: ${String(cause)}` }) }).pipe(
        Effect.flatMap(text => decodeGateReport(text).pipe(Effect.mapError(problem))), Effect.result,
      );
      if (report._tag === "Success") reports.push(report.success);
      else unreadable.push({ look, id: "gate-report", reason: report.failure.problem });
    }
  }
  const failures = [...unreadable, ...greenGateFailures(mapSha256, declared, reports)];
  yield* writeStatus(stateDirectory, { revision, candidate: map, candidateMapSha256: mapSha256,
    state: failures.length === 0 ? "accepted" : !enforce ? "installed-unverified" : unreadable.length > 0 ? "pending-native" : "blocked", failures,
    acceptanceDirectory: join(stateDirectory, "accept", mapSha256) });
  if (enforce && failures.length > 0) return yield* new PlayProblem({ problem: `Kept last good installed map: ${failures.map(({ look, id, reason }) => `${look} ${id}: ${reason}`).join("; ")}; status ${join(stateDirectory, "status.json")}` });
  yield* Effect.try({ try: () => installLatest(documents, map), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
});

export const greenMain = Effect.gen(function*() {
  yield* host("git", ["fetch", "origin", "main"]);
  const listed = yield* host("git", ["rev-list", "--first-parent", "-n", String(COMMITS_CONSIDERED), "origin/main"]);
  const shas = listed.split("\n").filter((sha) => /^[a-f0-9]{40}$/.test(sha));
  if (shas.length === 0) return yield* new PlayProblem({ problem: "origin/main lists no commits" });

  const farmRuns = yield* runs(["--workflow", "farm-test.yml", "--limit", String(FARM_RUNS_LISTED)]);
  const autolandRuns = yield* runs(["--workflow", "autoland.yml", "--limit", String(FARM_RUNS_LISTED)]);
  const farmShas = farmRuns.flatMap(({ displayTitle }) => /^Farm test ([a-f0-9]{40}) /.exec(displayTitle)?.[1] ?? []);
  const laneShas = autolandRuns.flatMap(({ headSha, displayTitle }) => [headSha, ...displayTitle.match(/\b[a-f0-9]{40}\b/g) ?? []]);
  const evidenceShas = [...new Set([...shas, ...farmShas, ...laneShas])];
  const fields = evidenceShas.map((sha, i) => `c${i}:object(expression:"${sha}"){... on Commit{oid tree{oid} status{contexts{context state description}}}}`).join(" ");
  const evidence = yield* host("gh", ["api", "graphql", "-f", `query={repository(owner:"tompassarelli",name:"smashcraft"){${fields}}}`, "--jq", "[.data.repository[] | select(. != null)]"]).pipe(
    Effect.flatMap((text) => decodeEvidence(text).pipe(Effect.mapError(problem))),
  );
  const statuses = evidence.flatMap(({ status }) => (status?.contexts ?? [])
    .flatMap(({ context, state, description }) => context === "autoland" && description !== null ? [{ state, description }] : []));
  const passedTrees = evidence.filter(({ oid }) => verdictOf(farmRuns.filter(({ displayTitle }) => displayTitle.startsWith(`Farm test ${oid} `))) === "success")
    .map(({ tree }) => tree.oid);
  const considered: Candidate[] = [];
  for (const sha of shas) {
    const ci = verdictOf((yield* runs(["--workflow", "ci.yml", "--commit", sha, "--limit", "20"])).map(summary));
    const exact = verdictOf(farmRuns.filter(({ displayTitle }) => displayTitle.startsWith(`Farm test ${sha} `)).map(summary));
    const tree = evidence.find(({ oid }) => oid === sha)?.tree.oid;
    const farm = tree === undefined ? exact : farmVerdict(sha, tree, exact, statuses, passedTrees);
    considered.push({ sha, ci, farm });
    if (ci === "success" && farm === "success") break;
  }
  return considered;
});

export const installGreen = <E, R>(documents: string, dryRun: boolean, controller: Effect.Effect<string, E, R>) => Effect.gen(function*() {
  const considered = yield* greenMain;

  const installed = installedCommits(documents);
  const step = greenStep(considered, installed, yield* clientHold(documents));
  if (dryRun) {
    console.log(`Dry run: newest green main ${considered.find(isGreen)?.sha ?? "none"}; ${step.kind === "none" ? "no install (already installed, newer installed, or no green commit)" : step.kind === "hold" ? `would hold ${step.candidate.sha}: ${step.reason}` : `would stage ${step.candidate.sha}; install requires exact candidate gate-* PASS in Classic`}`);
    if (step.kind === "install") console.log(`Dry run: would write playtest notes ${checklistPath(buildLabel(`${yield* playName(step.candidate.sha)}.w3x`) ?? step.candidate.sha)} for ${previousInstalled(documents) ?? `${step.candidate.sha.slice(0, 7)}^`}..${step.candidate.sha.slice(0, 7)}`);
    return;
  }

  if (step.kind === "none") {
    console.log(considered.some(isGreen)
      ? "The newest green commit on main is already installed (or an installed build is newer)"
      : `No green commit among the newest ${considered.length} on main (${considered.map(({ sha, ci, farm }) => `${sha.slice(0, 7)} ci ${ci} farm ${farm}`).join("; ")})`);
    return;
  }
  if (step.kind === "hold") return yield* hold(step.candidate.sha, step.reason);

  const pick = step.candidate;
  const previous = previousInstalled(documents);
  const { map } = yield* currentPlaytest({ revision: pick.sha, helper: false });
  const late = greenStep([pick], installedCommits(documents), yield* clientHold(documents));
  if (late.kind === "hold") return yield* hold(pick.sha, late.reason);
  if (late.kind === "none") return console.log(`${pick.sha.slice(0, 7)} was installed while it built`);
  console.log(`Controller helper: ${yield* controller}`);
  yield* installAcceptedGreen(documents, map.source, pick.sha, SMASHCRAFT_ACCEPT.checks.filter(({ id }) => id.startsWith("gate-")).map(({ id }) => id));
  console.log(`Installed ${map.title} under Maps/${map.folder}`);
  const label = buildLabel(map.file);
  if (label !== undefined) {
    yield* writePlaytestChecklist(label, pick.sha, previous).pipe(
      Effect.map((path) => console.log(`Playtest notes ${path}`)),
      Effect.catch(({ problem }) => Effect.sync(() => console.warn(`Playtest notes not written: ${problem}`))),
    );
  }
}).pipe(Effect.provide(BunServices.layer));
