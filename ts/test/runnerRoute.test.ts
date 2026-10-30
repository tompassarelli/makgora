import { expect, test } from "bun:test";
import { type Facts, type Routing, chooseRunner } from "../scripts/runnerRoute";

const routing: Routing = { premerge: "farm-big", background: "farm-big", hosted: "ubuntu-latest", capacity: 11 };
const facts = (over: Partial<Facts>): Facts => ({ event: "push", attempt: 1, override: "", want: 1, busy: 0, ...over });

test("an owner push, dispatch or schedule takes the farm while a runner is idle [k2 property]", () => {
  for (const event of ["push", "workflow_dispatch", "schedule"]) expect(chooseRunner(routing, "premerge", facts({ event, busy: 10 })).runner).toBe("farm-big");
});

test("fork-capable and unknown events never take the farm, even with the override [k2 property]", () => {
  for (const event of ["pull_request", "pull_request_target", "workflow_run", "issue_comment"]) {
    expect(chooseRunner(routing, "background", facts({ event })).runner).toBe("ubuntu-latest");
    expect(chooseRunner(routing, "background", facts({ event, override: "farm-big" })).runner).toBe("ubuntu-latest");
  }
});

test("a saturated farm, or one too busy for the wanted jobs, falls back to hosted runners [k2 property]", () => {
  expect(chooseRunner(routing, "background", facts({ busy: 11 })).runner).toBe("ubuntu-latest");
  expect(chooseRunner(routing, "background", facts({ busy: 14 })).runner).toBe("ubuntu-latest");
  expect(chooseRunner(routing, "background", facts({ busy: 6, want: 6 })).runner).toBe("ubuntu-latest");
  expect(chooseRunner(routing, "background", facts({ busy: 5, want: 6 })).runner).toBe("farm-big");
});

test("a retry goes hosted and a dispatch override wins on a trusted event [k2 property]", () => {
  expect(chooseRunner(routing, "premerge", facts({ attempt: 2 })).runner).toBe("ubuntu-latest");
  expect(chooseRunner(routing, "premerge", facts({ override: "ubuntu-latest" })).runner).toBe("ubuntu-latest");
  expect(chooseRunner(routing, "premerge", facts({ override: "farm-test" })).runner).toBe("farm-test");
});
