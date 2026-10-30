import { expect, test } from "bun:test";
import { join } from "node:path";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { install, start } from "../src/host/entries/playableMain";
import { compileLua, luaLines, recordedLines } from "./golden/luaRecord";
import { GOLDEN_PREFIX, ONLINE_PLAYERS, onlineDelivery, playOnlineGolden } from "./golden/onlineMatch";
import { testHeadless } from "./headless";

const RECORD = "online-golden.txt";
const tsDirectory = join(import.meta.dir, "..");

const headless = testHeadless(PREDICTED_HEADLESS);

test("four humans on the relay at 1% seeded loss roll back from the recorded frames to the recorded depths and confirm the recorded checksum every 60th frame, in Bun and in 32-bit Lua [k1 scenario]", async () => {
  const clients = headless.clients({ install, start }, ONLINE_PLAYERS, { delivery: onlineDelivery() });
  const bun = playOnlineGolden(clients, { begin: () => undefined, typed: () => undefined });
  const recorded = recordedLines(RECORD, bun);
  expect(bun).toEqual(recorded);
  compileLua("playable");
  const lua = await luaLines("online-golden", "online-golden.lua", [join(tsDirectory, "build/playable.lua"), join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts")]);
  expect(lua.filter(line => line.startsWith(GOLDEN_PREFIX))).toEqual(recorded);
}, 600_000);
