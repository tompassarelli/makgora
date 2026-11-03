import { canonicalChecksum } from "./checksum";
import { fighterMovesCanonical, fighterSpecialsCanonical } from "./kitCanonical";
import { specialPlacementCanonical } from "./specialCanonical";
import type { FighterMoves } from "../sim/heroMoves";
import type { FighterSpecials, SpecialPlacement } from "../sim/specials/schema";
import type { Fighter } from "../sim/fighter";

const MOVES_DIGESTS = new Map<Readonly<FighterMoves>, string>();
const SPECIALS_DIGESTS = new Map<Readonly<FighterSpecials>, string>();
const PLACEMENT_DIGESTS = new Map<Readonly<SpecialPlacement>, string>();
const placedSpecCanonical = (spec: Readonly<SpecialPlacement>): string => specialPlacementCanonical(spec, "placedSpec");
declare global {
  var __makgoraKitDigests: Record<string, string | undefined> | undefined;
}


const retainedKitDigests: Record<string, string | undefined> = {};

function kitDigestField<K>(name: string, kit: K | undefined, digests: Map<K, string>, text: (kit: K) => string): string {
  if (kit === undefined) return "";
  let digest = digests.get(kit);
  if (digest === undefined) {
    const canonical = text(kit);
    digest = retainedKitDigests[canonical] ?? globalThis.__makgoraKitDigests?.[canonical];
    if (digest === undefined) digest = canonicalChecksum(canonical);
    retainedKitDigests[canonical] = digest;
    digests.set(kit, digest);
  }
  return `|${name}.digest=${digest}`;
}

export const movesDigestField = (name: string, moves: Readonly<FighterMoves> | undefined): string => kitDigestField(name, moves, MOVES_DIGESTS, fighterMovesCanonical);
export const specialsDigestField = (name: string, specials: Readonly<FighterSpecials> | undefined): string => kitDigestField(name, specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
export const placementDigestField = (name: string, spec: Readonly<SpecialPlacement> | undefined): string => kitDigestField(name, spec, PLACEMENT_DIGESTS, placedSpecCanonical);

export function observedOpponentKitCanonical(fighter: Readonly<Fighter>): string {
  return kitDigestField("moves", fighter.tuning.moves, MOVES_DIGESTS, fighterMovesCanonical)
    + kitDigestField("specials", fighter.tuning.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
}

export function publishKitDigests(): void {
  globalThis.__makgoraKitDigests = retainedKitDigests;
}
