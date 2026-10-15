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
  readonly state: "open" | "closed";
  readonly labels: readonly string[];
  readonly body: string;
  readonly closedAt: string | null;
}

export interface ChecklistInput {
  readonly version: string;
  readonly sha: string;
  readonly previous: string | undefined;
  readonly date: string;
  readonly commits: readonly ChecklistCommit[];
  readonly issues: readonly ChecklistIssue[];
  /** Issues closed since the previous installed build, by number. */
  readonly closedSince: readonly number[];
  /** Blocker lines claimed on open issues, by number, when a claims source is available. */
  readonly blockers?: ReadonlyMap<number, string>;
}

export const NOTES_LABELS = ["playtest-notes", "tom-notes"] as const;
const TOMS_NOTE = /\bTom\b,? ?\(?\s*(?:\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|0\.0\.\d+)/;
const TOMS_QUOTE = new RegExp(`${TOMS_NOTE.source}[^\\n"]{0,80}"`);

/** Issue numbers a commit refers to: `Refs/Fixes/Closes smashcraft#N` or `#N` trailers, and a `(#N)` subject suffix. */
export function issueRefs({ subject, body }: ChecklistCommit): number[] {
  const trailers = [...body.matchAll(/^(?:Refs|Fixes|Closes)\b(.*)$/gim)].flatMap(([, rest = ""]) =>
    [...rest.matchAll(/(?:^|[\s,(])(?:smashcraft)?#(\d+)\b/g)].map(([, n]) => Number(n)));
  const suffix = [...subject.matchAll(/\(#(\d+)\)/g)].map(([, n]) => Number(n));
  return [...new Set([...trailers, ...suffix])];
}

/** An issue drafted from Tom's playtest notes: a notes label, a title tagged with Tom's date or build, or a dated quote of Tom in the body. */
export const fromTomsNotes = ({ labels, title, body }: ChecklistIssue): boolean =>
  labels.some((label) => (NOTES_LABELS as readonly string[]).includes(label)) || TOMS_NOTE.test(title) || TOMS_QUOTE.test(body);

/** The first line naming a blocker, else the first unticked box. */
export function nextStep({ body }: ChecklistIssue): string | undefined {
  const lines = body.split("\n").map((line) => line.trim());
  const blocker = lines.find((line) => /^\**(?:Blocked|Blocker)\**:/i.test(line));
  if (blocker !== undefined) return blocker;
  return lines.find((line) => /^[-*] \[ \] /.test(line))?.slice("- [ ] ".length);
}

const DIRECTION_BOX = /^[-*] \[ \] .*(?:Tom'?s (?:direction|feel)|direction or feel|feel call|direction call)/i;

/** Unticked boxes marked as Tom's direction or feel call; every other box is agent-run and never reaches the notes. */
export const directionCalls = ({ body }: ChecklistIssue): string[] =>
  body.split("\n").map((line) => line.trim()).filter((line) => DIRECTION_BOX.test(line)).map((line) => oneLine(line.slice("- [ ] ".length)));

const oneLine = (text: string, limit = 200) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};

export function playtestChecklist(input: ChecklistInput): string {
  const { version, sha, previous, date, commits, issues, closedSince, blockers } = input;
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const title = (n: number) => byNumber.get(n)?.title ?? "(issue not found)";
  const lines = [
    `# Playtest checklist: Smashcraft ${version}`,
    "",
    `- Build: ${sha.slice(0, SHORT_COMMIT)} (${sha})`,
    `- Since: ${previous === undefined ? "no earlier installed build" : previous.slice(0, SHORT_COMMIT)}`,
    `- Date: ${date}`,
    "",
    "## What changed",
    "",
  ];

  const changed = new Map<number, ChecklistCommit[]>();
  for (const commit of commits) for (const n of issueRefs(commit)) changed.set(n, [...changed.get(n) ?? [], commit]);
  const changedNumbers = [...changed.keys()].sort((a, b) => a - b);
  if (changedNumbers.length === 0) lines.push("No landed commit refers to an issue.");
  for (const n of changedNumbers) {
    lines.push(`### #${n} ${title(n)}`, "");
    for (const commit of changed.get(n) ?? []) lines.push(`- ${commit.sha.slice(0, SHORT_COMMIT)} ${commit.subject}`);
    lines.push("");
  }
  if (changedNumbers.length === 0) lines.push("");

  const toCheck = [...new Set([...changedNumbers, ...closedSince])].flatMap((n) => byNumber.get(n) ?? []);
  const notesFirst = (a: ChecklistIssue, b: ChecklistIssue) => Number(fromTomsNotes(b)) - Number(fromTomsNotes(a)) || a.number - b.number;
  lines.push("## Please check", "");
  const calls = [...toCheck].sort(notesFirst).flatMap((issue) => directionCalls(issue).map((call) => ({ issue, call })));
  if (calls.length === 0) lines.push("No direction or feel call is waiting on you for the issues touched since the last installed build.");
  for (const { issue, call } of calls) lines.push(`- [ ] #${issue.number} ${issue.title}: ${call}`);
  lines.push("");

  const stillOpen = issues.filter((issue) => issue.state === "open" && fromTomsNotes(issue)).sort((a, b) => a.number - b.number);
  lines.push("## Still open from your last notes", "");
  if (stillOpen.length === 0) lines.push("Nothing from your notes is still open.");
  for (const issue of stillOpen) {
    const step = blockers?.get(issue.number) ?? nextStep(issue);
    lines.push(`- #${issue.number} ${issue.title}${step === undefined ? "" : ` — ${oneLine(step)}`}`);
  }
  lines.push("");
  return lines.join("\n");
}

export const handoffs = join(homedir(), ".local/state/agents/handoffs");
export const checklistPath = (version: string, directory = handoffs) => join(directory, `playtest-${version}.md`);

const REPO = "repos/tompassarelli/smashcraft";
const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });
const host = (program: string, args: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd: projectRoot, stdin: "ignore" })).pipe(Effect.mapError(problem));

const IssueJson = Schema.Struct({
  number: Schema.Finite,
  title: Schema.String,
  state: Schema.Literals(["open", "closed"]),
  labels: Schema.Array(Schema.String),
  body: Schema.NullOr(Schema.String),
  closedAt: Schema.NullOr(Schema.String),
});
const decodeIssue = Schema.decodeUnknownEffect(Schema.fromJsonString(IssueJson));
const ISSUE_JQ = "select(.pull_request == null) | {number, title, state, labels: [.labels[].name], body, closedAt: .closed_at} | tojson";

const issueLines = (text: string) => Effect.forEach(text.split("\n").filter((line) => line.trim().length > 0),
  (line) => decodeIssue(line).pipe(Effect.mapError(problem), Effect.map((issue): ChecklistIssue => ({ ...issue, body: issue.body ?? "" }))));

const listIssues = (query: string) => host("gh", ["api", "--paginate", `${REPO}/issues?${query}&per_page=100`, "--jq", `.[] | ${ISSUE_JQ}`]).pipe(Effect.flatMap(issueLines));
const oneIssue = (n: number) => host("gh", ["api", `${REPO}/issues/${n}`, "--jq", ISSUE_JQ]).pipe(Effect.flatMap(issueLines), Effect.orElseSucceed(() => []));

const SEPARATOR = "\u001e";
const commitsIn = (range: string) => host("git", ["log", "--no-merges", `--format=%H%x1f%s%x1f%b${SEPARATOR}`, range]).pipe(
  Effect.map((text) => text.split(SEPARATOR).flatMap((record) => {
    const [sha = "", subject = "", body = ""] = record.replace(/^\n/, "").split("\u001f");
    return /^[a-f0-9]{40}$/.test(sha) ? [{ sha, subject, body }] : [];
  })),
);

/** Fetches the commits in previous..sha and their issues from git and GitHub, then renders the checklist. */
export const buildPlaytestChecklist = (version: string, sha: string, previous: string | undefined) => Effect.gen(function*() {
  const full = (yield* host("git", ["rev-parse", sha])).trim();
  const base = previous === undefined ? undefined : yield* host("git", ["rev-parse", "--verify", `${previous}^{commit}`]).pipe(
    Effect.map((text) => text.trim()), Effect.orElseSucceed(() => undefined));
  const commits = yield* commitsIn(base === undefined ? `${full}^..${full}` : `${base}..${full}`);
  const since = (yield* host("git", ["show", "-s", "--format=%cI", base ?? `${full}^`])).trim();
  const closed = (yield* listIssues(`state=closed&since=${encodeURIComponent(since)}`))
    .filter(({ closedAt }) => closedAt !== null && Date.parse(closedAt) >= Date.parse(since));
  const open = yield* listIssues("state=open");
  const known = new Set([...closed, ...open].map(({ number }) => number));
  const referenced = [...new Set(commits.flatMap(issueRefs))].filter((n) => !known.has(n));
  const fetched = (yield* Effect.forEach(referenced, oneIssue, { concurrency: 8 })).flat();
  return playtestChecklist({
    version, sha: full, previous: base, date: new Date().toISOString().slice(0, 10), commits,
    issues: [...closed, ...open, ...fetched], closedSince: closed.map(({ number }) => number),
  });
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
