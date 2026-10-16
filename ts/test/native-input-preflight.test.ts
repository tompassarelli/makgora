import { expect, test } from "bun:test";
import { INPUT_PREFLIGHT_FILE } from "../src/game/core/gameFiles";
import { NATIVE_PREFLIGHT_KEY, inputPreflightLine } from "../src/game/input/nativePreflight";
import { PLAYABLE_BUILD } from "../src/game/session/currentBuild";
import { entryFor } from "./desync/journeys";
import { testHeadless } from "./headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = testHeadless(SMASHCRAFT_HEADLESS);

test("native preflight writes a key trace only on the client that received the probe [k1 scenario]", () => {
  const clients = headless.clients(entryFor(PLAYABLE_BUILD), [0, 1]);
  clients.start();
  clients.frames(30);
  expect(clients.client(0).files.get(INPUT_PREFLIGHT_FILE)).toBeUndefined();
  expect(clients.client(1).files.get(INPUT_PREFLIGHT_FILE)).toBeUndefined();
  for (const slot of [0, 1]) {
    clients.press(slot, NATIVE_PREFLIGHT_KEY.code);
    clients.frames(1);
    expect(clients.client(slot).files.get(INPUT_PREFLIGHT_FILE)).toEqual([inputPreflightLine(PLAYABLE_BUILD.id)]);
    if (slot === 0) expect(clients.client(1).files.get(INPUT_PREFLIGHT_FILE)).toBeUndefined();
  }
  expect(clients.clients.flatMap(client => client.errors)).toEqual([]);
});
