import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderAssetStore } from "../scripts/wisp/renderAssetStore";

const unreadable = () => {
  const root = mkdtempSync(join(tmpdir(), "render-asset-strict-"));
  const storage = join(root, "storage"), extractor = join(root, "extract");
  Bun.spawnSync(["mkdir", "-p", storage, join(root, "assets")]);
  writeFileSync(join(storage, ".build.info"), "Branch!STRING:0|Active!DEC:1|Build Key!HEX:16|Version!STRING:0\nus|1|00000000000000000000000000000000|3.0.0.24268\n");
  writeFileSync(extractor, "#!/bin/sh\necho 'disk read error' >&2\nexit 1\n", { mode: 0o755 });
  return { storage, extractor, cache: join(root, "cache"), assets: join(root, "assets"), imports: [] };
};

test("a strict store refuses a stock asset its extractor cannot read, where a lenient one draws without it [k5 boundary casc-extract]", async () => {
  const options = unreadable();
  expect(await renderAssetStore(options).readAsset("Abilities\\Spells\\Human\\Banish\\BanishTarget.mdx")).toBeUndefined();
  await expect(renderAssetStore({ ...options, strict: true }).readAsset("Abilities\\Spells\\Human\\Banish\\BanishTarget.mdx")).rejects.toThrow("disk read error");
});
