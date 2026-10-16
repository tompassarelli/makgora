import { Console, Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { RELEASE_MILESTONE } from "./autolandCore";
import { runProcess } from "./hostProcess";

export const ReleaseIssue = Schema.Struct({
  id: Schema.Finite, number: Schema.Finite, title: Schema.String, body: Schema.NullOr(Schema.String),
  labels: Schema.Array(Schema.Struct({ name: Schema.String })),
  milestone: Schema.NullOr(Schema.Struct({ number: Schema.Finite, title: Schema.String })),
});
export type ReleaseIssue = typeof ReleaseIssue.Type;
export interface ReleaseSnapshot { readonly issues: readonly ReleaseIssue[]; readonly children: Readonly<Record<number, readonly number[]>> }

export function releaseTreeDrift(snapshot: ReleaseSnapshot) {
  const tree = new Set<number>();
  const visit = (number: number): void => {
    if (tree.has(number)) return;
    tree.add(number);
    for (const child of snapshot.children[number] ?? []) visit(child);
  };
  visit(1);
  const members = snapshot.issues.filter(issue => issue.milestone?.title === RELEASE_MILESTONE);
  const missing = snapshot.issues.filter(issue => tree.has(issue.number) && issue.milestone?.title !== RELEASE_MILESTONE).map(issue => issue.number);
  const epics = snapshot.issues.filter(issue => tree.has(issue.number) && /^E\d+\b/.test(issue.title));
  const outside = members.filter(issue => !tree.has(issue.number)).map(issue => {
    const labels = new Set(issue.labels.map(label => label.name.toLowerCase()));
    const candidates = epics.filter(epic => {
      const key = /^E\d+\b/.exec(epic.title)?.[0]?.toLowerCase() ?? "";
      const labeled = [...labels].some(label => label === key || label === `epic:${key}` || label === `epic: ${key}` || label === epic.title.toLowerCase());
      const linked = new RegExp(`(?:https://github\\.com/tompassarelli/smashcraft/issues/|(?<![\\w/#-])(?:tompassarelli/)?smashcraft#|(?<![\\w/#-])#)${epic.number}(?!\\d)`).test(issue.body ?? "");
      return labeled || linked;
    }).map(epic => epic.number);
    return { issue: issue.number, candidates };
  });
  return { tree: tree.size, milestone: members.length, missing, outside };
}

class ReleaseTreeFailure extends Schema.TaggedError<ReleaseTreeFailure>()("ReleaseTreeFailure", { problem: Schema.String }) {
  override get message() { return this.problem; }
}
const repo = () => process.env.GH_REPO ?? "tompassarelli/smashcraft";
const api = (path: string, ...args: string[]) => runProcess(ChildProcess.make("gh", ["api", `repos/${repo()}/${path}`, ...args]));
const issuesAt = (path: string) => api(path, "--paginate", "--slurp").pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(Schema.Array(ReleaseIssue))))),
  Effect.map(pages => pages.flat()),
);

export const readReleaseTree = Effect.gen(function*() {
  const issues = yield* issuesAt("issues?state=all&per_page=100");
  const children: Record<number, readonly number[]> = {};
  const pending = [1];
  const seen = new Set<number>();
  while (pending.length > 0) {
    const number = pending.shift();
    if (number === undefined || seen.has(number)) continue;
    seen.add(number);
    const rows = yield* issuesAt(`issues/${number}/sub_issues?per_page=100`);
    children[number] = rows.map(issue => issue.number);
    pending.push(...children[number]);
  }
  return { issues, children };
});

export const checkReleaseTreeWith = <E, R>(fix: boolean, github: {
  readonly read: Effect.Effect<ReleaseSnapshot, E, R>;
  readonly milestone: (issue: number, milestone: number) => Effect.Effect<unknown, E, R>;
  readonly parent: (parent: number, issueId: number) => Effect.Effect<unknown, E, R>;
}) => Effect.gen(function*() {
  const snapshot = yield* github.read;
  const drift = releaseTreeDrift(snapshot);
  yield* Console.log(`${RELEASE_MILESTONE}: milestone ${drift.milestone}, root #1 tree ${drift.tree} (including root)`);
  for (const number of drift.missing) yield* Console.log(`Tree #${number} missing milestone`);
  for (const row of drift.outside) yield* Console.log(`Milestone #${row.issue} outside tree: ${row.candidates.length === 1 ? `parent #${row.candidates[0]}` : `proxy decision required; candidates: ${row.candidates.map(n => `#${n}`).join(", ") || "none"}`}`);
  if (fix) {
    const milestone = snapshot.issues.find(issue => issue.milestone?.title === RELEASE_MILESTONE)?.milestone;
    if (milestone === undefined || milestone === null) return yield* new ReleaseTreeFailure({ problem: `No ${RELEASE_MILESTONE} milestone found` });
    for (const number of drift.missing) yield* github.milestone(number, milestone.number);
    for (const row of drift.outside) {
      if (row.candidates.length !== 1) continue;
      const issue = snapshot.issues.find(issue => issue.number === row.issue);
      const parent = row.candidates[0];
      if (issue !== undefined && parent !== undefined) yield* github.parent(parent, issue.id);
    }
    if (drift.missing.length + drift.outside.length > 0) {
      const remaining = releaseTreeDrift(yield* github.read);
      if (remaining.missing.length + remaining.outside.length > 0) return yield* new ReleaseTreeFailure({ problem: `Release tree drift remains: ${remaining.missing.length} missing milestone, ${remaining.outside.length} outside tree; proxy must resolve ambiguous parents` });
    }
  } else if (drift.missing.length + drift.outside.length > 0) return yield* new ReleaseTreeFailure({ problem: "Release tree drift; run bun wisp release tree --fix" });
  yield* Console.log("Release tree synchronized");
});

export const checkReleaseTree = (fix: boolean) => checkReleaseTreeWith(fix, {
  read: readReleaseTree,
  milestone: (issue, milestone) => api(`issues/${issue}`, "--method", "PATCH", "-F", `milestone=${milestone}`),
  parent: (parent, issueId) => api(`issues/${parent}/sub_issues`, "--method", "POST", "-F", `sub_issue_id=${issueId}`),
});
