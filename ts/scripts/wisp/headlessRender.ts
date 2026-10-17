import { join } from "node:path";
import { Effect } from "effect";
import { FIGHTER_OBJECTS } from "../../src/game/objectData";
import { PLAYABLE_BOUNDS, WORLD_BOUNDS } from "../../src/game/presentation/arenaCamera";
import { assetsView, readManifest, wholeFamily } from "./buildInputs";
import { importedAssets } from "./mapInputs";
import { storedPortraits } from "../portraitParts";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { type Look, cueModels, listedRedraws, redrawCandidates, redrawProblem, unlistedRedraws } from "./cueModels";
import type { Graphics, ResolvedRenderAsset } from "wisp/scripts/wisp/renderAssets";
import { type RenderAssetOptions, renderAssetStore } from "./renderAssetStore";

export const cueModelLooks = Effect.fnUntraced(function*(renderer: { readonly resolveAsset: (path: string, graphics: Graphics) => Promise<ResolvedRenderAsset> } = headlessRender(), models: readonly string[] = [...new Set([...cueModels(), ...redrawCandidates()])]) {
  const missing: string[] = [];
  const looks = new Map<string, Look>();
  for (const model of models) {
    const [classic, definitive] = yield* Effect.tryPromise({
      try: () => Promise.all([renderer.resolveAsset(model, "classic"), renderer.resolveAsset(model, "definitive")]),
      catch: cause => new MapBuildFailure({ operation: "resolve cue model", path: model, cause }),
    });
    for (const [graphics, resolved] of [["classic", classic], ["definitive", definitive]] as const) if (resolved.bytes === undefined || resolved.bytes.length === 0) missing.push(`${graphics}: ${model}`);
    if (classic.bytes !== undefined && definitive.bytes !== undefined) looks.set(model, Buffer.from(classic.bytes).equals(Buffer.from(definitive.bytes)) ? "same" : "redrawn");
  }
  if (missing.length > 0) return yield* new MapBuildFailure({ operation: "check cue models", path: "Classic and Definitive", cause: missing.join("; ") });
  return looks;
});

export const checkCueModels = Effect.fnUntraced(function*(renderer: { readonly resolveAsset: (path: string, graphics: Graphics) => Promise<ResolvedRenderAsset> } = headlessRender(), models: readonly string[] = cueModels()) {
  const candidates = redrawCandidates();
  const looks = yield* cueModelLooks(renderer, [...new Set([...models, ...candidates])]);
  const redrawn = unlistedRedraws(candidates, listedRedraws(), looks);
  if (redrawn.length > 0) return yield* new MapBuildFailure({ operation: "check Definitive redraws", path: "src/game/presentation", cause: redrawProblem(redrawn) });
  return models.length * 2;
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
