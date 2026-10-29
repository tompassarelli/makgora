import { expect, test } from "bun:test";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";
import { Phase } from "../src/game/lobby/lobbyState";
import type { MapBuild } from "../src/game/session/build";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { Character, ParasolState } from "../src/game/sim/codes";
import { Key } from "../src/host/loop/keyEvents";
import { panelActions } from "../src/host/loop/menus";
import { shellState } from "../src/host/loop/state";
import { install, startBuild } from "../src/platform/main";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { passStartControls } from "../scripts/wisp/startControls";
import { testHeadless } from "./headless";

const headless = testHeadless(PREDICTED_HEADLESS);

const BUILD: MapBuild = { ...PLAYABLE_BUILD, id: "typescript-online-handles" };
const HANDLE_LIFE = /^(?:Add(?:SpecialEffect|Lightning)\w*|Create\w+|BlzCreate\w+|Destroy\w+|BlzDestroy\w+|Remove\w+)$/;
const KEYS = presetBindings(DEFAULT_PRESET);
const key = (action: Action) => keyFor(KEYS, action, 0) ?? 0;
const PARASOL_OPENS = 3;
const OPEN_EVERY = 150;

// A client paces frames by its own os.clock, so this one runs up to a frame and a half ahead of the other and back.
const drift = (frame: number) => (Math.abs((frame % 24) - 12) / 12) * 0.025;

test("two online clients whose frame clocks drift apart create and destroy Warcraft handles on the same turns while Chen opens and folds his parasol [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(BUILD) }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 681) });
  const [early, late] = clients.clients;
  if (early === undefined || late === undefined) throw new Error("two clients expected");
  for (const client of clients.clients) client.natives.os = { clock: () => client.clockSeconds() };
  const matchFrame = () => {
    let shown = -1;
    early.run(() => { shown = shellState()?.game.matchFrame ?? -1; });
    return shown;
  };
  const phase = () => {
    let shown = -1;
    early.run(() => { shown = shellState()?.game.phase ?? -1; });
    return shown;
  };
  const turns: string[][] = [[], []];
  let open = false;
  let opens = 0;
  const step = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      const next = clients.frame + 1;
      early.setWallTime(next / 60);
      late.setWallTime(next / 60 + drift(next));
      clients.frames(1);
      clients.clients.forEach((client, index) => {
        turns[index] = client.log.filter(({ name }) => HANDLE_LIFE.test(name)).map(({ name, args }) => `${name}(${args.map(String).join(", ")})`);
        client.forget(client.log.length);
      });
      early.run(() => {
        const now = shellState()?.world.fighters[0]?.special.parasol === ParasolState.open;
        if (now && !open) opens++;
        open = now;
      });
      expect({ frame: clients.frame, handles: turns[1] }).toEqual({ frame: clients.frame, handles: turns[0] });
    }
  };
  const play = (count: number) => {
    const until = matchFrame() + count;
    for (let frame = 0; frame < count * 4 && matchFrame() < until; frame++) step(1);
    expect(matchFrame()).toBeGreaterThanOrEqual(until);
  };
  clients.start();
  step(30);
  passStartControls(clients, step);
  clients.everywhere(() => panelActions().selection.selectChoice(0, Character.chen));
  clients.everywhere(() => panelActions().selection.selectChoice(1, Character.blademaster));
  clients.everywhere(() => panelActions().selection.start(0));
  for (let frame = 0; frame < 120 && phase() !== Phase.stageMenu; frame++) step(1);
  clients.press(0, Key.y);
  for (let frame = 0; frame < 240 && phase() !== Phase.match; frame++) step(1);
  expect(phase()).toBe(Phase.match);
  play(200);
  for (let attempt = 0; attempt < PARASOL_OPENS; attempt++) {
    clients.press(0, key(Action.jump));
    play(8);
    clients.key(0, key(Action.moveUp), 0, true);
    clients.key(0, key(Action.special), 0, true);
    play(46);
    clients.key(0, key(Action.special), 0, false);
    play(30);
    clients.key(0, key(Action.moveUp), 0, false);
    clients.key(0, key(Action.moveDown), 0, true);
    play(4);
    clients.key(0, key(Action.moveDown), 0, false);
    play(OPEN_EVERY - 88);
  }
  expect(opens).toBe(PARASOL_OPENS);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
