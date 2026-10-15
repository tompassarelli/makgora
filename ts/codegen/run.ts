import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { CONTROLLER_CONTRACT_PATH, controllerContractText } from "./controllerContract";
import * as fighterState from "./fighterState";

const root = resolve(import.meta.dir, "..");
const producers = [
  { output: fighterState.output, render: fighterState.renderFighterState },
  { output: relative(root, CONTROLLER_CONTRACT_PATH), render: controllerContractText },
];
const check = process.argv.includes("--check");
const drifted: string[] = [];
for (const producer of producers) {
  const path = resolve(root, producer.output);
  const text = producer.render();
  const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  if (current === text) continue;
  const shown = relative(resolve(root, ".."), path);
  if (check) {
    drifted.push(shown);
    continue;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${shown}`);
}
if (drifted.length > 0) {
  console.error(`generated files drift from their producers; run \`bun run generate\` in ts/: ${drifted.join(", ")}`);
  process.exit(1);
}
