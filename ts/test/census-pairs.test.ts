import { expect, test } from "bun:test";
import { join } from "node:path";
import { PAIR_MARGIN, comparePairs, parsePairs } from "../scripts/wisp/perfPairs";

const recorded = async (name: string) => parsePairs(await Bun.file(join(import.meta.dir, "fixtures/census", `${name}.txt`)).text());

test("the census pairs pass an inert function's relayout and fail a worst frame that rises past 10%, even by less than 10 KB [k3 measure #26]", async () => {
  const green = await recorded("1819904c6d");
  const relayout = await recorded("1819904c6d-inert");
  expect(comparePairs(green, relayout)).toEqual([]);
  const kobold = green.find((row) => row.pair === "kobold vs rifleman");
  if (kobold === undefined) throw new Error("the recorded census has no kobold pair");
  const past = kobold.allocatedKb * (1 + PAIR_MARGIN) + 0.05;
  expect(past - kobold.allocatedKb).toBeLessThan(10);
  const risen = relayout.map((row) => (row.pair === kobold.pair ? { ...row, allocatedKb: past } : row));
  expect(comparePairs(green, risen)).toEqual([expect.stringContaining("kobold vs rifleman worst-frame allocation")]);
  const instructions = relayout.map((row) => (row.pair === kobold.pair ? { ...row, instructions: Math.ceil(kobold.instructions * (1 + PAIR_MARGIN)) + 100 } : row));
  expect(comparePairs(green, instructions)).toEqual([expect.stringContaining("kobold vs rifleman worst-frame instructions")]);
});
