import { expect, test } from "bun:test";
import { type ChecklistIssue, playtestChecklist } from "./wisp/playtestChecklist";

const issue = (number: number, body: string): ChecklistIssue => ({ number, title: `Issue ${number}`, state: "open", labels: [], body, closedAt: null });

test("the playtest notes list only Tom's direction and feel calls, never agent-run boxes or closed issues without one [k2 property]", () => {
  const issues = [
    issue(4, "- [x] Tom's direction or feel judgment: already decided\n- [ ] Tom's direction or feel judgment: the swing reads as a smash\n- [ ] Agent-run: the headless strip passes"),
    issue(24, "- [ ] Agent-run: main is green"),
  ];
  const text = playtestChecklist({
    version: "0.0.9", sha: "a".repeat(40), previous: undefined, date: "2026-10-16",
    commits: [{ sha: "b".repeat(40), subject: "Fix swing (#4)", body: "" }, { sha: "c".repeat(40), subject: "Green main (#24)", body: "" }],
    issues, closedSince: [24],
  });
  const section = text.split("## Please check")[1]!.split("##")[0]!;
  expect(section).toContain("- [ ] #4 Issue 4: Tom's direction or feel judgment: the swing reads as a smash");
  expect(section).not.toContain("#24");
  expect(section).not.toContain("Agent-run");
  expect(section).not.toContain("already decided");
});
