import { expect, test } from "bun:test";
import { renderAssetStore } from "../scripts/wisp/renderAssetStore";

test("fifteen asset reads build the platform services once, not a stdin listener each [k5 boundary stdin-listeners]", async () => {
  const once = process.stdin.once.bind(process.stdin);
  let ends = 0;
  process.stdin.once = ((event: string, listener: never) => {
    if (event === "end") ends++;
    return once(event, listener);
  }) as typeof process.stdin.once;
  try {
    const store = renderAssetStore({ imports: [] });
    await Promise.all(Array.from({ length: 15 }, (_, index) => store.readAsset(`Units\\Missing${index}.mdx`).catch(() => undefined)));
    expect(ends).toBeLessThanOrEqual(1);
  } finally {
    process.stdin.once = once;
  }
});
