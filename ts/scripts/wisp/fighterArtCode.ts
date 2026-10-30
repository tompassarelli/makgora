import { join, relative } from "node:path";
import { ImportGraph } from "wisp/scripts/wisp/importGraph";
import { projectRoot } from "./projectRoot";

export type StepName = "clips" | "bodies" | "flashes" | "costumes";

export const STEP_TOOLS: Readonly<Record<StepName, string>> = {
  clips: "tools/animations/export-original-clips.ts",
  bodies: "tools/animations/timeline-models.ts",
  flashes: "tools/animations/white-flash-models.ts",
  costumes: "tools/animations/costume-bodies.ts",
};

const GENERATED = [/^ts\/src\/generated\/clips\//, /^ts\/src\/generated\/costumes\//, /^ts\/src\/generated\/assets\/white-(models|facts)\//, /^ts\/src\/generated\/assets\/white(FighterModels|ModelFacts)\.ts$/];

const LOCKS = ["ts/package.json", "ts/bun.lock", "tools/animations/package.json", "tools/animations/bun.lock"];

export function stepCode(tool: string): string[] {
  const graph = new ImportGraph(projectRoot), entry = join(projectRoot, tool);
  graph.add([entry]);
  const files = [...graph.dependencies(entry)].map((path) => relative(projectRoot, path)).filter((path) => !GENERATED.some((pattern) => pattern.test(path)));
  return [...files, ...LOCKS].sort();
}

export const derivedStepCode = (): ReadonlySet<string> => new Set(Object.values(STEP_TOOLS).flatMap(stepCode));
