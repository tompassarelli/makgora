import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { install, startBuild } from "../src/platform/main";
import { Action } from "../src/game/input/actions";
import { LEFT_SHIFT, RIGHT_SHIFT, keyFor } from "../src/game/input/keyBindings";
import { beginBindingCapture, bindFirstUnbound, clearKey } from "../src/game/ui/bindingSettings";
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

const META_SHIFT = 1;
const META_MASKS = [[0, 0], [META_SHIFT, 0], [META_SHIFT, META_SHIFT], [0, META_SHIFT]] as const;

test("Shift binds on the controls screen whichever meta mask its own press and release carry, and a bound Shift never hides other keys [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const host = clients.client(0);
  const read = <T>(body: () => T): T => {
    let result: T | undefined;
    host.run(() => { result = body(); });
    return result as T;
  };
  const settings = () => shell().participants[0].bindings;
  clients.start();
  for (let frame = 0; frame < 240 && !controlsGreeted(host); frame++) clients.frames(1);
  expect(controlsGreeted(host)).toBe(true);
  for (const [key, action] of [[LEFT_SHIFT, Action.leftTrigger], [RIGHT_SHIFT, Action.lightShield]] as const) {
    for (const [down, up] of META_MASKS) {
      host.run(() => beginBindingCapture(settings(), action, 0));
      clients.key(0, key, down, true);
      clients.key(0, key, up, false);
      clients.frames(2);
      expect(read(() => keyFor(settings().bindings, action, 0))).toBe(key);
      expect(read(() => settings().capture)).toBeUndefined();
    }
  }
  host.run(() => beginBindingCapture(settings(), Action.attack, 0));
  clients.key(0, LEFT_SHIFT, META_SHIFT, true);
  clients.key(0, Key.u, META_SHIFT, true);
  clients.key(0, Key.u, META_SHIFT, false);
  clients.key(0, LEFT_SHIFT, 0, false);
  clients.frames(2);
  expect(read(() => keyFor(settings().bindings, Action.attack, 0))).toBe(LEFT_SHIFT);
  expect(host.errors).toEqual([]);
});
