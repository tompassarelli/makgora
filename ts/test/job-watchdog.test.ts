import { expect, test } from "bun:test";
import { baselines, overruns, type JobTiming, type TimingRun } from "../scripts/jobWatchdogCore";

test("watchdog uses only measured execution deadlines, once per run [k2 property]", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const at = (ms: number) => new Date(ms).toISOString();
  const job: JobTiming = { id: 1, name: "reports", status: "completed", conclusion: "success", started_at: at(now - 100000), completed_at: at(now - 90000), runner_name: "GitHub Actions 1", labels: ["ubuntu-latest"] };
  const history: TimingRun[] = [{ id: 1, workflow: "autoland.yml", status: "completed", run_attempt: 1, jobs: [job] }];
  expect(baselines(history, now)[0]?.medianMs).toBe(10000);
  for (let elapsed = 0; elapsed <= 50000; elapsed += 101) {
    for (const status of ["queued", "in_progress", "completed"]) for (const attempt of [1, 2]) for (const runner of [null, "GitHub Actions 2"]) {
      const active: TimingRun = { id: 2, workflow: "autoland.yml", status: "in_progress", run_attempt: attempt, jobs: [{ ...job, id: 2, status, conclusion: null, completed_at: null, runner_name: runner, started_at: at(now - elapsed) }] };
      const observed = overruns([active], history, now);
      expect(observed.length).toBe(Number(status === "in_progress" && attempt === 1 && runner !== null && elapsed > 20000));
      expect(overruns([active], [], now)).toEqual([]);
      expect(overruns([active], [{ ...history[0]!, jobs: [{ ...job, labels: ["farm-big"] }] }], now)).toEqual([]);
    }
  }
  const old: TimingRun = { ...history[0]!, jobs: [{ ...job, started_at: at(now - 8 * 86400000), completed_at: at(now - 8 * 86400000 + 10000) }] };
  expect(baselines([old], now)).toEqual([]);
});
