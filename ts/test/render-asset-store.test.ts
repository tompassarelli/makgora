import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderAssetStore } from "../scripts/wisp/renderAssetStore";

test("a stock asset the extractor reports missing is asked for once per stock build, not on every render, while another failure is asked again [k5 boundary stock-extractor]", async () => {
  const root = mkdtempSync(join(tmpdir(), "render-asset-store-"));
  try {
    const storage = join(root, "storage"), calls = join(root, "calls"), extractor = join(root, "casc-extract");
    mkdirSync(storage);
    writeFileSync(join(storage, ".build.info"), "Branch!STRING:0|Active!DEC:1|Version!STRING:0\nus|1|2.0.3\n");
    writeFileSync(extractor, `#!/bin/sh\necho "$2" >> "${calls}"\ncase "$2" in *locked*) echo "open storage failed: 32" >&2 ;; *) echo "open asset failed: 2" >&2 ;; esac\nexit 1\n`);
    chmodSync(extractor, 0o755);
    const store = () => renderAssetStore({ storage, extractor, cache: join(root, "cache"), assets: join(root, "assets"), imports: [] });
    const asked = () => readFileSync(calls, "utf8").trim().split("\n");
    for (let render = 0; render < 3; render++) {
      const assets = store();
      expect(await assets.readAsset("Doodads\\Nowhere\\Missing.mdx")).toBeUndefined();
      expect(await assets.readAsset("Doodads\\Nowhere\\locked.mdx")).toBeUndefined();
    }
    expect(asked()).toEqual(["war3.w3mod:doodads/nowhere/missing.mdx", ...Array.from({ length: 3 }, () => "war3.w3mod:doodads/nowhere/locked.mdx")]);
    writeFileSync(join(storage, ".build.info"), "Branch!STRING:0|Active!DEC:1|Version!STRING:0\nus|1|2.0.4\n");
    expect(await store().readAsset("Doodads\\Nowhere\\Missing.mdx")).toBeUndefined();
    expect(asked().filter((path) => path.endsWith("missing.mdx"))).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
