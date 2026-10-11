import { afterAll, beforeAll } from "bun:test";
import { installHeadless, type HeadlessRuntime } from "wisp/scripts/wisp/headless";

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
