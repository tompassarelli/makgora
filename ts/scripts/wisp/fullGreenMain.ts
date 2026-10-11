import { Effect, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { fullSuiteVerdict, isGreen, type Candidate } from "./greenBuilds";
import { projectRoot } from "./project";

const COMMITS_CONSIDERED = 20;
const Evidence = Schema.Array(Schema.Struct({
  oid: Schema.String,
  status: Schema.NullOr(Schema.Struct({ contexts: Schema.Array(Schema.Struct({
    context: Schema.String, state: Schema.String,
  })) })),
}));
const decodeEvidence = Schema.decodeUnknownEffect(Schema.fromJsonString(Evidence));
const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });
const host = (program: string, args: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd: projectRoot, stdin: "ignore" })).pipe(Effect.mapError(problem));

export const fullGreenMain = Effect.gen(function*() {
  yield* host("git", ["fetch", "--quiet", "origin", "main"]);
  const listed = yield* host("git", ["rev-list", "--first-parent", "-n", String(COMMITS_CONSIDERED), "origin/main"]);
  const shas = listed.split("\n").filter(sha => /^[a-f0-9]{40}$/.test(sha));
  if (shas.length === 0) return yield* new PlayProblem({ problem: "origin/main lists no commits" });
  const fields = shas.map((sha, i) => `c${i}:object(expression:"${sha}"){... on Commit{oid status{contexts{context state}}}}`).join(" ");
  const evidence = yield* host("gh", ["api", "graphql", "-f", `query={repository(owner:"tompassarelli",name:"smashcraft"){${fields}}}`, "--jq", "[.data.repository[] | select(. != null)]"]).pipe(
    Effect.flatMap(text => decodeEvidence(text).pipe(Effect.mapError(problem))),
  );
  const bound = evidence.map(({ oid, status }) => ({ sha: oid, statuses: status?.contexts ?? [] }));
  return shas.map(sha => ({ sha, farm: fullSuiteVerdict(sha, bound) } satisfies Candidate));
}).pipe(Effect.provide(BunServices.layer));

export const newestFullGreen = fullGreenMain.pipe(Effect.flatMap(commits => {
  const candidate = commits.find(isGreen);
  return candidate === undefined
    ? Effect.fail(new PlayProblem({ problem: `No exact farm-full success among the newest ${commits.length} main commits` }))
    : Effect.succeed(candidate.sha);
}));
