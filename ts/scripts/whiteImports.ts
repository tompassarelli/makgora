import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseModelMDX } from "./mdxCodec";

export const WHITE_LISTS = "white-flash-imports";
const IMPORTED = "war3mapImported\\";
const WHITE_TEXTURE = /^FighterWhite-[0-9a-f]{64}\.tga$/;

async function drawnTextures(path: string): Promise<string[]> {
  const model = parseModelMDX(await Bun.file(path).arrayBuffer());
  return model.Textures.flatMap(({ Image }) => Image?.startsWith(IMPORTED) ? [Image.slice(IMPORTED.length)] : []);
}

export async function writeWhiteImports(pool: string, fighter: string, filename: string): Promise<void> {
  const files: string[] = [];
  const add = (...paths: string[]) => { for (const path of paths) if (!files.includes(path)) files.push(path); };
  add(...await drawnTextures(join(pool, filename)), filename);
  mkdirSync(join(pool, WHITE_LISTS), { recursive: true });
  await Bun.write(join(pool, WHITE_LISTS, `${fighter}.txt`), `${files.join("\n")}\n`);
}

export function readWhiteImports(pool: string): ReadonlyMap<string, readonly string[]> {
  const directory = join(pool, WHITE_LISTS);
  if (!existsSync(directory)) return new Map();
  return new Map(readdirSync(directory).filter((file) => file.endsWith(".txt")).sort().map((file) =>
    [file.slice(0, -".txt".length), readFileSync(join(directory, file), "utf8").split("\n").filter((line) => line.length > 0)]));
}

export function keepWhiteImports(pool: string, fighters: ReadonlySet<string>): void {
  for (const fighter of readWhiteImports(pool).keys()) if (!fighters.has(fighter)) rmSync(join(pool, WHITE_LISTS, `${fighter}.txt`));
}

export function pruneFighterWhites(pool: string, fighter: string): void {
  const listed = new Set(readWhiteImports(pool).get(fighter) ?? []);
  const white = new RegExp(`^${fighter}White-[0-9a-f]{64}\\.mdx$`);
  for (const file of readdirSync(pool)) if (white.test(file) && !listed.has(file)) rmSync(join(pool, file));
}

export function pruneWhiteTextures(pool: string): void {
  const listed = new Set([...readWhiteImports(pool).values()].flat());
  for (const file of readdirSync(pool)) if (WHITE_TEXTURE.test(file) && !listed.has(file)) rmSync(join(pool, file));
}
