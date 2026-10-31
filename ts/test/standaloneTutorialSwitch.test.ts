import { expect, test } from "bun:test";
import { createStandaloneSession } from "../scripts/wisp/standalone";
import { tutorialOffers } from "../src/game/ui/tutorialMenu";

test("closing a standalone session puts the first-run Tutorial prompt switch back, so a later test in the same process still opens the prompt [k2 property]", async () => {
  expect(tutorialOffers.enabled).toBe(true);
  const session = await createStandaloneSession({ start: "select", chosen: "demonHunter", script: "#! select cpu\n" });
  expect(tutorialOffers.enabled).toBe(false);
  session.close();
  expect(tutorialOffers.enabled).toBe(true);
}, 60_000);
