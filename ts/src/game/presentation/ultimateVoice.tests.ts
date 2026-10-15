import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { type AuthoredSpecial } from "../sim/heroSpecials";
import { SPECIAL_SLOTS } from "./projectileArt";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import { AVATAR_CAST, isVoicedModel, ultimateVoiceCues } from "./ultimateVoice";

const FIGHTERS: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];
const HELD_FRAMES = 120;

test("every fighter's ultimate and special plays its voice line at most once per cast, and Mountain King's Avatar exactly once [k2 property]", () => {
  for (const character of FIGHTERS) {
    const ultimate = FIGHTER_ULTIMATES[character];
    if (ultimate === undefined) continue;
    const voiced = (ultimate.projectiles ?? []).some((spec) => isVoicedModel(spec.model));
    assertEquals(ultimateVoiceCues(character, HELD_FRAMES), voiced ? 1 : 0, `fighter ${character} ultimate voice cues`);
  }
  assertEquals(AVATAR_CAST === undefined, false);
  assertEquals(ultimateVoiceCues(Character.mountainKing, HELD_FRAMES), 1);
  const voicedBirths = (special: Readonly<AuthoredSpecial> | undefined): number => (special?.projectiles ?? []).filter((spec) => isVoicedModel(spec.model)).length;
  for (const hero of HERO_ROSTER) {
    for (const slot of SPECIAL_SLOTS) {
      const kit = hero.specials?.[slot];
      if (kit === undefined) continue;
      for (const special of [kit.ground, kit.air, kit.ground.ex, kit.air?.ex, kit.recall, ...(kit.ground.followUps ?? []).map((branch) => branch.special)]) {
        assertEquals(voicedBirths(special) <= 1, true, `fighter ${hero.character} ${slot} voiced births`);
      }
    }
  }
});
