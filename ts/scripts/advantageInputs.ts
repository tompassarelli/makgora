import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const entries = ["scripts/advantageStateWorker.ts", "scripts/wisp/commands/combos.ts"];
const extra = ["scripts/wisp.ts", "scripts/hostProcess.ts", "scripts/wisp/profiles.ts", "scripts/advantageInputs.ts", "package.json", "bun.lock", "bunfig.toml", "tsconfig.json"];

const built = await Bun.build({ entrypoints: entries.map((entry) => join(root, entry)), root, target: "bun", metafile: true, throw: true });
const files = [...new Set([...Object.keys(built.metafile?.inputs ?? {}).map((input) => relative(root, resolve(input))), ...extra])].sort();
if (files.length < 100) throw new Error(`only ${files.length} advantage-state inputs resolved`);
const hash = createHash("sha256").update(`bun ${Bun.version} ${process.platform} ${process.arch}\n`);
for (const file of files) hash.update(`${file}\0${createHash("sha256").update(readFileSync(join(root, file))).digest("hex")}\n`);
console.log(hash.digest("hex"));
