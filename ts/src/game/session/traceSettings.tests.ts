import { assertEquals, test } from "wisp/src/runtime/testing";
import { RESPONSE_TRACE_CALLBACKS } from "../core/gameFiles";
import { INTEGRITY_BUILD } from "./currentBuild";
import { traceCallbacks, traceSetup } from "./traceSettings";

test("pad trace setup preserves capture metadata and plain delay probes keep their full window [k2 property]", () => {
  const command = "-dev quick hero lich |capture token 450 -";
  for (let last = 0; last < 5000; last += 37) {
    const callbacks = last + 180;
    const setup = traceSetup(`${command} |trace ${callbacks}`);
    assertEquals(setup.command, command);
    assertEquals(traceCallbacks(INTEGRITY_BUILD, setup.callbacks), callbacks);
  }
  assertEquals(traceCallbacks(INTEGRITY_BUILD, traceSetup("-dev quick").callbacks), RESPONSE_TRACE_CALLBACKS);
  for (const invalid of ["0", "-1", "1.5", "2147483648", "", "750 trailing"]) {
    const text = `${command} |trace ${invalid}`;
    assertEquals(traceSetup(text).command, text);
    assertEquals(traceSetup(text).callbacks, undefined);
  }
});
