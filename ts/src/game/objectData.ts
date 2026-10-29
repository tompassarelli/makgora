
import { CHUNKS_PER_FILE, FILE_IO_ABILITY } from "wisp/src/runtime/gameFiles";
import { RIFLEMAN_MODEL_FILE } from "./presentation/fighterAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "./presentation/demonHunterAssetInfo";
import { characterModelScale } from "./presentation/modelScale";
import { Character } from "./sim/codes";
import { HERO_ROSTER, heroDefinition } from "./roster/kits";
import { heroLook } from "./roster/looks";

export interface FighterObject {
  readonly base: string;
  readonly id: number;
  readonly name: string;
  readonly model: string;
  readonly artVersion: number;
  readonly scale: number;
  readonly blendTime: number;
  readonly selectionScale: number;
  readonly moveSpeed: number;
  readonly attackCooldown: number;
}

const fighterFields = {
  artVersion: 0,

  blendTime: 0.0,
  selectionScale: 0.0,

  moveSpeed: 270.0,
  attackCooldown: 1.5,
} as const;






function heroObject(character: Character): FighterObject {
  const hero = heroDefinition(character);
  const look = heroLook(character);
  if (hero === undefined || look === undefined) throw new Error(`hero ${character} is not registered`);
  return { ...fighterFields, base: "earc", id: look.objectId, name: hero.name, model: look.model, scale: characterModelScale(character) };
}

export const FIGHTER_OBJECTS: Readonly<Record<Character, FighterObject>> = {
  [Character.anubarak]: heroObject(Character.anubarak),
  [Character.rifleman]: { ...fighterFields, base: "hrif", id: 0x6d667266, name: "Rifleman", model: RIFLEMAN_MODEL_FILE, scale: characterModelScale(Character.rifleman) },
  [Character.demonHunter]: { ...fighterFields, base: "earc", id: 0x6d666468, name: "Illidan", model: DEMON_HUNTER_MODEL_FILE, scale: characterModelScale(Character.demonHunter) },
  [Character.chen]: heroObject(Character.chen),
  [Character.blademaster]: heroObject(Character.blademaster),
  [Character.mountainKing]: heroObject(Character.mountainKing),
  [Character.warden]: heroObject(Character.warden),
  [Character.lich]: heroObject(Character.lich),
  [Character.dreadlord]: heroObject(Character.dreadlord),
  [Character.shadowHunter]: heroObject(Character.shadowHunter),
  [Character.pitLord]: heroObject(Character.pitLord),
  [Character.beastmaster]: heroObject(Character.beastmaster),
  [Character.lichKing]: heroObject(Character.lichKing),
  [Character.thrall]: heroObject(Character.thrall),
  [Character.jaina]: heroObject(Character.jaina),
  [Character.sylvanas]: heroObject(Character.sylvanas),
  [Character.cairne]: heroObject(Character.cairne),
  [Character.peon]: heroObject(Character.peon),
  [Character.tinker]: heroObject(Character.tinker),
  [Character.kaelthas]: heroObject(Character.kaelthas),
  [Character.medivh]: heroObject(Character.medivh),
  [Character.uther]: heroObject(Character.uther),
  [Character.archimonde]: heroObject(Character.archimonde),
  [Character.butcher]: heroObject(Character.butcher),
  [Character.murloc]: heroObject(Character.murloc),
  [Character.ladyVashj]: heroObject(Character.ladyVashj),
  [Character.grom]: heroObject(Character.grom),
  [Character.malfurion]: heroObject(Character.malfurion),
};

export const FIGHTER_OBJECT_ORDER: readonly Character[] = [ Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];


export const FILE_IO_OBJECT = {
  base: "ANcl",
  id: FILE_IO_ABILITY,
  levels: CHUNKS_PER_FILE,
  tooltip: " ",
} as const;
