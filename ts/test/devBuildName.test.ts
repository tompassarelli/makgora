import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OLD_FOLDER, installLatest, library, pendingTidy } from "../scripts/wisp/mapLibrary";



test("installing a dev build leaves the latest release and the newest dev build at the top of the Maps folder and moves older releases to old/ [k5 boundary maps-folder]", () => {
  const documents = mkdtempSync(join(tmpdir(), "makgora-maps-folder-"));
  const staging = mkdtempSync(join(tmpdir(), "makgora-maps-staging-"));
  const root = library(documents);
  try {
    mkdirSync(root, { recursive: true });
    for (const file of ["Mak'gora 0.1.3.w3x", "Mak'gora 0.1.4.w3x", "Mak'gora 0.1.5.w3x", "Mak'gora 0.1.6-dev.829.w3x", "Mak'gora 0.1.5-dev c9e5fbd.w3x"]) writeFileSync(join(root, file), file);
    const next = join(staging, "Mak'gora 0.2-dev.830.w3x");
    writeFileSync(next, "next");
    installLatest(documents, next);
    expect(readdirSync(root).filter((entry) => entry.endsWith(".w3x")).sort()).toEqual(["Mak'gora 0.1.5.w3x", "Mak'gora 0.2-dev.830.w3x"]);
    expect(readdirSync(join(root, OLD_FOLDER)).sort()).toEqual(["Mak'gora 0.1.3.w3x", "Mak'gora 0.1.4.w3x"]);
    expect(existsSync(join(root, "Mak'gora 0.1.6-dev.829.w3x"))).toBe(false);
    const after = join(staging, "Mak'gora 0.2.w3x");
    writeFileSync(after, "release");
    installLatest(documents, after);
    expect(readdirSync(join(root, OLD_FOLDER)).sort()).toEqual(["Mak'gora 0.1.3.w3x", "Mak'gora 0.1.4.w3x", "Mak'gora 0.1.5.w3x"]);
    writeFileSync(join(root, "Mak'gora 0.1.6-dev.900.w3x"), "old patch line");
    writeFileSync(join(root, "Mak'gora 0.3-dev.2.w3x"), "next minor");
    expect(pendingTidy(documents)).toEqual({ remove: ["Mak'gora 0.2-dev.830.w3x", "Mak'gora 0.1.6-dev.900.w3x"], archive: [] });
  } finally {
    rmSync(documents, { recursive: true, force: true });
    rmSync(staging, { recursive: true, force: true });
  }
});
