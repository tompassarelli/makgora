import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import type { CpuTier } from "../match/cpuProfiles";
import type { RunScore } from "./score";
import { ARCADE_RECORDS_FILE, ArcadeRecords, type ChunkFiles } from "./arcadeRecords";

function assertBest(records: ArcadeRecords, slug: string, tier: CpuTier, expected: RunScore): void {
  const best = records.best(slug, tier);
  assertEquals(best?.total, expected.total);
  assertEquals(best?.runSeconds, expected.runSeconds);
}

function memoryFiles(initial: string[] = []): ChunkFiles & { readonly stored: Map<string, string[]>; reads: number } {
  const stored = new Map<string, string[]>();
  if (initial.length > 0) stored.set(ARCADE_RECORDS_FILE, initial);
  const files = {
    stored,
    reads: 0,
    read(filename: string): string[] {
      files.reads++;
      return stored.get(filename) ?? [];
    },
    write(filename: string, chunks: readonly string[]): boolean {
      stored.set(filename, [...chunks]);
      return true;
    },
  };
  return files;
}

test("a Warchief clear is written and a second instance over the same file reads it back with its score and its fighter's other tiers empty [k2 property]", () => {
  const files = memoryFiles();
  const first = new ArcadeRecords(files);
  assertTrue(first.recordClear("thrall", "warchief", { total: 11200, runSeconds: 640 }));
  const second = new ArcadeRecords(files);
  assertTrue(second.cleared("thrall", "warchief"));
  assertBest(second, "thrall", "warchief", { total: 11200, runSeconds: 640 });
  assertFalse(second.cleared("thrall", "peon"));
  assertFalse(second.cleared("thrall", "grunt"));
  assertFalse(second.cleared("arthas", "warchief"));
  assertEquals(second.rank("thrall"), 0);
});

test("a lower score does not replace the best, an equal score on a longer run does not, and a higher or equal-and-faster one does [k2 property]", () => {
  const files = memoryFiles();
  const records = new ArcadeRecords(files);
  records.recordClear("thrall", "grunt", { total: 9000, runSeconds: 600 });
  assertFalse(records.recordClear("thrall", "grunt", { total: 8999, runSeconds: 300 }));
  assertFalse(records.recordClear("thrall", "grunt", { total: 9000, runSeconds: 601 }));
  assertBest(new ArcadeRecords(files), "thrall", "grunt", { total: 9000, runSeconds: 600 });
  assertTrue(records.recordClear("thrall", "grunt", { total: 9000, runSeconds: 590 }));
  assertTrue(records.recordClear("thrall", "grunt", { total: 9500, runSeconds: 900 }));
  assertBest(new ArcadeRecords(files), "thrall", "grunt", { total: 9500, runSeconds: 900 });
});

test("tiers and fighters keep separate records, and a negative score survives the round trip [k2 property]", () => {
  const files = memoryFiles();
  const records = new ArcadeRecords(files);
  records.recordClear("thrall", "peon", { total: -1500, runSeconds: 700 });
  records.recordClear("thrall", "warchief", { total: 12000, runSeconds: 610 });
  records.recordClear("arthas", "grunt", { total: 10000, runSeconds: 650 });
  const reread = new ArcadeRecords(files);
  assertBest(reread, "thrall", "peon", { total: -1500, runSeconds: 700 });
  assertBest(reread, "thrall", "warchief", { total: 12000, runSeconds: 610 });
  assertBest(reread, "arthas", "grunt", { total: 10000, runSeconds: 650 });
  assertFalse(reread.cleared("arthas", "warchief"));
});

test("a malformed file reads as empty and a later clear replaces it with a valid one [k2 property]", () => {
  for (const text of ["garbage", "thrall,0,-,-", "thrall,x,-,-,-", "thrall,0,12:,-,-", "thrall,0,12:3:4,-,-", "thrall,0,-,-,-|", "thrall,0,-1:5,-,-|arthas"]) {
    const files = memoryFiles([text]);
    const records = new ArcadeRecords(files);
    assertFalse(records.cleared("thrall", "peon"));
    assertFalse(records.cleared("thrall", "warchief"));
    assertEquals(records.rank("thrall"), 0);
    assertTrue(records.recordClear("thrall", "grunt", { total: 100, runSeconds: 5 }));
    assertBest(new ArcadeRecords(files), "thrall", "grunt", { total: 100, runSeconds: 5 });
  }
});

test("the file is read once and later reads come from memory, and a long record is cut into chunks of 200 characters [k5 boundary arcade-records-file]", () => {
  const files = memoryFiles();
  const records = new ArcadeRecords(files);
  for (let index = 0; index < 31; index++) records.recordClear(`fighter${index}`, "warchief", { total: 10000 + index, runSeconds: 600 });
  records.best("fighter0", "warchief");
  records.cleared("fighter1", "peon");
  assertEquals(files.reads, 1);
  const chunks = files.stored.get(ARCADE_RECORDS_FILE) ?? [];
  assertTrue(chunks.length > 1);
  assertTrue(chunks.every(chunk => chunk.length <= 200));
  assertTrue(new ArcadeRecords(files).cleared("fighter30", "warchief"));
});
