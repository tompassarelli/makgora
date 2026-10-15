import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testHeadless } from "./headless";
import { Phase } from "../src/game/lobby/lobbyState";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { installSessionRates } from "../src/host/loop/sessionRates";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { parseSessionRates, sessionRateReport } from "../scripts/wisp/sessionRates";

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

function forkLine(slowMinute: string, results = 0): string | undefined {
  const folder = mkdtempSync(join(tmpdir(), "session-rates-"));
  const healthy = "ph=2 cb=60 dr=60 sim=60 held=0 gap=1 rown=60 gs=2";
  [healthy, slowMinute].forEach((row, minute) => {
    const lines = Array.from({ length: 60 }, (_, second) => `r t=${(minute * 60 + second + 1) * 1000} ${minute === 1 && second >= 60 - results ? "ph=3 cb=60 dr=60 sim=0 held=0 gap=0 rown=0 gs=2" : row}`);
    writeFileSync(join(folder, `smashcraft-rates-x-${minute}.txt`), [`smashcraft-rates v=1 load=x minute=${minute}`, ...lines].join("\n"));
  });
  return sessionRateReport(folder).find(line => line.startsWith("  fork:"));
}

test("the session report names one fork per load: none, game speed, Warcraft callbacks (render- or timer-bound) or echo wait, from match seconds under 55 sim/s [k3 measure #564]", () => {
  expect(forkLine("ph=2 cb=60 dr=60 sim=58 held=0 gap=1 rown=60 gs=2")).toBe("  fork: none (sim held ≥55/s every minute)");
  expect(forkLine("ph=2 cb=48 dr=48 sim=48 held=0 gap=1 rown=48 gs=1")).toBe("  fork: game-speed (gs=1 Normal), onset min 1 t 120s");
  expect(forkLine("ph=2 cb=40 dr=40 sim=40 held=0 gap=1 rown=40 gs=2")).toBe("  fork: callbacks (Warcraft delivered cb 40.0/s, draw 40.0/s, sim 40.0/s; render-bound when draw falls with cb) render-bound, onset min 1 t 120s");
  expect(forkLine("ph=2 cb=40 dr=60 sim=40 held=0 gap=1 rown=40 gs=2")).toEndWith(") timer-bound, onset min 1 t 120s");
  expect(forkLine("ph=2 cb=40 dr=40 sim=40 held=0 gap=1 rown=40 gs=2", 35)).toEndWith(") render-bound, onset min 1 t 85s");
  expect(forkLine("ph=2 cb=60 dr=60 sim=30 held=30 gap=4 rown=30 gs=2")).toBe("  fork: echo-wait (cb 60.0/s, sim 30.0/s, held 50%, gap 4.0, own echo 30.0/s), onset min 1 t 120s");
});
