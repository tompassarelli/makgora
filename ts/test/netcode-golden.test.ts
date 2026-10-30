import { expect, test } from "bun:test";
import { netcodeGoldenRecord } from "../src/game/netcode/netcodeGolden";
import { luaLines, recordedLines } from "./golden/luaRecord";

const RECORD = "netcode-golden.txt";

test("the input ledger and the rollback schedule answer seeded in-order, late, duplicate and conflicting rows, rows past the future limit and out of history, epoch changes, a leave and the #233 stall with the recorded receipts, Capture results, cursors, K, held counts and first late frame, in Bun and in 32-bit Lua [k1 scenario]", async () => {
  const bun = netcodeGoldenRecord();
  const recorded = recordedLines(RECORD, bun);
  expect(bun).toEqual(recorded);
  expect(await luaLines("netcode-golden", "netcode-golden.lua")).toEqual(recorded);
}, 120_000);
