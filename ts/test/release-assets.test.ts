import { expect, test } from "bun:test";
import { mapAssets } from "../scripts/releaseAssets";

test("names every map or model file attached to a GitHub release and nothing else [k1 scenario]", () => {
  expect(mapAssets([
    { tag_name: "v0.3", assets: [{ name: "Makgora.0.3.w3x" }, { name: "notes.md" }] },
    { tag_name: "v0.4", assets: [{ name: "Whitemane.MDX" }, { name: "padbridge.zip" }] },
    { tag_name: "v0.5", assets: [] },
  ])).toEqual(["v0.3: Makgora.0.3.w3x", "v0.4: Whitemane.MDX"]);
});
