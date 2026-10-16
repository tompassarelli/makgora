import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { listFiles } from "../scripts/wisp/buildInputs";
import { assembleFamily } from "../scripts/wisp/fighterArt";
import { modelFactsFile, readModelFacts, replaceModelFacts } from "../scripts/wisp/modelFactsTable";
import type { ModelFacts } from "wisp/scripts/wisp/models";

const hex = (seed: string) => new Bun.CryptoHasher("sha256").update(seed).digest("hex");

function writeFamily(root: string, files: Readonly<Record<string, string>>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

const readFamily = (root: string) => Object.fromEntries(listFiles(root).map((path) => [path, readFileSync(join(root, path), "utf8")]));

test("assembling a rebuilt fighter over the pinned family replaces exactly its files and keeps every other file byte for byte [k2 property]", () => {
  const work = mkdtempSync(join(tmpdir(), "fighter-art-"));
  try {
    const shared = `FighterWhite-${hex("shared")}.tga`, oldOwn = `FighterWhite-${hex("kobold 1")}.tga`, newOwn = `FighterWhite-${hex("kobold 2")}.tga`, unlisted = `FighterWhite-${hex("solid")}.tga`;
    const white = (fighter: string, version: string) => `${fighter}White-${hex(fighter + version)}.mdx`;
    const peon = { [white("Peon", "1")]: "peon 1", "white-flash-imports/Peon.txt": `${shared}\n${white("Peon", "1")}\n` };
    writeFamily(join(work, "base"), {
      ...peon, [shared]: "shared texture", [oldOwn]: "kobold texture 1", "ImpactHit.mdl": "effect",
      [white("Kobold", "1")]: "kobold 1", "white-flash-imports/Kobold.txt": `${shared}\n${oldOwn}\n${white("Kobold", "1")}\n`,
    });
    const kobold = { [white("Kobold", "2")]: "kobold 2", [newOwn]: "kobold texture 2", [shared]: "shared texture", "white-flash-imports/Kobold.txt": `${shared}\n${newOwn}\n${white("Kobold", "2")}\n` };
    writeFamily(join(work, "kobold"), { ...kobold, [unlisted]: "solid" });
    assembleFamily("impact-assets", join(work, "base"), new Map([["kobold", join(work, "kobold")]]), join(work, "staging"));
    expect(readFamily(join(work, "staging"))).toEqual({ ...peon, ...kobold, "ImpactHit.mdl": "effect" });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("replacing one fighter's model facts leaves every other model's facts file untouched [k2 property]", () => {
  const work = mkdtempSync(join(tmpdir(), "fighter-facts-"));
  try {
    const facts = (seed: number) => ({ seed } as unknown as ModelFacts);
    const model = (name: string) => `war3mapImported\\${name}-${hex(name)}.mdx`;
    const others = { [model("LichKingTimelineBody")]: facts(1), [model("LichKingWhite")]: facts(2), [model("PeonTimelineBody")]: facts(3) };
    for (const [path, entry] of Object.entries({ ...others, [model("LichTimelineBody")]: facts(4), [model("LichOriginalClip7")]: facts(5) })) {
      writeFileSync(join(work, modelFactsFile(path)), `${JSON.stringify({ model: path, facts: entry })}\n`);
    }
    const before = Object.fromEntries(readdirSync(work).map((file) => [file, readFileSync(join(work, file), "utf8")]));
    replaceModelFacts(["war3mapImported\\LichOriginalClip", "war3mapImported\\LichTimelineBody"], { [model("LichTimelineBody2")]: facts(6) }, work);
    expect(readModelFacts(work)).toEqual({ ...others, [model("LichTimelineBody2")]: facts(6) });
    for (const path of Object.keys(others)) expect(readFileSync(join(work, modelFactsFile(path)), "utf8")).toBe(before[modelFactsFile(path)]!);
    expect(() => replaceModelFacts(["war3mapImported\\LichWhite-"], { [model("PeonWhite")]: facts(7) }, work)).toThrow();
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
