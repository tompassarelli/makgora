import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { assetsView, readManifest } from "../scripts/wisp/buildInputs";
import { RENDERED_FIGHTERS, fighterRenderName } from "../src/game/roster/kits";
import { RECEIPTS, sourceModelHash, stalePortraits } from "../scripts/portraitParts";

const assets = assetsView(Effect.runSync(readManifest()));
const renders = join(assets, "fighter-renders");

test("every fighter's stored portraits record the hash of the model input they were rendered from [k5 boundary stored-portrait-sources]", () => {
  expect(stalePortraits(assets, renders)).toEqual([]);
});

test("a model swap, or a receipt with no recorded hash, is reported against its fighter [k2 property]", () => {
  const character = RENDERED_FIGHTERS[0]!, name = fighterRenderName(character);
  const swapped = mkdtempSync(join(tmpdir(), "portrait-sources-"));
  mkdirSync(join(swapped, RECEIPTS));
  const current = sourceModelHash(assets, character);
  const other = createHash("sha256").update("another model").digest("hex");
  writeFileSync(join(swapped, RECEIPTS, `FighterBust${name}P1.json`), JSON.stringify({ source: current }));
  writeFileSync(join(swapped, RECEIPTS, `FighterBust${name}P2.json`), JSON.stringify({ source: other }));
  writeFileSync(join(swapped, RECEIPTS, `FighterBust${name}P3.json`), JSON.stringify({}));
  const stale = stalePortraits(assets, swapped).filter((line) => line.startsWith(`${name} `));
  expect(stale.map((line) => line.split(":")[0])).toEqual([`${name} P2`, `${name} P3`, `${name} P4`]);
  expect(stale[0]).toContain(other);
});
