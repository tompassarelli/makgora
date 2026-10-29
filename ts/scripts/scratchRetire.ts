import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { captureProcess } from "wisp/scripts/wisp/hostProcess";

export const SCRATCH_PREFIXES = ["refs/heads/farm/", "refs/heads/probe/"] as const;
export const PUSH_GRACE_MINUTES = 15;

export interface ScratchRef { readonly name: string; readonly tip: string; readonly pushedMinutesAgo: number | undefined }
export interface ActiveRun { readonly headBranch: string | null; readonly headSha: string; readonly title: string }

export type Retirement = { readonly retire: boolean; readonly why: string };

export function retirement(ref: ScratchRef, active: readonly ActiveRun[], openPulls: ReadonlySet<string>): Retirement {
  if (ref.pushedMinutesAgo !== undefined && ref.pushedMinutesAgo < PUSH_GRACE_MINUTES) return { retire: false, why: `pushed ${Math.floor(ref.pushedMinutesAgo)} min ago, before a run can be dispatched on it` };
  if (openPulls.has(ref.name)) return { retire: false, why: "an open pull request holds it" };
  const holder = active.find((run) => run.headBranch === ref.name || run.headSha === ref.tip || run.title.split(/\s+/).some((word) => word === ref.name || word === ref.tip));
  if (holder !== undefined) return { retire: false, why: `${holder.title} is still running on it` };
  return { retire: true, why: "no run is using it" };
}

export class RetireFailure extends Schema.TaggedError<RetireFailure, { readonly brand: unique symbol }>()("RetireFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

export type Gh = (...args: string[]) => Effect.Effect<string, RetireFailure>;

export const ghCli: Gh = (...args) => captureProcess("gh", args.join(" "), ["gh", ...args]).pipe(
  Effect.mapError((cause) => new RetireFailure({ problem: String(cause) })),
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0 ? Effect.succeed(stdout) : Effect.fail(new RetireFailure({ problem: `gh ${args.join(" ")}: ${stderr.trim()}` }))),
);

const Pages = <S extends Schema.Top>(item: S) => Schema.fromJsonString(Schema.Array(item));
const RefPages = Pages(Schema.Struct({ data: Schema.Struct({ repository: Schema.Struct({ refs: Schema.Struct({ nodes: Schema.Array(Schema.Struct({ name: Schema.String, target: Schema.Struct({ oid: Schema.String }) })) }) }) }) }));
const RunPages = Pages(Schema.Struct({ workflow_runs: Schema.Array(Schema.Struct({ head_branch: Schema.NullOr(Schema.String), head_sha: Schema.String, display_title: Schema.String })) }));
const PullPages = Pages(Schema.Array(Schema.Struct({ head: Schema.Struct({ ref: Schema.String }) })));
const EventPages = Pages(Schema.Array(Schema.Struct({ type: Schema.String, created_at: Schema.String, payload: Schema.Struct({ ref: Schema.optional(Schema.String) }) })));

const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, text: string) =>
  Schema.decodeEffect(schema)(text).pipe(Effect.mapError((cause) => new RetireFailure({ problem: `unexpected gh output: ${String(cause)}` })));

const scratchRefs = (gh: Gh, repo: string, now: number) => Effect.gen(function*() {
  const [owner, name] = repo.split("/");
  const found: ScratchRef[] = [];
  const pushed = new Map<string, number>();
  for (const page of yield* decode(EventPages, yield* gh("api", `repos/${repo}/events?per_page=100`, "--paginate", "--slurp"))) {
    for (const event of page) {
      if (event.type === "PushEvent" && event.payload.ref !== undefined && !pushed.has(event.payload.ref)) pushed.set(event.payload.ref, Date.parse(event.created_at));
    }
  }
  for (const prefix of SCRATCH_PREFIXES) {
    const query = `query($owner:String!,$name:String!,$endCursor:String){repository(owner:$owner,name:$name){refs(refPrefix:"${prefix}",first:100,after:$endCursor){nodes{name target{oid}} pageInfo{hasNextPage endCursor}}}}`;
    const pages = yield* decode(RefPages, yield* gh("api", "graphql", "--paginate", "--slurp", "-f", `query=${query}`, "-f", `owner=${owner}`, "-f", `name=${name}`));
    for (const node of pages.flatMap((page) => page.data.repository.refs.nodes)) {
      const full = `${prefix}${node.name}`;
      const at = pushed.get(full);
      found.push({ name: full.slice("refs/heads/".length), tip: node.target.oid, pushedMinutesAgo: at === undefined ? undefined : (now - at) / 60000 });
    }
  }
  return found;
});

const activeRuns = (gh: Gh, repo: string) => Effect.gen(function*() {
  const runs: ActiveRun[] = [];
  for (const status of ["queued", "in_progress", "waiting", "pending", "requested"]) {
    const pages = yield* decode(RunPages, yield* gh("api", `repos/${repo}/actions/runs?status=${status}&per_page=100`, "--paginate", "--slurp"));
    runs.push(...pages.flatMap((page) => page.workflow_runs.map((run) => ({ headBranch: run.head_branch, headSha: run.head_sha, title: run.display_title }))));
  }
  return runs;
});

export const retireScratch = (gh: Gh, repo: string, now: number, dryRun: boolean) => Effect.gen(function*() {
  const refs = yield* scratchRefs(gh, repo, now);
  if (refs.length === 0) return yield* Console.log("no farm/ or probe/ branch on origin");
  const active = yield* activeRuns(gh, repo);
  const pulls = yield* decode(PullPages, yield* gh("api", `repos/${repo}/pulls?state=open&per_page=100`, "--paginate", "--slurp"));
  const held = new Set(pulls.flat().map((pull) => pull.head.ref));
  for (const ref of refs) {
    const verdict = retirement(ref, active, held);
    if (!verdict.retire) {
      yield* Console.log(`kept ${ref.name}: ${verdict.why}`);
      continue;
    }
    if (dryRun) {
      yield* Console.log(`would delete ${ref.name} at ${ref.tip}`);
      continue;
    }
    yield* gh("api", "-X", "DELETE", `repos/${repo}/git/refs/heads/${ref.name}`);
    yield* Console.log(`deleted ${ref.name} at ${ref.tip}; restore: git push origin ${ref.tip}:refs/heads/${ref.name}`);
  }
});

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { "dry-run": { type: "boolean" } } });
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo === undefined) {
    console.error("usage: GITHUB_REPOSITORY=OWNER/NAME bun scripts/scratchRetire.ts [--dry-run]");
    process.exit(2);
  }
  await Effect.runPromise(retireScratch(ghCli, repo, Date.now(), values["dry-run"] === true));
}
