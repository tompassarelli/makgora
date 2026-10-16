import { Effect } from "effect";
import { AcceptDriver, AcceptFailure } from "wisp/scripts/wisp/accept";
import { pollUntil } from "wisp/scripts/wisp/hostProcess";
import { SHIELD_ENERGY_SAMPLES, SHIELD_ENERGY_SETUP } from "../../src/game/session/shieldEnergyCapture";

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
        yield* driver.chat(name, `-dev shield-energy ${sample}`);
        yield* pollUntil(driver.receipts(name), {
          every: "50 millis", within: "15 seconds",
          until: files => files.some(file => file.text.split("\n").some(line => line.startsWith(`SMASHCRAFT SHIELD sample=${sample} `))),
          onTimeout: () => Effect.fail(new AcceptFailure({ operation: "shield capture", problem: `${sample} never reached held drawn frame` })),
        });
        return yield* driver.capture(name);
      });
    }),
  });
}
