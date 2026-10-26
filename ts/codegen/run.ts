import { relative } from "node:path";
import { CONTROLLER_CONTRACT_PATH, controllerContractText, padLayoutProducers } from "./controllerContract";
import * as fighterArtData from "./fighterArtData";
import * as fighterDifference from "./fighterDifference";
import * as fighterState from "./fighterState";
import { syncGenerated, tsRoot } from "./sync";

const producers = [
  { output: fighterState.output, render: fighterState.renderFighterState },
  ...fighterArtData.producers(),
  { output: fighterDifference.output, render: fighterDifference.renderFighterDifference },
  { output: relative(tsRoot, CONTROLLER_CONTRACT_PATH), render: controllerContractText },
  ...padLayoutProducers.map(({ path, render }) => ({ output: relative(tsRoot, path), render })),
];
const check = process.argv.includes("--check");
const drifted = syncGenerated(producers, [fighterArtData.rulesDirectory], check);
if (check && drifted.length > 0) {
  console.error(`generated files drift from their producers; run \`bun run generate\` in ts/: ${drifted.join(", ")}`);
  process.exit(1);
}
for (const path of drifted) console.log(`wrote ${path}`);
