import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { Action } from "../src/game/input/actions";
import { keyFor } from "../src/game/input/keyBindings";
import { bindFirstUnbound, clearKey } from "../src/game/ui/bindingSettings";
import { keyboardCaps } from "../src/game/ui/keyboardLayout";
import { Phase } from "../src/game/lobby/lobbyState";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Character } from "../src/game/sim/codes";
import { Key } from "../src/host/loop/keyEvents";
import { panelActions } from "../src/host/loop/menus";
import { shell } from "../src/host/loop/state";
import { controlsGreeted, passStartControls } from "../scripts/wisp/startControls";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("Y pressed during a rebind on the controls screen binds to Strong, and still starts from fighter select [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const host = clients.client(0);
  const read = <T>(body: () => T): T => {
    let result: T | undefined;
    host.run(() => { result = body(); });
    return result as T;
  };
  const settings = () => shell().participants[0].bindings;
  const phase = () => read(() => shell().game.phase);
  clients.start();
  for (let frame = 0; frame < 240 && !controlsGreeted(host); frame++) clients.frames(1);
  expect(controlsGreeted(host)).toBe(true);
  host.run(() => {
    clearKey(settings(), Key.y);
    bindFirstUnbound(settings());
  });
  expect(read(() => settings().capture?.action)).toBe(Action.strong);
  clients.press(0, Key.y);
  clients.frames(2);
  expect(read(() => keyFor(settings().bindings, Action.strong, 0))).toBe(Key.y);
  expect(read(() => settings().capture)).toBeUndefined();
  expect(read(() => settings().message)).toBe("Binding updated.");
  expect(phase()).toBe(Phase.characterMenu);
  const caps = keyboardCaps(f32(0.12), f32(0.465)).map(cap => cap.key);
  expect(caps).toContain(0xdb);
  expect(caps).toContain(0xdd);
  passStartControls(clients);
  clients.press(0, Key.n);
  clients.frames(5);
  clients.everywhere(() => panelActions().selection.cycleMode(0, 1));
  clients.everywhere(() => panelActions().selection.cycleMode(0, 1));
  clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 1, Character.demonHunter));
  clients.press(0, Key.y);
  for (let frame = 0; frame < 120 && phase() !== Phase.stageMenu; frame++) clients.frames(1);
  expect(phase()).toBe(Phase.stageMenu);
  expect(host.errors).toEqual([]);
});
