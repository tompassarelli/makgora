import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PAD_TRACE_MARGIN, TRACE_FILE, padTraceCommand, padTraceLength } from "../scripts/integrity/padParity";
import { parsePadScript } from "../scripts/integrity/padScript";
import { traceSetup } from "../src/game/session/traceSettings";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { RESET_COMMAND } from "../src/game/session/devSettings";
import { shell } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";
import { JournalHelpers } from "./rematch/journalHelper";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("pad trace covers the latest edge, capture and expectation with a fixed margin [k2 property]", () => {
  for (let last = 1; last < 6000; last += 43) {
    for (const script of [
      `${last} a tap VIEW 70`,
      `${last} b capture`,
      `1 a tap A\n#! absent b 1-${last} damage`,
      `1 a tap A\n#! expect a ${last} special`,
    ]) {
      const steps = parsePadScript(script);
      const setup = traceSetup(padTraceCommand("-dev quick", padTraceLength(script, steps)));
      const end = script.includes("VIEW") ? last + 70 : Math.max(last, ...steps.map(step => step.frame));
      expect(setup.callbacks).toBe(end + PAD_TRACE_MARGIN);
    }
  }
  expect(() => padTraceCommand("x".repeat(127), PAD_TRACE_MARGIN)).toThrow("127");
});

test("a Lich pad setup closes both headless traces at its cutoff and reset restores the delay window [k1 scenario]", () => {
  const script = readFileSync(`${import.meta.dir}/native/pads/448/lich.pad`, "utf8");
  const setup = padTraceCommand("-dev setup quick hero lich;percent 1 25", padTraceLength(script, parsePadScript(script)));
  const cutoff = traceSetup(setup).callbacks;
  if (cutoff === undefined) throw new Error("pad setup omitted the trace cutoff");
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const value = <T>(client: ReturnType<typeof clients.client>, read: () => T): T => {
    const values: { readonly value: T }[] = [];
    client.run(() => values.push({ value: read() }));
    const result = values[0];
    if (result === undefined) throw new Error("headless read returned no value");
    return result.value;
  };
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, true);
  const frames = (count: number) => {
    for (let i = 0; i < count; i++) { clients.frames(1); helpers.service(clients); }
  };
  clients.start();
  frames(30);
  clients.chat(0, setup);
  frames(60);
  for (const client of clients.clients) expect(value(client, () => shell().trace.limit)).toBe(cutoff);
  frames(750);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => shell().trace.ticks - shell().trace.pausedTicks)).toBe(cutoff);
    expect(client.files.get(TRACE_FILE)?.some(line => line.startsWith(`${cutoff} `) && line.endsWith(" end"))).toBe(true);
  }
  clients.chat(0, RESET_COMMAND);
  frames(30);
  clients.chat(0, "-dev quick hero lich");
  frames(30);
  for (const client of clients.clients) {
    expect(value(client, () => shell().trace.limit)).toBeUndefined();
    expect(value(client, () => shell().trace.active)).toBe(true);
  }
}, 30000);
