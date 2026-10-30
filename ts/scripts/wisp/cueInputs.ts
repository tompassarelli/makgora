import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const CUE_MODEL_RECORD = "ts/scripts/wisp/cue-models.tsv";
export const RECORD_COMMAND = "bun scripts/cueModels.ts --record";

export const EFFECT_PLAYBACK_INPUTS = ["ts/scripts/wisp/effectVisibility.ts", "ts/scripts/cueModels.ts", "ts/scripts/wisp/cueModels.ts", "ts/scripts/prePush.ts", "ts/src/host/loop/view.ts", "ts/src/game/presentation/specialCues.ts", "ts/src/game/presentation/attackCues.ts", "ts/src/game/presentation/projectileArt.ts", "ts/src/game/presentation/projectilePose.ts", "ts/wisp.lock", "ts/bun.lock", "ts/package.json", "typescript-toolchain.lock", "ts/src/game/render/specialCueEffects.ts", "ts/src/game/render/projectilePresentation.ts", "ts/src/game/render/hitAreaEffects.ts", "ts/src/game/render/specialEffects.ts", "ts/src/game/render/combatEffects.ts", "ts/src/game/render/placedObjectEffects.ts", "ts/src/game/render/summonPresentation.ts", "build-inputs/"];
export function effectPlaybackInputs(root = join(import.meta.dir, "../../..")): string[] {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const seen = new Set<string>(EFFECT_PLAYBACK_INPUTS);
  const visit = (path: string) => {
    const file = join(root, path);
    if (!existsSync(file) || !/\.tsx?$/.test(path)) return;
    for (const entry of transpiler.scanImports(readFileSync(file, "utf8"))) {
      if (!entry.path.startsWith(".")) continue;
      const base = join(dirname(file), entry.path);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && /\.tsx?$/.test(candidate));
      if (found === undefined) continue;
      const input = relative(root, found);
      if (seen.has(input)) continue;
      seen.add(input);
      visit(input);
    }
  };
  for (const path of EFFECT_PLAYBACK_INPUTS) visit(path);
  return [...seen].sort();
}

export function touchesCueInputs(paths: readonly string[], inputs: ReadonlySet<string>): boolean {
  return paths.some(path => inputs.has(path) || [...inputs].some(input => input.endsWith("/") && path.startsWith(input)));
}
