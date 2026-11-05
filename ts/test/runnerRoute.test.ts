import { expect, test } from "bun:test";
import { type Facts, type Routing, chooseRunner } from "../scripts/runnerRoute";

const routing: Routing = { premerge: "farm-big", background: "farm-big", hosted: "ubuntu-latest", capacity: 11 };
const facts = (over: Partial<Facts>): Facts => ({ event: "push", attempt: 1, override: "", want: 1, busy: 0, ...over });

test("fork-capable and unknown events never take the farm, even with the override [k2 property]", () => {
  for (const event of ["pull_request", "pull_request_target", "workflow_run", "issue_comment"]) {
    expect(chooseRunner(routing, "background", facts({ event })).runner).toBe("ubuntu-latest");
    expect(chooseRunner(routing, "background", facts({ event, override: "farm-big" })).runner).toBe("ubuntu-latest");
  }
});
