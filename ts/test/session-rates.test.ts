import { expect, test } from "bun:test";
import { testHeadless } from "./headless";
import { Phase } from "../src/game/match/rules";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { installSessionRates } from "../src/platform/shell/sessionRates";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { parseSessionRates } from "../scripts/wisp/sessionRates";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("the playable build writes a per-second rate line with callbacks and match frames, and live counts every ten seconds, into a per-minute rates file [k1 scenario]", () => {
  const build = { ...PLAYABLE_BUILD, devConsole: true };
  const clients = headless.clients({ install, start: () => { startBuild(build); installSessionRates(build.id); } });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren expert");
  clients.frames(1800);
  const files = clients.clients[0]?.files ?? new Map<string, string[]>();
  const names = [...files.keys()].filter(name => name.startsWith("smashcraft-rates-"));
  expect(names).toHaveLength(1);
  const lines = files.get(names[0] ?? "") ?? [];
  expect(lines[0]).toMatch(/^smashcraft-rates v=1 load=\S+ minute=0 build=playable-0047 version=\S+ clock=os$/);
  const session = parseSessionRates(lines);
  expect(session.seconds.map(second => second.t)).toEqual(Array.from({ length: 30 }, (_, index) => (index + 1) * 1000));
  for (const second of session.seconds.slice(1)) expect(second.cb).toBe(60);
  const match = session.seconds.filter(second => second.ph === Phase.match).slice(1, -1);
  expect(match.length).toBeGreaterThan(10);
  for (const second of match) {
    expect(second.spec).toBeGreaterThanOrEqual(59);
    expect(second.spec).toBeLessThanOrEqual(61);
    expect(second.gmax).toBeGreaterThanOrEqual(0);
    expect(second.recv).toBeGreaterThan(0);
    expect(second.rown).toBeGreaterThan(0);
    expect(second.cf).toBeLessThanOrEqual(second.f ?? 0);
    expect(second.win).toBeGreaterThan(0);
  }
  expect(session.counts.map(count => count.t)).toEqual([10000, 20000, 30000]);
  expect(session.events).toHaveLength(3);
  expect(session.live).toHaveLength(6);
  for (const second of session.seconds) expect(second.gs).toBe(-1);
}, 120_000);
