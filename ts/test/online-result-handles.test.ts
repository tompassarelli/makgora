import { expect, test } from "bun:test";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase, ResultPick } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { pickResult } from "../src/host/loop/menus";
import { shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(PREDICTED_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-online-result-handles", devConsole: true };
const HANDLE_LIFE = /^(?:Add(?:SpecialEffect|Lightning)\w*|Create\w+|BlzCreate\w+|Destroy\w+|BlzDestroy\w+|Remove\w+)$/;
const KEYS = presetBindings(DEFAULT_PRESET);
const key = (action: Action) => keyFor(KEYS, action, 0) ?? 0;

const drift = (frame: number) => (Math.abs((frame % 24) - 12) / 12) * 0.1;

test("two online clients whose frame clocks drift apart create and destroy Warcraft handles on the same turns through a KO that ends the match, its results and the way back to character select [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 732) });
  const [early, late] = clients.clients;
  if (early === undefined || late === undefined) throw new Error("two clients expected");
  for (const client of clients.clients) client.natives.os = { clock: () => client.clockSeconds() };
  const phase = () => {
    let shown = -1;
    early.run(() => { shown = shellState()?.game.phase ?? -1; });
    return shown;
  };
  const step = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      const next = clients.frame + 1;
      early.setWallTime(next / 60);
      late.setWallTime(next / 60 + drift(next));
      clients.frames(1);
      const turns = clients.clients.map(client => {
        const made = client.log.filter(({ name }) => HANDLE_LIFE.test(name)).map(({ name, args }) => `${name}(${args.map(String).join(", ")})`);
        client.forget(client.log.length);
        return made;
      });
      expect({ frame: clients.frame, phase: phase(), handles: turns[1] }).toEqual({ frame: clients.frame, phase: phase(), handles: turns[0] });
    }
  };
  const until = (wanted: number, limit: number) => {
    for (let frame = 0; frame < limit && phase() !== wanted; frame++) step(1);
    expect(phase()).toBe(wanted);
  };
  clients.start();
  step(30);
  passStartControls(clients, step);
  clients.chat(0, "-dev setup quick pair grom hellscream / murloc;percent 1 999;beside 2 1");
  until(Phase.match, 600);
  step(90);
  clients.key(1, key(Action.cUp), 0, true);
  step(4);
  clients.key(1, key(Action.cUp), 0, false);
  until(Phase.result, 400);
  step(240);
  for (const slot of [0, 1]) clients.everywhere(() => { const s = shellState(); if (s !== undefined) pickResult(s, slot, ResultPick.characters); });
  until(Phase.characterMenu, 600);
  step(120);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
