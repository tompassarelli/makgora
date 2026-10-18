import { join } from "node:path";
import { Effect } from "effect";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { PLAYABLE_BOUNDS, WORLD_BOUNDS } from "../../src/game/presentation/arenaCamera";
import { assetsView, readManifest, wholeFamily } from "./buildInputs";
import { importedAssets } from "./mapInputs";
import { storedPortraits } from "../portraitParts";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { cueModels } from "./cueModels";
import type { Graphics, ResolvedRenderAsset } from "wisp/scripts/wisp/renderAssets";
import { type RenderAssetOptions, renderAssetStore } from "./renderAssetStore";

export const checkCueModels = Effect.fnUntraced(function*(renderer: { readonly resolveAsset: (path: string, graphics: Graphics) => Promise<ResolvedRenderAsset> } = headlessRender(), models: readonly string[] = cueModels()) {
  const missing: string[] = [];
  for (const model of models) {
    const resolved = yield* Effect.tryPromise({
      try: () => renderer.resolveAsset(model, "classic"),
      catch: cause => new MapBuildFailure({ operation: "resolve cue model", path: model, cause }),
    });
    if (resolved.bytes === undefined || resolved.bytes.length === 0) missing.push(model);
  }
  if (missing.length > 0) return yield* new MapBuildFailure({ operation: "check cue models", path: "Classic", cause: missing.join("; ") });
  return models.length;
});


export function headlessRender(options: RenderAssetOptions = {}) {
  const { resolveAsset, readAsset } = renderAssetStore(options, (assets, manifest) => Effect.gen(function*() {
    return yield* importedAssets(assets, yield* wholeFamily(manifest, "summon"));
  }));
  return {
    unitModels: Object.fromEntries(Object.values(FIGHTER_OBJECTS).map(({ id, model }) => [id, model])),
    // Warcraft draws no effects outside base-map world bounds (#297, #298).
    terrain: { bounds: { minX: WORLD_BOUNDS.left, maxX: WORLD_BOUNDS.right, minY: WORLD_BOUNDS.front, maxY: WORLD_BOUNDS.back }, origin: [0.0, PLAYABLE_BOUNDS.centreY] as const },
    resolveAsset,
    readAsset,
    get portraits() {
      return storedPortraits(join(options.assets ?? assetsView(Effect.runSync(readManifest())), "fighter-renders"));
    },
  };
}
