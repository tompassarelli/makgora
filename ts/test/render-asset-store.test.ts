import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const LOCALE_ONLY_EXTRACTOR = `#!/bin/sh
case "$2" in
  *_locales/enus.w3mod:*) printf OggS > "$3" ;;
  *) echo "open asset failed: 2" >&2; exit 1 ;;
esac
`;

test("a fighter voice stored only in the enUS locale mod resolves on its first read, after the root mod misses [k5 boundary locale-sounds]", async () => {
  const root = mkdtempSync(join(tmpdir(), "locale-sound."));
  try {
    const storage = join(root, "install"), extractor = join(root, "extract");
    await Bun.write(join(storage, ".build.info"), "Branch!STRING:0|Active!DEC:1\nus|1\n");
    writeFileSync(extractor, LOCALE_ONLY_EXTRACTOR);
    chmodSync(extractor, 0o755);
    const store = renderAssetStore({ imports: [], storage, extractor, cache: join(root, "cache") });
    const bytes = await store.readAsset("Units\\NightElf\\HeroDemonHunter\\HeroDemonHunterReady1.ogg");
    expect(bytes === undefined ? undefined : new TextDecoder().decode(bytes)).toBe("OggS");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
