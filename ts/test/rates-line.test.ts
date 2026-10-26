import { expect, test } from "bun:test";
import { MEASURED_BATTLE_NET, MEASURED_TURN_BURSTS, syncDelivery, turnBursts } from "wisp/src/headless/syncChannel";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { RATES_RECORD_CHARS, installSessionRates } from "../src/host/loop/sessionRates";
import { shellState } from "../src/host/loop/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { parseSessionRates } from "../scripts/wisp/sessionRates";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-rates-line", devConsole: true };
const HUMANS = [0, 1];
const MENU_FRAMES = 120;
const LOBBY_FRAMES = 600;
const MATCH_FRAMES = 600;
const FIELDS = ["echo", "echoMax", "rb", "rbf", "rbd", "bur", "hrun", "drift", "botHit", "botMiss", "sf"];

test("two clients over Battle.net latency write r lines whose per-sender lateness, echo, corrections, replay frames, bursts, drift, bot reuse and failed sends parse as numbers on every match second [k5 boundary rates-line]", () => {
  const clients = headless.clients({ install, start: () => { startBuild(BUILD); installSessionRates(BUILD.id); } }, HUMANS, {
    delivery: syncDelivery(MEASURED_BATTLE_NET, 412), callbacks: turnBursts(MEASURED_TURN_BURSTS, 412),
  });
  clients.start();
  clients.frames(MENU_FRAMES);
  clients.chat(0, "-dev quick cpu wren expert");
  let phase = -1;
  for (let frame = 0; frame < LOBBY_FRAMES && phase !== Phase.match; frame++) {
    clients.frames(1);
    clients.clients[0]?.run(() => { phase = shellState()?.game.phase ?? -1; });
  }
  expect(phase).toBe(Phase.match);
  clients.frames(MATCH_FRAMES);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  HUMANS.forEach((slot, index) => {
    const files = clients.clients[index]?.files ?? new Map<string, string[]>();
    const lines = [...files.entries()].filter(([name]) => name.startsWith("smashcraft-rates-")).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, rows]) => rows);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(RATES_RECORD_CHARS);
    const match = parseSessionRates(lines).seconds.filter(second => second.ph === Phase.match).slice(1);
    expect(match.length).toBeGreaterThan(5);
    const sender = `P${(HUMANS.find(other => other !== slot) ?? -2) + 1}`;
    for (const second of match) {
      for (const name of [...FIELDS, `late${sender}`, `lmax${sender}`]) expect(Number.isFinite(second[name])).toBe(true);
      expect(second.sf).toBe(0);
    }
    const total = (name: string) => match.reduce((sum, second) => sum + (second[name] ?? 0), 0);
    expect(total("echoMax")).toBeGreaterThan(0);
    expect(total("rbf")).toBeGreaterThanOrEqual(total("rb"));
    expect(total("bur")).toBeGreaterThan(0);
  });
}, 30_000);
