import { Effect } from "effect";
import { AcceptDriver, AcceptFailure, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { pollUntil } from "wisp/scripts/wisp/hostProcess";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { SHIELD_ENERGY_SAMPLES, SHIELD_ENERGY_SETUP } from "../../src/game/session/shieldEnergyCapture";

const heldSample = (sample: string, before: ReadonlyMap<string, number>) => (file: ReceiptFile) =>
  file.modified > (before.get(file.name) ?? -Infinity) && (preloadLines(file.text) ?? []).some(line => line.startsWith(`SMASHCRAFT SHIELD sample=${sample} `));

export function withShieldEnergyCapture(driver: AcceptDriver["Service"]): AcceptDriver["Service"] {
  let next = -1;
  return AcceptDriver.of({
    ...driver,
    start: (map, session) => {
      next = -1;
      return driver.start(map, session);
    },
    chat: (name, text) => driver.chat(name, text).pipe(Effect.tap(() => Effect.sync(() => {
      if (text === SHIELD_ENERGY_SETUP) next = 0;
    }))),
    capture: name => Effect.suspend(() => {
      if (next < 0) return driver.capture(name);
      const sample = SHIELD_ENERGY_SAMPLES[next++];
      if (sample === undefined) return Effect.fail(new AcceptFailure({ operation: "shield capture", problem: "unexpected extra capture" }));
      return Effect.gen(function*() {
        const before = new Map((yield* driver.receipts(name)).map(file => [file.name, file.modified]));
        yield* driver.chat(name, `-dev shield-energy ${sample}`);
        yield* pollUntil(driver.receipts(name), {
          every: "50 millis", within: "15 seconds",
          until: files => files.some(heldSample(sample, before)),
          onTimeout: () => Effect.fail(new AcceptFailure({ operation: "shield capture", problem: `${sample} never reached held drawn frame` })),
        });
        return yield* driver.capture(name);
      });
    }),
  });
}
