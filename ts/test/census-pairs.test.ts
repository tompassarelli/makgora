import { expect, test } from "bun:test";
import { join } from "node:path";
import { ALLOCATION_JITTER_KB, PAIR_MARGIN, comparePairs, parsePairs } from "../scripts/wisp/perfPairs";

const recorded = async (commit: string) => parsePairs(await Bun.file(join(import.meta.dir, "fixtures/census", `${commit}.txt`)).text());

test("the census pairs pass a bundle change's allocation relayout and fail a worst frame that rises past the jitter [k3 measure #26]", async () => {
  const green = await recorded("64fea7b1a4");
  const relayout = await recorded("9bd89e9df1");
  expect(comparePairs(green, relayout)).toEqual([]);
  const risen = (pair: string, kb: number) => relayout.map((row) => (row.pair === pair ? { ...row, allocatedKb: kb } : row));
  const medivh = green.find((row) => row.pair === "medivh vs rifleman");
  if (medivh === undefined) throw new Error("the recorded census has no medivh pair");
  const past = Math.max(medivh.allocatedKb * (1 + PAIR_MARGIN), medivh.allocatedKb + ALLOCATION_JITTER_KB) + 0.1;
  expect(comparePairs(green, risen("medivh vs rifleman", past))).toEqual([expect.stringContaining("medivh vs rifleman worst-frame allocation")]);
  const instructions = relayout.map((row) => (row.pair === "medivh vs rifleman" ? { ...row, instructions: Math.ceil(medivh.instructions * (1 + PAIR_MARGIN)) + 100 } : row));
  expect(comparePairs(green, instructions)).toEqual([expect.stringContaining("medivh vs rifleman worst-frame instructions")]);
});
