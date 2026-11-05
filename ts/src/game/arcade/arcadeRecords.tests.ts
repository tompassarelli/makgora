import { assertEquals, assertFalse, test } from "wisp/src/runtime/testing";
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
