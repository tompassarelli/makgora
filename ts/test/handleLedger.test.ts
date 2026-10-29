import { expect, test } from "bun:test";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { handleLedger } from "../src/host/loop/handleLedger";
import { install, startBuild } from "../src/platform/main";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(PREDICTED_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-handle-ledger" };

test("two online clients agree on their Warcraft handle ledger, and a timer only one of them creates is named, with its tick, on both clients [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 681) });
  const [early, late] = clients.clients;
  if (early === undefined || late === undefined) throw new Error("two clients expected");
  const lines = () => clients.clients.map((client) => {
    let shown: string[] = [];
    client.run(() => { shown = [...handleLedger().lines]; });
    return shown;
  });
  clients.start();
  clients.frames(30);
  passStartControls(clients, (count) => clients.frames(count));
  clients.frames(600);
  expect(lines()).toEqual([[], []]);
  let skewed = -1;
  late.run(() => {
    skewed = handleLedger().tick;
    CreateTimer();
  });
  clients.frames(300);
  const [earlyLines, lateLines] = lines();
  expect(earlyLines).toEqual([`handle ledger: p0 and p1 differ at tick ${skewed}: p0 made or freed 0 () and p1 1 (CreateTimer)`]);
  expect(lateLines).toEqual([`handle ledger: p1 and p0 differ at tick ${skewed}: p1 made or freed 1 (CreateTimer) and p0 0 ()`]);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
