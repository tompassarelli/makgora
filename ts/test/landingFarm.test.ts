import { expect, test } from "bun:test";
import { GROUPS } from "../scripts/landingChecks";
import { cancelledOnly, checksVerdict, exitCodeFor } from "../scripts/landingFarm";

test("a landing passes once every check job passes, without the merge job, and fails on the first failing check job [k2 property]", () => {
  const jobs = (done: number, last = "success") => GROUPS.map((name, index) => ({ name, status: index < done ? "completed" : "in_progress", conclusion: index < done ? (index === done - 1 ? last : "success") : "" }));
  const state = (done: number, last?: string) => ({ status: "in_progress", conclusion: "", jobs: [{ name: "plan", status: "completed", conclusion: "success" }, ...jobs(done, last), { name: "merge", status: "queued", conclusion: "" }] });
  expect(checksVerdict(state(GROUPS.length - 1))).toBe("pending");
  expect(checksVerdict(state(GROUPS.length))).toBe("passed");
  expect(checksVerdict(state(2, "failure"))).toBe("failed");
  expect(checksVerdict(state(GROUPS.length, "skipped"))).toBe("passed");
  expect(checksVerdict({ status: "completed", conclusion: "cancelled", jobs: [] })).toBe("failed");
  const named = ["corpus", "static"] as const;
  const only = (...states: readonly [string, string][]) => ({ status: "in_progress", conclusion: "", jobs: states.map(([name, conclusion]) => ({ name, status: conclusion === "" ? "in_progress" : "completed", conclusion })) });
  expect(checksVerdict(only(["corpus", "success"], ["static", ""]), named)).toBe("pending");
  expect(checksVerdict(only(["corpus", "success"], ["static", "success"]), named)).toBe("passed");
  expect(checksVerdict(only(["corpus", "success"]), named)).toBe("pending");
  expect(checksVerdict(only(["corpus", "failure"], ["static", ""]), named)).toBe("failed");
});

test("a rate-limited or unavailable GitHub exits 75 for the lander to treat as transient, and a failing check exits 1 [k2 property]", () => {
  expect(exitCodeFor("HTTP 403 for run 42112065121/jobs?per_page=100")).toBe(75);
  expect(exitCodeFor("HTTP 429 for run 1/jobs")).toBe(75);
  expect(exitCodeFor("HTTP 503 for run 1")).toBe(75);
  expect(exitCodeFor("GitHub is rate-limiting requests")).toBe(75);
  expect(exitCodeFor("FAIL parity tapes\nlanding farm: failure on abc: url")).toBe(1);
});

test("a farm run GitHub cancelled is not a failing check, and one with a failed check beside a cancelled one is [k2 property]", () => {
  const run = (conclusion: string, ...jobs: readonly [string, string][]) => ({ status: "completed", conclusion, jobs: jobs.map(([name, result]) => ({ name, status: "completed", conclusion: result })) });
  expect(cancelledOnly(run("cancelled"), ["corpus"])).toBe(true);
  expect(cancelledOnly(run("failure", ["corpus", "cancelled"], ["static", "success"]), ["corpus", "static"])).toBe(true);
  expect(cancelledOnly(run("failure", ["corpus", "cancelled"], ["static", "failure"]), ["corpus", "static"])).toBe(false);
  expect(cancelledOnly(run("failure", ["corpus", "failure"]), ["corpus"])).toBe(false);
  expect(exitCodeFor("landing farm: GitHub cancelled the run, not a check: https://github.com/x/y/actions/runs/1")).toBe(75);
});
