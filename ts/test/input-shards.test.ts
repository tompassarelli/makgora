import { expect, test } from "bun:test";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FAMILY_NAMES, type Manifest, assetsView, hashTree, removeTree, storeShards } from "../scripts/wisp/buildInputs";

const FAMILY = "impact-assets";
const hex = (seed: string) => new Bun.CryptoHasher("sha256").update(seed).digest("hex");

function writeFamily(root: string, files: Readonly<Record<string, string>>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

test("two lanes that repack different fighters store disjoint shards, and the view joins their shards back into the family byte for byte [k2 property]", async () => {
  const work = mkdtempSync(join(tmpdir(), "input-shards-"));
  try {
    const store = join(work, "store");
    const texture = `FighterWhite-${hex("texture")}.tga`, koboldTexture = `FighterWhite-${hex("kobold texture")}.tga`;
    const white = (fighter: string, version: string) => `${fighter}White-${hex(fighter + version)}.mdx`;
    const base = {
      [white("Kobold", "1")]: "kobold 1", [white("Peon", "1")]: "peon 1", [texture]: "shared white texture",
      "ImpactHit.mdl": "effect", "imports.txt": "ImpactHit.mdl\n",
      "white-flash-imports/Kobold.txt": `${texture}\n${white("Kobold", "1")}\n`,
      "white-flash-imports/Peon.txt": `${texture}\n${white("Peon", "1")}\n`,
    };
    const lane = (name: string, edit: (files: Record<string, string>) => void) => {
      const files: Record<string, string> = { ...base };
      edit(files);
      writeFamily(join(work, name), files);
      return storeShards(FAMILY, join(work, name), store);
    };
    const main = await lane("main", () => {});
    const kobold = await lane("kobold", (files) => {
      delete files[white("Kobold", "1")];
      files[white("Kobold", "2")] = "kobold 2";
      files[koboldTexture] = "kobold white texture";
      files["white-flash-imports/Kobold.txt"] = `${texture}\n${koboldTexture}\n${white("Kobold", "2")}\n`;
    });
    const peon = await lane("peon", (files) => {
      delete files[white("Peon", "1")];
      files[white("Peon", "2")] = "peon 2";
      files["white-flash-imports/Peon.txt"] = `${texture}\n${white("Peon", "2")}\n`;
    });
    expect(Object.keys(main).sort()).toEqual(["kobold", "peon", "shared"]);
    const changed = (shards: Record<string, string>) => Object.keys(shards).filter((shard) => shards[shard] !== main[shard]);
    expect(changed(kobold)).toEqual(["kobold"]);
    expect(changed(peon)).toEqual(["peon"]);

    const landed = join(work, "landed");
    cpSync(join(work, "kobold"), landed, { recursive: true });
    rmSync(join(landed, white("Peon", "1")));
    writeFamily(landed, { [white("Peon", "2")]: "peon 2", "white-flash-imports/Peon.txt": `${texture}\n${white("Peon", "2")}\n` });
    const manifest = { ...Object.fromEntries(FAMILY_NAMES.map((family) => [family, hex(family)])), [FAMILY]: { ...main, kobold: kobold.kobold!, peon: peon.peon! } } as Manifest;
    const view = assetsView(manifest, store);
    expect(await hashTree(join(view, FAMILY))).toBe(await hashTree(landed));
  } finally {
    removeTree(work);
  }
});

test("a view over shards the store lacks links the family as unstored, then merges it once they are stored [k2 property]", async () => {
  const work = mkdtempSync(join(tmpdir(), "input-shards-"));
  try {
    const source = join(work, "family");
    writeFamily(source, { [`KoboldWhite-${hex("kobold")}.mdx`]: "kobold", "ImpactHit.mdl": "effect" });
    const shards = await storeShards(FAMILY, source, join(work, "elsewhere"));
    const store = join(work, "store");
    const manifest = { ...Object.fromEntries(FAMILY_NAMES.map((family) => [family, hex(family)])), [FAMILY]: shards } as Manifest;
    expect(lstatSync(join(assetsView(manifest, store), FAMILY)).isSymbolicLink()).toBe(true);
    await storeShards(FAMILY, source, store);
    expect(await hashTree(join(assetsView(manifest, store), FAMILY))).toBe(await hashTree(source));
  } finally {
    removeTree(work);
  }
});
