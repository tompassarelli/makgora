import { basename } from "node:path";
import { fighterSlug } from "../../src/game/sim/heroes/registry";
import { fighters } from "../heroModelSource";
import { readWhiteImports } from "../whiteImports";

export const SHARED_SHARD = "shared";

const ROSTER = [...fighters].map(([character, { name, source }]) => ({ name, source, shard: fighterSlug(character) })).sort((a, b) => b.name.length - a.name.length);

const namedOwner = (file: string) => ROSTER.find(({ name }) => file.startsWith(name) && /^[A-Z0-9._-]/.test(file.slice(name.length)))?.shard;

export function shardFiles(family: string, root: string, files: readonly string[]): ReadonlyMap<string, readonly string[]> {
  const owners = new Map<string, Set<string>>(files.map((file) => [file, new Set()]));
  for (const file of files) {
    const shard = ROSTER.find(({ source }) => source === `${family}/${file}`)?.shard ?? namedOwner(basename(file));
    if (shard !== undefined) owners.get(file)?.add(shard);
  }
  for (const [fighter, listed] of readWhiteImports(root)) {
    const shard = ROSTER.find(({ name }) => name === fighter)?.shard;
    if (shard !== undefined) for (const file of listed) owners.get(file)?.add(shard);
  }
  const shards = new Map<string, string[]>();
  for (const [file, owner] of owners) for (const shard of owner.size === 0 ? [SHARED_SHARD] : owner) shards.set(shard, [...shards.get(shard) ?? [], file]);
  return shards;
}
