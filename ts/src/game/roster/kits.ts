

import { floorMod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import type { HeroDefinition } from "../sim/heroes/hero";
import { BEASTMASTER_HERO } from "../fighters/beastmaster/kit";
import { CAIRNE_HERO } from "../fighters/cairne/kit";
import { BLADEMASTER_HERO } from "../fighters/blademaster/kit";
import { DREADLORD_HERO } from "../fighters/dreadlord/kit";
import { LICH_HERO } from "../fighters/lich/kit";
import { LICH_KING_HERO } from "../fighters/lich-king/kit";
import { JAINA_HERO } from "../fighters/jaina/kit";
import { MOUNTAIN_KING_HERO } from "../fighters/mountain-king/kit";
import { PIT_LORD_HERO } from "../fighters/pit-lord/kit";
import { SHADOW_HUNTER_HERO } from "../fighters/shadow-hunter/kit";
import { FORSAKEN_PALADIN_HERO } from "../fighters/forsaken-paladin/kit";
import { WARDEN_HERO } from "../fighters/warden/kit";
import { SYLVANAS_HERO } from "../fighters/sylvanas/kit";
import { THRALL_HERO } from "../fighters/thrall/kit";
import { CHEN_HERO } from "../fighters/chen/kit";
import { PEON_HERO } from "../fighters/peon/kit";
import { TINKER_HERO } from "../fighters/tinker/kit";
import { KAELTHAS_HERO } from "../fighters/kaelthas/kit";
import { KOBOLD_HERO } from "../fighters/kobold/kit";
import { MEDIVH_HERO } from "../fighters/medivh/kit";
import { MURLOC_HERO } from "../fighters/murloc/kit";
import { MALFURION_HERO } from "../fighters/malfurion/kit";
import { GROM_HERO } from "../fighters/grom/kit";
import { HIDDEN_FIGHTERS } from "../sim/heroes/releaseRoster";
import { ANUBARAK_HERO } from "../fighters/anubarak/kit";

export const HERO_ROSTER: readonly HeroDefinition[] = [
  BLADEMASTER_HERO, MOUNTAIN_KING_HERO, WARDEN_HERO, LICH_HERO, FORSAKEN_PALADIN_HERO, DREADLORD_HERO, SHADOW_HUNTER_HERO, PIT_LORD_HERO, BEASTMASTER_HERO, LICH_KING_HERO, THRALL_HERO, JAINA_HERO, SYLVANAS_HERO,
  CAIRNE_HERO, CHEN_HERO, PEON_HERO, TINKER_HERO, KAELTHAS_HERO, MURLOC_HERO, GROM_HERO, KOBOLD_HERO, MALFURION_HERO, MEDIVH_HERO, ANUBARAK_HERO,
];

const BY_CHARACTER: { readonly [character: number]: HeroDefinition | undefined } = {
  [Character.anubarak]: ANUBARAK_HERO,
  [Character.chen]: CHEN_HERO,
  [Character.blademaster]: BLADEMASTER_HERO,
  [Character.mountainKing]: MOUNTAIN_KING_HERO,
  [Character.warden]: WARDEN_HERO,
  [Character.lich]: LICH_HERO,
  [Character.forsakenPaladin]: FORSAKEN_PALADIN_HERO,
  [Character.dreadlord]: DREADLORD_HERO,
  [Character.shadowHunter]: SHADOW_HUNTER_HERO,
  [Character.pitLord]: PIT_LORD_HERO,
  [Character.beastmaster]: BEASTMASTER_HERO,
  [Character.lichKing]: LICH_KING_HERO,
  [Character.thrall]: THRALL_HERO,
  [Character.jaina]: JAINA_HERO,
  [Character.sylvanas]: SYLVANAS_HERO,
  [Character.cairne]: CAIRNE_HERO,
  [Character.peon]: PEON_HERO,
  [Character.tinker]: TINKER_HERO,
  [Character.kaelthas]: KAELTHAS_HERO,
  [Character.medivh]: MEDIVH_HERO,
  [Character.murloc]: MURLOC_HERO,
  [Character.kobold]: KOBOLD_HERO,
  [Character.grom]: GROM_HERO,
  [Character.malfurion]: MALFURION_HERO,
};

export type CheckHero = Omit<HeroDefinition, "character" | "complete">;

interface CheckHeroEntry {
  readonly hero: HeroDefinition;
  readonly look: Character;
}

const FIRST_CHECK_CHARACTER = 64;
const CHECK_HEROES: CheckHeroEntry[] = [];

export function registerCheckHero(hero: CheckHero, look: Character): Character {
  const character = (FIRST_CHECK_CHARACTER + CHECK_HEROES.length) as Character;
  CHECK_HEROES.push({ hero: { ...hero, character, complete: false }, look });
  return character;
}

function checkHero(character: number): CheckHeroEntry | undefined {
  return character < FIRST_CHECK_CHARACTER ? undefined : CHECK_HEROES[character - FIRST_CHECK_CHARACTER];
}

export function lookCharacter(character: number): number {
  return checkHero(character)?.look ?? character;
}

export function heroDefinition(character: number): HeroDefinition | undefined {
  return BY_CHARACTER[character] ?? checkHero(character)?.hero;
}


function selectableCharactersOf(roster: readonly HeroDefinition[]): readonly Character[] {
  const choices: Character[] = [ Character.rifleman, Character.demonHunter];
  for (const hero of roster) if (hero.complete) choices.push(hero.character);
  return choices;
}


export const SELECTABLE_CHARACTERS: readonly Character[] = selectableCharactersOf(HERO_ROSTER);

export function isSelectableCharacter(choice: number): choice is Character {
  for (const character of SELECTABLE_CHARACTERS) if (character === choice) return true;
  return false;
}

const ORIGINAL_NAMES: Readonly<Record<number, string>> = { [Character.rifleman]: "Rifleman", [Character.demonHunter]: "Illidan" };


export function fighterName(character: number): string {
  const hero = heroDefinition(character);
  return hero?.displayName ?? hero?.name ?? ORIGINAL_NAMES[character] ?? "Rifleman";
}

export function fighterKey(character: number): string {
  return heroDefinition(character)?.name ?? ORIGINAL_NAMES[character] ?? "Rifleman";
}


export function nextCharacterIn(choices: readonly Character[], current: number | undefined, direction: number): Character {
  const count = choices.length;
  let index = -1;
  for (let i = 0; i < count; i++) if (choices[i] === current) index = i;
  if (index < 0) return choices[direction < 0 ? count - 1 : 0] ?? Character.rifleman;
  return choices[floorMod(index + direction, count)] ?? Character.rifleman;
}


export function nextSelectableCharacter(current: number | undefined, direction: number): Character {
  return nextCharacterIn(PLAYABLE_CHARACTERS, current, direction);
}






export const RENDERED_FIGHTERS: readonly Character[] = SELECTABLE_CHARACTERS;


export const fighterRenderName = (character: number): string => fighterKey(character).split(" ").join("");






export type PortraitKind = "Tile" | "Card" | "Bust" | "Stock";
export const PORTRAIT_KINDS: readonly PortraitKind[] = ["Tile", "Card", "Bust", "Stock"];


const ORIGINAL_SLUGS: Readonly<Record<number, string>> = { [Character.rifleman]: "rifleman", [Character.demonHunter]: "illidan" };

/** The fighter's name in commands and soak records: "rifleman", "illidan", "mountain-king". */
export function fighterSlug(character: number): string {
  const hero = heroDefinition(character);
  return hero === undefined ? ORIGINAL_SLUGS[character] ?? "rifleman" : hero.name.toLowerCase().split(" ").join("-");
}

/** The selectable fighters by slug, for tools that name fighters on the command line. */
export function selectableCharacterBySlug(slug: string): Character | undefined {
  for (const character of SELECTABLE_CHARACTERS) if (fighterSlug(character) === slug) return character;
  return undefined;
}

/** `selectable` without the fighters whose slugs `hidden` names; never empty. */
export function playableCharactersOf(selectable: readonly Character[], hidden: readonly string[]): readonly Character[] {
  const choices: Character[] = [];
  for (const character of selectable) {
    let shown = true;
    for (const slug of hidden) if (fighterSlug(character) === slug) shown = false;
    if (shown) choices.push(character);
  }
  return choices.length === 0 ? selectable.slice(0, 1) : choices;
}

/** The fighters players and computers choose from on the selection screen: the release roster (releaseRoster.ts). */
export const PLAYABLE_CHARACTERS: readonly Character[] = playableCharactersOf(SELECTABLE_CHARACTERS, HIDDEN_FIGHTERS);
