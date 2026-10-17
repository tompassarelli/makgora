import { afterAll, beforeAll } from "bun:test";
import { installHeadless, type HeadlessRuntime } from "wisp/scripts/wisp/headless";
import { Action } from "../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../src/game/input/keyBindings";

export function testHeadless(...options: Parameters<typeof installHeadless>): HeadlessRuntime {
  let runtime: HeadlessRuntime;
  beforeAll(() => { runtime = installHeadless(...options); });
  afterAll(() => runtime?.restore());
  return {
    clients: (...args) => runtime.clients(...args),
    modules: (...args) => runtime.modules(...args),
    restore: () => runtime.restore(),
  };
}

const DEFAULT_KEYS = presetBindings(DEFAULT_PRESET);
export const RIGHT_KEY = keyFor(DEFAULT_KEYS, Action.moveRight, 0) ?? 0;
export const LEFT_KEY = keyFor(DEFAULT_KEYS, Action.moveLeft, 0) ?? 0;
