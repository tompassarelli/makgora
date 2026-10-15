import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as fighterState from "./fighterState";

const producers = [{ output: fighterState.output, render: fighterState.renderFighterState }];
const check = process.argv.includes("--check");
const root = resolve(import.meta.dir, "..");
const drifted: string[] = [];
for (const producer of producers) {
  const path = resolve(root, producer.output);
  const text = producer.render();
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === text) continue;
  if (check) {
    drifted.push(producer.output);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ts/${producer.output}`);
}
if (drifted.length > 0) {
  console.error(`generated files drift from their producers; run \`bun run generate\` in ts/: ${drifted.join(", ")}`);
  process.exit(1);
}
