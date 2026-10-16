import { Schema } from "effect";
export const Box = Schema.Struct({ issue: Schema.String, title: Schema.String, class: Schema.Literals(["wisp-sufficient", "wisp-plus-one-native-sample", "native-only"]), look: Schema.String, clients: Schema.String, kind: Schema.Literals(["timing", "visual"]), map: Schema.String, script: Schema.String, blockers: Schema.String, parity_evidence: Schema.String });
export type Box = typeof Box.Type;
export const Batch = Schema.Struct({ id: Schema.String, look: Schema.String, clients: Schema.String, kind: Schema.Literals(["timing", "visual"]), map: Schema.String, issues: Schema.Array(Schema.String), scripts: Schema.Array(Schema.Struct({ path: Schema.String, issues: Schema.Array(Schema.String) })), executor: Schema.Literals(["pad", "capture"]), commands: Schema.Array(Schema.Array(Schema.String)) });
export type Batch = typeof Batch.Type;
export const Plan = Schema.Struct({ version: Schema.Literals([1]), wisp: Schema.Array(Box), blocked: Schema.Array(Box), batches: Schema.Array(Batch) });
export type Plan = typeof Plan.Type;
const columns = ["issue", "title", "class", "look", "clients", "kind", "map", "script", "blockers", "parity_evidence"];
export function parseBoxes(text: string): Box[] {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.shift() !== columns.join("\t")) throw new Error("invalid native boxes TSV header");
  return lines.filter(line => line.trim() !== "").map(line => {
    const cells = line.split("\t");
    if (cells.length !== columns.length) throw new Error(`invalid TSV row: ${line}`);
    return Schema.decodeUnknownSync(Box)(Object.fromEntries(columns.map((key, i) => [key, cells[i]])));
  });
}
export function planBoxes(rows: readonly Box[]): Plan {
  const wisp: Box[] = [], blocked: Box[] = [];
  const groups = new Map<string, Box[]>();
  for (const row of rows) {
    if (row.class === "wisp-sufficient") { wisp.push(row); continue; }
    if (row.blockers.trim() !== "" && row.blockers !== "none" || row.script === "none") { blocked.push(row); continue; }
    const key = JSON.stringify([row.look, row.clients, row.map, row.kind, row.script.endsWith(".json")]);
    groups.set(key, [...groups.get(key) ?? [], row]);
  }
  const batches = [...groups.values()].map((group, i): Batch => {
    const first = group[0];
    if (first === undefined) throw new Error("empty batch");
    const scripts = [...new Set(group.map(row => row.script))].map(path => ({ path, issues: [...new Set(group.filter(row => row.script === path).map(row => row.issue))] }));
    const executor = first.script.endsWith(".json") ? "capture" : "pad";
    const commands = executor === "pad" ? [["bun", "wisp", "pad", ...scripts.map(script => script.path), "--map", first.map, "--hot"]] : scripts.map(script => ["bun", "wisp", "native-capture", "batch", "--plan", script.path]);
    return { id: `batch-${i}`, look: first.look, clients: first.clients, kind: first.kind, map: first.map, issues: [...new Set(group.map(row => row.issue))], scripts, executor, commands };
  }).sort((a, b) => Number(a.kind === "timing") - Number(b.kind === "timing"));
  return { version: 1, wisp, blocked, batches };
}
export function shardBatch(batch: Batch, pairs: readonly number[]) {
  if (pairs.length === 0) throw new Error("no free native pairs");
  return pairs.map((pair, index) => ({ pair, scripts: batch.scripts.filter((_, i) => i % pairs.length === index) })).filter(shard => shard.scripts.length > 0);
}
