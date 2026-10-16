import { expect, test } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBoxes, planBoxes, type Box } from "../scripts/wisp/nativePlan";
import { attachedPoolReady } from "../scripts/wisp/nativePool";
const fixture = join(import.meta.dir, "fixtures/native-plan/boxes.tsv");
test("native planning preserves every eligible issue without mixing execution contexts [k2 property]", () => {
  let seed = 8791;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let trial = 0; trial < 200; trial++) {
    const rows: Box[] = Array.from({ length: 30 }, (_, i) => ({ issue: String(i), title: "box", class: (["native-only", "wisp-sufficient", "wisp-plus-one-native-sample"] as const)[next() % 3] ?? "native-only", look: String(next() % 2), clients: String(next() % 2), map: String(next() % 3), kind: next() % 2 === 0 ? "visual" : "timing", script: next() % 7 === 0 ? "none" : `${next() % 4}.pad`, blockers: next() % 5 === 0 ? "blocked" : "", parity_evidence: "parity" }));
    const plan = planBoxes(rows);
    for (const row of rows) {
      const matches = plan.batches.flatMap(batch => batch.scripts.filter(script => script.path === row.script && script.issues.includes(row.issue)).map(() => batch));
      const eligible = row.class !== "wisp-sufficient" && row.blockers === "" && row.script !== "none";
      expect(matches.length).toBe(eligible ? 1 : 0);
      if (row.class === "wisp-sufficient") expect(plan.wisp).toContainEqual(row);
      else if (!eligible) expect(plan.blocked).toContainEqual(row);
      for (const batch of matches) expect([batch.look, batch.clients, batch.map, batch.kind]).toEqual([row.look, row.clients, row.map, row.kind]);
    }
    for (const batch of plan.batches) expect(new Set(batch.scripts.map(script => script.path)).size).toBe(batch.scripts.length);
  }
  const plan = planBoxes(parseBoxes(readFileSync(fixture, "utf8")));
  expect(plan.batches[0]?.scripts.find(script => script.path === "capture-a.pad")?.issues).toEqual(["10", "11"]);
});
test("native dry run assigns visual scripts to both pairs before timing without clients [k1 scenario]", () => {
  const out = mkdtempSync(join(tmpdir(), "native-plan-"));
  try {
    const plan = join(out, "plan.json");
    const first = Bun.spawnSync([process.execPath, "scripts/wisp.ts", "native", "plan", "--boxes", fixture, "--out", plan], { cwd: join(import.meta.dir, "..") });
    expect(first.exitCode).toBe(0);
    const run = Bun.spawnSync([process.execPath, "scripts/wisp.ts", "native", "run", plan, "--out", join(out, "run"), "--pairs", "2", "--dry-run"], { cwd: join(import.meta.dir, "..") });
    expect(run.exitCode).toBe(0);
    const lines = run.stdout.toString().split("\n").filter(line => line.startsWith("batch-"));
    expect(lines.length).toBe(5);
    expect(lines[0]).toContain("visual pair 0");
    expect(lines[1]).toContain("visual pair 1");
    expect(lines[0]).toContain("capture-a.pad");
    expect(lines[1]).toContain("capture-b.pad");
    expect(lines[2]).toContain("visual pair 0");
    expect(lines[3]).toContain("visual pair 1");
    expect(lines[2]).toContain("native-capture");
    expect(lines[3]).toContain("native-capture");
    expect(lines[4]).toContain("timing pair 0");
  } finally { rmSync(out, { recursive: true }); }
});
test("capture batches attach only to a live two-client pool independent of launcher exit [k1 scenario]", () => {
  expect(attachedPoolReady({ clients: [{ pid: 101 }, { pid: 102 }] })).toBe(true);
  for (const status of [undefined, { clients: [] }, { clients: [{ pid: 101 }] }, { clients: [{ pid: 101 }, {}] }, { clients: [{ pid: 0 }, { pid: 102 }] }]) expect(attachedPoolReady(status)).toBe(false);
});
