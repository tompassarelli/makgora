import { expect, test } from "bun:test";
import { shell } from "../src/host/loop/state";
import { NEUTRAL_INPUT, createStandaloneSession } from "../scripts/wisp/standalone";

const SETTLE_STEPS = 120;
const WATCH_STEPS = 12;

async function stepsToFlash(devCommands: readonly string[]): Promise<{ readonly delay: number | undefined; readonly steps: number | undefined; readonly stillLit: boolean }> {
  const session = await createStandaloneSession({ start: "training", devCommands });
  try {
    const visible = () => { let lit: boolean | undefined; session.client.run(() => { lit = globalThis.__makgoraInputFlash?.visible; }); return lit === true; };
    let delay: number | undefined;
    session.client.run(() => { delay = shell().rollback?.delay; });
    for (let step = 0; step < SETTLE_STEPS; step++) session.step(NEUTRAL_INPUT);
    const quiet = visible();
    let steps: number | undefined;
    for (let step = 1; step <= WATCH_STEPS && steps === undefined; step++) {
      session.step({ ...NEUTRAL_INPUT, buttons: ["attack"] });
      if (visible()) steps = step;
    }
    return { delay, steps, stillLit: quiet };
  } finally {
    session.close();
  }
}

test("the input flash lights on the frame a press acts, one frame earlier for each frame of input delay removed, down to a development delay of 0 under the build's 1 [k1 scenario]", async () => {
  const two = await stepsToFlash(["delay 2", "flash on"]);
  const one = await stepsToFlash(["flash on"]);
  const zero = await stepsToFlash(["delay 0", "flash on"]);
  expect([two.delay, one.delay, zero.delay]).toEqual([2, 1, 0]);
  expect([two.stillLit, one.stillLit, zero.stillLit]).toEqual([false, false, false]);
  expect(two.steps).toBeDefined();
  expect(two.steps! - one.steps!).toBe(1);
  expect(one.steps! - zero.steps!).toBe(1);
});

test("the input flash stays off unless asked for, in any build [k1 scenario]", async () => {
  const off = await stepsToFlash([]);
  expect(off.steps).toBeUndefined();
});
