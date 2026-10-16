import { expect, test } from "bun:test";
import { Effect } from "effect";
import { AcceptDriver, type ReceiptFile } from "wisp/scripts/wisp/accept";
import { SHIELD_ENERGY_SETUP } from "../../src/game/session/shieldEnergyCapture";
import { withShieldEnergyCapture } from "./shieldEnergyCapture";

const preload = (line: string) => `function PreloadFiles takes nothing returns nothing\n\n\tcall PreloadStart()\n\tcall Preload( "${line}" )\n\tcall PreloadEnd( 0.0 )\n\nendfunction\n\n`;
const RECEIPT = "smashcraft-dev-shield-energy-p0.txt";

test("shield capture waits for a fresh Preload receipt of the requested sample [k5 boundary shield-capture-receipt]", async () => {
  let files: readonly ReceiptFile[] = [{ name: RECEIPT, text: preload("SMASHCRAFT SHIELD sample=low frame=90 raised=T energy=4.0 drawn=T centreX=0.0 centreZ=0.0 radius=9.0 pass=1"), modified: 1 }];
  const captured: string[] = [];
  const driver = withShieldEnergyCapture(AcceptDriver.of({
    clients: ["a"],
    chat: (_: string, text: string) => Effect.sync(() => {
      if (text === "-dev shield-energy down") files = [{ name: RECEIPT, text: preload("SMASHCRAFT SHIELD sample=down frame=135 raised=F energy=60.0 drawn=F centreX=0.0 centreZ=0.0 radius=0.0 pass=1"), modified: 2 }];
    }),
    receipts: () => Effect.sync(() => files),
    capture: (name: string) => Effect.sync(() => { captured.push(name); return undefined as never; }),
  } as unknown as AcceptDriver["Service"]));
  await Effect.runPromise(driver.chat("a", SHIELD_ENERGY_SETUP));
  await Effect.runPromise(driver.capture("a"));
  expect(captured).toEqual(["a"]);
});
