import { existsSync, readdirSync, readFileSync } from "node:fs";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { decoded } from "wisp/scripts/wisp/farm";

const Cpu = Schema.Struct({ cpuSeconds: Schema.Finite });
const main = Effect.gen(function*() {
  const timings: Record<string, number> = {};
  for (const [directory, kind] of [["shards", "shard"], ["ceiling", "ceiling"], ["probes", "probe"]] as const) {
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory).filter((file) => file.endsWith(".json"))) {
      const parts = file.slice(0, -5).split("_");
      const unit = kind === "probe" ? parts[0] ?? "" : parts.slice(0, 2).join(":");
      const data = yield* decoded(Cpu, readFileSync(`${directory}/${file}`, "utf8"));
      const key = `${kind}/${unit}`;
      timings[key] = (timings[key] ?? 0) + data.cpuSeconds;
    }
  }
  console.log(JSON.stringify(timings));
});
if (import.meta.main) BunRuntime.runMain(main);
