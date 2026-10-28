import { assertEquals, test } from "wisp/src/runtime/testing";
import type { Character } from "./codes";
import { IDENTITY_TRAITS, type TraitMove, moveTraits } from "./identityTraits";
import type { AuthoredSpecial } from "./specials/schema";
import { authoredTuning } from "./tuning";

function statusMoves(special: AuthoredSpecial | undefined, found: string[], label: string): void {
  if (special === undefined) return;
  if (special.strikeStatus !== undefined || special.commandGrab?.status !== undefined) found.push(label);
  statusMoves(special.ex, found, label);
  for (const variant of special.variants ?? []) statusMoves(variant, found, label);
  for (const branch of special.followUps ?? []) statusMoves(branch.special, found, label);
}

test("Every special whose strike or command grab applies a status carries the status trait [k2 property]", () => {
  const missing: string[] = [];
  for (const key of Object.keys(IDENTITY_TRAITS)) {
    const character = Number(key) as Character;
    const tuning = authoredTuning(character);
    const moves: [TraitMove, AuthoredSpecial | undefined][] = [["ultimate", tuning.ultimate]];
    const kits = tuning.specials;
    if (kits !== undefined) for (const move of ["neutral", "side", "up", "down"] as const) {
      const kit = kits[move];
      moves.push([move, kit.ground], [move, kit.air], [move, kit.recall]);
    }
    for (const [move, special] of moves) {
      const found: string[] = [];
      statusMoves(special, found, `${character} ${move}`);
      if (found.length > 0 && moveTraits(character, move).status !== true) missing.push(...found);
    }
  }
  assertEquals(missing.join(", "), "");
});
