import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../lobby/lobbyState";
import { ruleHelp } from "./ruleHelp";

test("The ultimates rule help says the meter fills from the match clock, full 60 s after the start and after each use, and names the centre-stage orb only as the Orbs rule [k3 measure docs/design/mana.md]", () => {
  const text = ruleHelp("ultimates", createMatchState());
  assertEquals(text.includes("fills from the match clock: full 60 s after the start and after each use"), true, "clock wording");
  assertEquals(text.includes("With Orbs on, only the centre-stage orb fills it"), true, "orb named as the Orbs rule");
  assertEquals(text.includes("Off: no ultimates"), true, "Off means no ultimates");
});
