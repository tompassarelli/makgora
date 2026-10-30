import { expect, test } from "bun:test";
import { Effect } from "effect";
import { type Attempt, type Clock, NO_FREE_SLOTS, backoffSeconds, isSlotShortage, untilAdmitted } from "../scripts/farmWait";

const fakeClock = () => {
  const slept: number[] = [];
  let now = 0;
  const clock: Clock = { sleep: (seconds) => Effect.sync(() => { slept.push(seconds); now += seconds; }), elapsed: () => now };
  return { clock, slept };
};

const attempts = (refusals: readonly (string | undefined)[]) => {
  let calls = 0;
  return { attempt: () => Effect.sync((): Attempt<number> => ({ value: calls, refusal: refusals[calls++] })), calls: () => calls };
};

test("a refused plan is dispatched again with doubling backoff until admitted, one line per wait [k1 scenario]", async () => {
  const lines: string[] = [];
  const log = console.error;
  console.error = (line: string) => void lines.push(line);
  const { clock, slept } = fakeClock();
  const source = attempts([`Hosted admission: 35 busy; ${NO_FREE_SLOTS}`, `Hosted admission: 30 busy; ${NO_FREE_SLOTS}`, undefined]);
  const waited = await Effect.runPromise(untilAdmitted(source.attempt, 180, clock)).finally(() => { console.error = log; });
  expect(waited).toEqual({ admitted: true, value: 2 });
  expect(source.calls()).toBe(3);
  expect(slept).toEqual([60, 120]);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain("35 busy");
});

test("the wait gives up with the last refusal once the timeout would pass, and a zero timeout fails at once [k1 scenario]", async () => {
  const log = console.error;
  console.error = () => undefined;
  try {
    const refusal = `Hosted admission: ${NO_FREE_SLOTS}`;
    const bounded = fakeClock();
    const waited = await Effect.runPromise(untilAdmitted(attempts(Array.from({ length: 20 }, () => refusal)).attempt, 5, bounded.clock));
    expect(waited).toEqual({ admitted: false, refusal, waits: 2 });
    expect(bounded.slept).toEqual([60, 120]);
    const failFast = fakeClock();
    const source = attempts([refusal]);
    expect(await Effect.runPromise(untilAdmitted(source.attempt, 0, failFast.clock))).toEqual({ admitted: false, refusal, waits: 0 });
    expect(source.calls()).toBe(1);
    expect(failFast.slept).toEqual([]);
  } finally {
    console.error = log;
  }
});

test("backoff doubles from a minute to ten and only the admission message counts as a slot shortage [k2 property]", () => {
  expect([0, 1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([60, 120, 240, 480, 600, 600]);
  expect(isSlotShortage(`x Hosted admission: 40 - 35 busy - 12 reserve = 0 farm slots; ${NO_FREE_SLOTS}`)).toBe(true);
  expect(isSlotShortage("error: Unknown or reversed fighter matchup")).toBe(false);
});
