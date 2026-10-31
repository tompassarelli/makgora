import { join } from "node:path";
import { Effect } from "effect";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { PLAYABLE_BOUNDS, WORLD_BOUNDS } from "../../src/game/presentation/arenaCamera";
import { assetsView, readManifest, wholeFamily } from "./buildInputs";
import { importedAssets } from "./mapInputs";
import { storedPortraits } from "../portraitParts";
import { ensurePackager, MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { mapCueModels } from "./cueModels";
import type { Graphics, ResolvedRenderAsset } from "wisp/scripts/wisp/renderAssets";
import { extractMapImports } from "wisp/scripts/wisp/mapImports";
import { buildProject } from "./project";
import { mapCommitMismatch } from "./mapBuildCommit";
import { type RenderAssetOptions, renderAssetStore } from "./renderAssetStore";

export const checkCueModels = Effect.fnUntraced(function*(renderer: { readonly resolveAsset: (path: string, graphics: Graphics) => Promise<ResolvedRenderAsset> } = headlessRender(), models: readonly string[] = mapCueModels()) {
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


const arena = () => ({
  unitModels: Object.fromEntries(Object.values(FIGHTER_OBJECTS).map(({ id, model }) => [id, model])),
  // Warcraft draws no effects outside base-map world bounds (#297, #298).
  terrain: { bounds: { minX: WORLD_BOUNDS.left, maxX: WORLD_BOUNDS.right, minY: WORLD_BOUNDS.front, maxY: WORLD_BOUNDS.back }, origin: [0.0, PLAYABLE_BOUNDS.centreY] as const },
});

/** Art for a player with no source tree: the downloaded map's own files, then the Warcraft install, and no private build-input store. */
export const playerRender = (map: string) => Effect.gen(function*() {
  const { packager } = buildProject();
  yield* ensurePackager(packager);
  const imports = yield* extractMapImports(map, packager);
  const mismatch = yield* mapCommitMismatch(map, imports);
  if (mismatch !== undefined) return yield* new MapBuildFailure({ operation: "match the map to this checkout", path: map, cause: mismatch });
  const { resolveAsset, readAsset } = renderAssetStore({ imports });
  return { ...arena(), resolveAsset, readAsset };
});

export function headlessRender(options: RenderAssetOptions = {}) {
  const { resolveAsset, readAsset } = renderAssetStore(options, (assets, manifest) => Effect.gen(function*() {
    return yield* importedAssets(assets, yield* wholeFamily(manifest, "summon"));
  }));
  return {
    ...arena(),
    resolveAsset,
    readAsset,
    get portraits() {
      return storedPortraits(join(options.assets ?? assetsView(Effect.runSync(readManifest())), "fighter-renders"));
    },
  };
}
