import { existsSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { MapBuildFailure, type ArchiveEntry } from "wisp/scripts/wisp/mapBuild";
import { DEFINITIVE_FIGHTERS } from "../../src/game/assets/definitiveFighters";
import { originalClip } from "../../src/generated/clips/fighterOriginalClipInfo";

const DEFINITIVE_BODIES = [...DEFINITIVE_FIGHTERS].flatMap((character) => {
  const body = originalClip(character, 0)?.modelPath;
  return body?.includes("TimelineBody-") === true ? [body] : [];
});

/** Fails when a fighter that ships its Definitive look has no Definitive body, which would draw its Classic body in Definitive. */
export const requireDefinitiveBodies = (assets: string) => Effect.gen(function*() {
  const directory = join(assets, "original-clips-static-lights/imports/_de.w3mod");
  const bodiless = DEFINITIVE_BODIES.filter((entry) => !existsSync(join(directory, entry.replaceAll("\\", "/"))));
  if (bodiless.length === 0) return;
  return yield* new MapBuildFailure({ operation: "find Definitive bodies", path: directory, cause: `${bodiless.join(", ")} ship a Definitive look but have no Definitive body; regenerate each fighter with tools/animations/timeline-models.ts` });
});

/** A Classic body or white's `_de.w3mod` entry, served only from its Definitive copy: a Classic body there would look up its stock textures in `_de.w3mod` alone. */
export function definitiveOverride(entry: string, generated: readonly ArchiveEntry[], clipDirectory: string): ArchiveEntry[] {
  const override = `_de.w3mod\\${entry}`;
  const body = join(clipDirectory, "imports/_de.w3mod", entry.replaceAll("\\", "/"));
  const source = generated.find((asset) => asset.entry === override)?.source ?? (existsSync(body) ? body : undefined);
  return source === undefined ? [] : [{ entry: override, source }];
}
