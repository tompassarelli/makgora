import { expect, test } from "bun:test";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

test("a pad's match replay is written by a driver reset alone, with no later pad [k1 scenario]", async () => {
  const platform = join(import.meta.dir, "../src/platform");
  const entry = await import(join(platform, "../host/entries/nativeDriverMain.ts"));
  const { nativeDriverCommand } = await import(join(platform, "nativeDriver.ts"));
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients(entry, [0]);
    const files = clients.client(0).files;
    const manifests = (): string[] => [...files.keys()].filter(name => /^smashcraft-replay-\d+\.txt$/.test(name));
    clients.start();
    clients.frames(3);
    clients.everywhere(() => nativeDriverCommand("#! chat -dev quick hero illidan stocks 9\n40 a stick 1 0\n"));
    clients.frames(3);
    clients.everywhere(() => nativeDriverCommand("resume 80"));
    clients.frames(200);
    expect(manifests()).toEqual([]);
    clients.everywhere(() => nativeDriverCommand("reset"));
    clients.frames(600);
    expect(manifests().length).toBe(1);
  } finally {
    runtime.restore();
  }
}, 60_000);
