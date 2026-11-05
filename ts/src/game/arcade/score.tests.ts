import { assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { beatsScore } from "./score";



test("equal scores break on the shorter run, a higher score always wins and a first score always counts [k3 measure docs/design/arcade-mode.md]", () => {
  assertTrue(beatsScore({ total: 9000, runSeconds: 600 }, { total: 9000, runSeconds: 601 }));
  assertFalse(beatsScore({ total: 9000, runSeconds: 601 }, { total: 9000, runSeconds: 600 }));
  assertFalse(beatsScore({ total: 9000, runSeconds: 600 }, { total: 9000, runSeconds: 600 }));
  assertTrue(beatsScore({ total: 9001, runSeconds: 900 }, { total: 9000, runSeconds: 300 }));
  assertFalse(beatsScore({ total: 8999, runSeconds: 300 }, { total: 9000, runSeconds: 900 }));
  assertTrue(beatsScore({ total: 0, runSeconds: 0 }, undefined));
});
