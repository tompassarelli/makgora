import { expect, test } from "bun:test";
import { join } from "node:path";
import { Effect } from "effect";
import { assetsView, readManifest } from "../scripts/wisp/buildInputs";
import { stalePortraits } from "../scripts/portraitParts";

const hosted = process.env.GITHUB_ACTIONS === "true";
const assets = assetsView(Effect.runSync(readManifest()));
const renders = join(assets, "fighter-renders");

test.skipIf(hosted)("every fighter's stored portraits record the hash of the model input they were rendered from [k5 boundary stored-portrait-sources]", () => {
  expect(stalePortraits(assets, renders)).toEqual([]);
});
