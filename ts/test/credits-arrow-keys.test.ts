import { expect, test } from "bun:test";
import { install, startBuild } from "../src/platform/main";
import { Action } from "../src/game/input/actions";
import { keyFor } from "../src/game/input/keyBindings";
import { INTEGRITY_BUILD } from "../src/game/session/currentBuild";
import { Key } from "../src/host/loop/keyEvents";
import { shell } from "../src/host/loop/state";
import { views } from "../src/host/loop/ui";
import { passStartControls } from "../scripts/wisp/startControls";
import { MAKGORA_HEADLESS } from "../scripts/wisp/headless";
import { testHeadless } from "./headless";

const headless = testHeadless(MAKGORA_HEADLESS);
const ARROW_UP = 0x26;
const ARROW_DOWN = 0x28;

test("on character select the arrow keys scroll an open Credits popup though no layout binds them, and Escape closes it [k1 scenario]", () => {
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0]);
  const host = clients.client(0);
  const read = <T>(body: () => T): T => {
    let result: T | undefined;
    host.run(() => { result = body(); });
    return result as T;
  };
  const credits = () => views(shell()).selections[0].credits;
  clients.start();
  passStartControls(clients);
  expect(read(() => [keyFor(shell().participants[0].bindings.bindings, Action.moveUp, 0), keyFor(shell().participants[0].bindings.bindings, Action.moveDown, 0)])).not.toContain(ARROW_DOWN);
  host.run(() => credits().open());
  clients.press(0, ARROW_DOWN);
  clients.frames(2);
  clients.press(0, ARROW_DOWN);
  clients.frames(2);
  clients.press(0, ARROW_UP);
  clients.frames(2);
  expect(read(() => credits().scroll(-1))).toBe(true);
  expect(read(() => credits().scroll(-1))).toBe(false);
  clients.press(0, Key.escape);
  clients.frames(2);
  expect(read(() => credits().opened())).toBe(false);
  expect(host.errors).toEqual([]);
});
