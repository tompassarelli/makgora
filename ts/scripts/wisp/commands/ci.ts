import { makeCi } from "wisp/scripts/wisp/commands/ci";
import { SMASHCRAFT_DEV } from "./dev";
import { SMASHCRAFT_SOAK } from "./soak";

export const ci = makeCi({
  root: SMASHCRAFT_DEV.root,
  sources: SMASHCRAFT_DEV.sources,
  typeCheck: SMASHCRAFT_DEV.typeCheck,
  tests: SMASHCRAFT_DEV.tests,
  soak: {
    ...SMASHCRAFT_SOAK,
    reads: ["scripts/wisp/model-facts/*.json", "node_modules/wisp/src/natives/warcraft.d.ts"],
  },
});
