import { expect, test } from "bun:test";
import { Effect, Schema } from "effect";
import { RELEASE_MILESTONE } from "../scripts/autolandCore";
import { ReleaseIssue, checkReleaseTreeWith, releaseTreeDrift } from "../scripts/releaseTree";
import fixture from "./fixtures/release-tree.json";

test("recorded release tree finds recursive drift and repairs only unambiguous parents [k1 scenario]", async () => {
  let issues = Schema.decodeSync(Schema.Array(ReleaseIssue))(fixture.issues.map(issue => ({ ...issue, milestone: issue.milestone === null ? null : { ...issue.milestone, title: issue.milestone.title === "$release" ? RELEASE_MILESTONE : issue.milestone.title } })));
  const children: Record<number, readonly number[]> = { ...fixture.children };
  const before = releaseTreeDrift({ issues, children: fixture.children });
  expect(before.missing).toEqual([20, 21]);
  expect(before.outside).toEqual([
    { issue: 22, candidates: [7] }, { issue: 23, candidates: [8] },
    { issue: 24, candidates: [7, 8] }, { issue: 25, candidates: [] },
  ]);
  const writes: number[] = [];
  const github = {
    read: Effect.sync(() => ({ issues, children })),
    milestone: (number: number, milestone: number) => Effect.sync(() => {
      writes.push(number);
      issues = issues.map(issue => issue.number === number ? { ...issue, milestone: { number: milestone, title: RELEASE_MILESTONE } } : issue);
    }),
    parent: (parent: number, id: number) => Effect.sync(() => {
      writes.push(id);
      children[parent] = [...(children[parent] ?? []), id];
    }),
  };
  expect(await Effect.runPromise(checkReleaseTreeWith(false, github).pipe(Effect.result))).toMatchObject({ _tag: "Failure" });
  expect(writes).toEqual([]);
  expect(await Effect.runPromise(checkReleaseTreeWith(true, github).pipe(Effect.result))).toMatchObject({ _tag: "Failure" });
  expect(writes).toEqual([20, 21, 22, 23]);
  const repaired = releaseTreeDrift({ issues, children });
  expect(repaired.missing).toEqual([]);
  expect(repaired.outside).toEqual(before.outside.slice(2));
  children[1] = [...(children[1] ?? []), 24, 25];
  expect(await Effect.runPromise(checkReleaseTreeWith(false, github).pipe(Effect.result))).toMatchObject({ _tag: "Success" });
  const clean = releaseTreeDrift({ issues, children: { 1: issues.filter(issue => issue.milestone?.title === RELEASE_MILESTONE && issue.number !== 1).map(issue => issue.number) } });
  expect(clean.missing).toEqual([]);
  expect(clean.outside).toEqual([]);
});
