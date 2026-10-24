import { PLAYABLE_CHARACTERS } from "../../src/game/sim/heroes/registry";

export const smokePairs = (roster: readonly number[] = PLAYABLE_CHARACTERS): (readonly [number, number])[] =>
  Array.from({ length: Math.ceil(roster.length / 2) }, (_, index) => [2 * index, (2 * index + 1) % roster.length] as const);

export const smokeShardLabel = (shard: number): string => String(shard + 1).padStart(2, "0");

export const movesShardId = (shard: number): string => `gate-moves-${smokeShardLabel(shard)}`;

export const specialsShardId = (shard: number): string => `gate-specials-spot-${smokeShardLabel(shard)}`;

export const smokeShards = (): number[] => smokePairs().map((_, shard) => shard);

export const smokeShardIds = (): string[] => smokeShards().flatMap(shard => [movesShardId(shard), specialsShardId(shard)]);

export function parseShardChat(text: string, gate: "moves" | "specials"): number | undefined {
  const match = new RegExp(`^gate:${gate}:(\\d+)$`).exec(text);
  const shard = match === null ? undefined : Number(match[1]) - 1;
  return shard !== undefined && shard >= 0 && shard < smokePairs().length ? shard : undefined;
}
