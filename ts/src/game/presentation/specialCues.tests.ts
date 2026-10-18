import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../sim/heroMoves";
import { MOUNTAIN_KING_SPECIALS } from "../sim/heroes/mountainKingSpecials";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { type AuthoredSpecial } from "../sim/specials/schema";
import { SPECIAL_SLOTS } from "./projectileArt";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { RIFLEMAN_SECOND_SHOT_FIRST, RIFLEMAN_SECOND_SHOT_FORM, RIFLEMAN_SECOND_SHOT_LAST } from "../sim/specials";
import { HERO_BRANCH_CUES, HERO_CUES, ORIGINAL_CUES, fighterBranchCues, fighterMoveCues, heroCueWindows, specialCueState } from "./specialCues";
import { FROST_TRAP_MODEL } from "../../generated/assets/frostAssetInfo";


const FIGHTERS: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];
const SIGNATURE_CUE_OWNERS: readonly { readonly model: string; readonly owner: Character; readonly sharedWith: readonly Character[] }[] = [
  { model: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx", owner: Character.jaina, sharedWith: [] },
  { model: FROST_TRAP_MODEL, owner: Character.rifleman, sharedWith: [] },
];


function forms(special: AuthoredSpecial | undefined, into: AuthoredSpecial[]): void {
  if (special === undefined) return;
  into.push(special);
  for (const followUp of special.followUps ?? []) forms(followUp.special, into);
}

test("no two moves or branches show the same startup and active pair, nor the same active spell, and signature cues stay with their owners [k3 measure #144]", () => {
  const pairs = new Map<string, string>();
  const actives = new Map<string, string>();
  for (const character of FIGHTERS) {
    [...fighterMoveCues(character), ...fighterBranchCues(character)].forEach((move, slot) => {
      const id = `${character}:${slot} ${move.spell}`;
      for (const phase of [move.startup, move.active]) {
        const signature = SIGNATURE_CUE_OWNERS.find(({ model }) => model === phase.model);
        if (signature !== undefined) assertTrue(character === signature.owner || signature.sharedWith.includes(character));
      }
      const pair = `${move.startup.model}|${move.active.model}`;
      assertEquals(pairs.get(pair), undefined, `${id} pair`);
      pairs.set(pair, id);
      assertEquals(actives.get(move.active.model), undefined, `${id} active ${move.active.model}`);
      actives.set(move.active.model, id);
    });
  }
});

test("every hero special form's cue windows lie in its action: startup from frame 1, then active [k2 property]", () => {
  let checked = 0;
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    assertTrue(HERO_CUES[hero.character] !== undefined);
    for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      const all: AuthoredSpecial[] = [];
      const kitForms = [kit.ground, kit.air, kit.recall, kit.marked?.special];
      for (let form = 0; form < 5; form++) forms(kitForms[form], all);
      for (const move of all) {
        const { startup, active } = heroCueWindows(move);
        assertEquals(startup.first, 1);
        assertTrue(active.first >= 1 && active.last >= active.first && active.last <= move.endFrame);
        assertTrue(startup.last === 1 || startup.last === active.first - 1);
        checked++;
      }
    }
  }
  assertTrue(checked >= 28);
});


test("the Lich's Death and Decay casts without his frost cue and Frost Armor winds up without Dark Ritual's rune [k3 measure #563]", () => {
  const lich = HERO_CUES[Character.lich];
  if (lich === undefined) throw new Error("the Lich has cues");
  const frost = lich.neutral.startup.model;
  for (const cue of [lich.side.startup, lich.side.active]) assertEquals(cue.model === frost, false, `Death and Decay shows ${cue.model}`);
  assertEquals(lich.down.startup.model.includes("DarkRitual"), false, `Frost Armor winds up with ${lich.down.startup.model}`);
});

test("Thunder Clap's ring and Small Clap art shrink to 0.85x with the hitbox [k2 property]", () => {
  const reach = MOUNTAIN_KING_SPECIALS.down.ground.regions?.[0]?.hit.maxX ?? 0.0;
  assertNear(HERO_CUES[Character.mountainKing]?.down.active.scale ?? 0.0, f32(f32(0.85) * f32(f32(HERO_REFERENCE_HEIGHT * f32(0.85)) / f32(187.05800313601685))), f32(0.001));
  assertNear(HERO_CUES[Character.mountainKing]?.down.active.scale ?? 0.0, f32(reach / f32(187.05800313601685)), f32(0.0001));
  const small = HERO_BRANCH_CUES[Character.mountainKing]?.down?.followUps?.[0];
  assertTrue(small !== undefined && small !== "slot" && small !== "none");
  if (small !== undefined && small !== "slot" && small !== "none") assertNear(small.active.scale, f32(f32(0.85) * f32(0.3)), f32(0.001));
});

test("Cairne's special cues use no stock Bloodlust model, whose sound events play the Bloodlust cast [k2 property]", () => {
  const loud = Object.values(HERO_CUES[Character.cairne] ?? {}).flatMap((move) => [move?.startup?.model, move?.active?.model])
    .filter((model): model is string => model !== undefined && model.includes("\\Bloodlust\\"));
  assertEquals(loud.join("\n"), "");
});

test("Forsaken Paladin shows holy art only on Consecration, and no special re-spawns its art every frame [k2 property]", () => {
  const holy = (model: string) => ["\\Heal\\", "\\HolyBolt\\", "\\Resurrect\\", "\\Consecration\\"].some((part) => model.includes(part));
  const cues = HERO_CUES[Character.forsakenPaladin]!;
  const loud = (["neutral", "side", "up"] as const).flatMap((slot) => [cues[slot].startup, cues[slot].active]).filter((cue) => holy(cue.model) || cue.birth?.eachFrame === true);
  assertEquals(loud.map((cue) => cue.model).join("\n"), "");
});
