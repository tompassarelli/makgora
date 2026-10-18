import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRelease, playVersion } from "./wisp/currentPlaytest";

test("after the v0.1.0 tag the next builds are 0.1.1 then 0.1.2 and a revision keeps its reserved number [k1 scenario]", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-play-version-"));
  try {
    const builds = join(root, "play-current");
    const library = join(root, "Maps/00-Smashcraft");
    mkdirSync(builds, { recursive: true });
    mkdirSync(library, { recursive: true });
    writeFileSync(join(library, "Smashcraft 0.0.401 aaaaaaa.w3x"), "old");
    const tagged = parseRelease("v0.1.0");
    const after = parseRelease("v0.1.0-3-g0123abc");
    expect(tagged).toEqual({ version: [0, 1, 0], atTag: true });
    expect(after).toEqual({ version: [0, 1, 0], atTag: false });
    expect(parseRelease("v0.1.0-rc1")).toBeUndefined();

    const first = "b".repeat(40);
    const second = "c".repeat(40);
    expect(playVersion(builds, library, "d".repeat(40), undefined)).toBe("0.0.402");
    expect(playVersion(builds, library, first, after)).toBe("0.1.1");
    writeFileSync(join(builds, `${first}.version`), "0.1.1\n");
    writeFileSync(join(library, "Smashcraft 0.1.1 bbbbbbb.w3x"), "first");
    expect(playVersion(builds, library, second, after)).toBe("0.1.2");
    writeFileSync(join(builds, `${second}.version`), "0.1.2\n");
    writeFileSync(join(library, "Smashcraft 0.1.2 ccccccc.w3x"), "second");
    expect(playVersion(builds, library, first, after)).toBe("0.1.1");
    expect(playVersion(builds, library, second, after)).toBe("0.1.2");
    expect(playVersion(builds, library, "e".repeat(40), after)).toBe("0.1.3");
    expect(playVersion(builds, library, "f".repeat(40), tagged)).toBe("0.1.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
