import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { SHORT_COMMIT } from "./greenBuilds";
import { projectRoot } from "./project";

export interface ChecklistCommit {
  readonly sha: string;
  readonly subject: string;
  readonly body: string;
}

export interface ChecklistIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
}

export interface ChecklistInput {
  readonly version: string;
  readonly sha: string;
  readonly previous: string | undefined;
  readonly date: string;
  readonly commits: readonly ChecklistCommit[];
  readonly issues: readonly ChecklistIssue[];
}

const refsIn = (text: string) => [...text.matchAll(/(?:^|[\s,(])(?:smashcraft)?#(\d+)\b/g)].map(([, n]) => Number(n));

export function issueRefs({ subject, body }: ChecklistCommit): number[] {
  const trailers = [...body.matchAll(/^(?:Refs|Fixes|Closes)\b(.*)$/gim)].flatMap(([, rest = ""]) => refsIn(rest));
  const suffix = [...subject.matchAll(/\((?:(?:Refs|Fixes|Closes)\b)?([^()]*)\)/gi)].flatMap(([, rest = ""]) => refsIn(rest));
  return [...new Set([...trailers, ...suffix])];
}

const OPEN_BOX = /^[-*] \[ \] /;
const TOMS_BOX = /^\([^)]*\bTom\b[^)]*\)/;

export const directionCalls = ({ body }: ChecklistIssue): string[] =>
  body.split("\n").map((line) => line.trim()).filter((line) => OPEN_BOX.test(line) && TOMS_BOX.test(line.replace(OPEN_BOX, ""))).map((line) => oneLine(line.replace(OPEN_BOX, "")));

const oneLine = (text: string, limit = 200) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};

export function playtestChecklist({ version, sha, previous, date, commits, issues }: ChecklistInput): string {
  const touched = new Set(commits.flatMap(issueRefs));
  const calls = issues.filter(({ number }) => touched.has(number)).sort((a, b) => a.number - b.number)
    .flatMap((issue) => directionCalls(issue).map((call) => `- [ ] #${issue.number} ${issue.title}: ${call}`));
  return [
    `# Playtest notes: Smashcraft ${version}`,
    "",
    `- Build: ${sha.slice(0, SHORT_COMMIT)} (${sha})`,
    `- Since: ${previous === undefined ? "no earlier installed build" : previous.slice(0, SHORT_COMMIT)}`,
    `- Date: ${date}`,
    "",
    "## Yours to check",
    "",
    ...(calls.length === 0 ? ["No direction or feel call is waiting on you for the issues touched since the last installed build."] : calls),
    "",
  ].join("\n");
}

export const handoffs = join(homedir(), ".local/state/agents/handoffs");
export const checklistPath = (version: string, directory = handoffs) => join(directory, `playtest-${version.replaceAll(" ", "-")}.md`);

const REPO = "repos/tompassarelli/smashcraft";
const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });
const host = (program: string, args: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd: projectRoot, stdin: "ignore" })).pipe(Effect.mapError(problem));

const IssueJson = Schema.Struct({ number: Schema.Finite, title: Schema.String, body: Schema.NullOr(Schema.String) });
const decodeIssue = Schema.decodeUnknownEffect(Schema.fromJsonString(IssueJson));
const ISSUE_JQ = `select(.pull_request == null and .state == "open") | {number, title, body} | tojson`;

const oneIssue = (n: number) => host("gh", ["api", `${REPO}/issues/${n}`, "--jq", ISSUE_JQ]).pipe(
  Effect.flatMap((text) => text.trim().length === 0 ? Effect.succeed([]) : decodeIssue(text).pipe(Effect.mapError(problem),
    Effect.map((issue): ChecklistIssue[] => [{ ...issue, body: issue.body ?? "" }]))),
  Effect.mapError(({ problem }) => new PlayProblem({ problem: `issue #${n}: ${problem}` })));

const SEPARATOR = "\u001e";
const commitsIn = (range: string) => host("git", ["log", "--no-merges", `--format=%H%x1f%s%x1f%b${SEPARATOR}`, range]).pipe(
  Effect.map((text) => text.split(SEPARATOR).flatMap((record) => {
    const [sha = "", subject = "", body = ""] = record.replace(/^\n/, "").split("\u001f");
    return /^[a-f0-9]{40}$/.test(sha) ? [{ sha, subject, body }] : [];
  })),
);

export const buildPlaytestChecklist = (version: string, sha: string, previous: string | undefined) => Effect.gen(function*() {
  const full = (yield* host("git", ["rev-parse", sha])).trim();
  const base = previous === undefined ? undefined : yield* host("git", ["rev-parse", "--verify", `${previous}^{commit}`]).pipe(
    Effect.map((text) => text.trim()), Effect.orElseSucceed(() => undefined));
  const commits = yield* commitsIn(base === undefined ? `${full}^..${full}` : `${base}..${full}`);
  const issues = (yield* Effect.forEach([...new Set(commits.flatMap(issueRefs))], oneIssue, { concurrency: 8 })).flat();
  return playtestChecklist({ version, sha: full, previous: base, date: new Date().toISOString().slice(0, 10), commits, issues });
});

export const writePlaytestChecklist = (version: string, sha: string, previous: string | undefined, directory = handoffs) => Effect.gen(function*() {
  const markdown = yield* buildPlaytestChecklist(version, sha, previous);
  const path = checklistPath(version, directory);
  yield* Effect.try({
    try: () => {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      writeFileSync(`${path}.${process.pid}.next`, markdown, { mode: 0o600 });
      renameSync(`${path}.${process.pid}.next`, path);
    }, catch: (cause) => new PlayProblem({ problem: String(cause) }),
  });
  return path;
});

if (import.meta.main) {
  const [range = "HEAD^..HEAD", version = "0.0.0"] = process.argv.slice(2);
  const [previous, sha = "HEAD"] = range.includes("..") ? range.split("..") : [undefined, range];
  const { BunServices } = await import("@effect/platform-bun");
  console.log(await Effect.runPromise(buildPlaytestChecklist(version, sha, previous || undefined).pipe(Effect.provide(BunServices.layer))));
}
