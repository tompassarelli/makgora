import { Character } from "../sim/codes";
import { DREADLORD_GROUND, LICH_GROUND, MOUNTAIN_KING_GROUND, SHADOW_HUNTER_GROUND, WARDEN_GROUND } from "../sim/heroes/groundNormals";
import { BEASTMASTER_MOVES } from "../sim/heroes/beastmasterMoves";
import type { HeroLook } from "../presentation/model/look";
import { type PortraitKind, RENDERED_FIGHTERS, fighterRenderName } from "../sim/heroes/registry";
import { anubarakLook } from "../presentation/heroes/anubarakLook";
import { beastmasterLook } from "../presentation/heroes/beastmasterLook";
import { blademasterLook } from "../presentation/heroes/blademasterLook";
import { cairneLook } from "../presentation/heroes/cairneLook";
import { chenLook } from "../presentation/heroes/chenLook";
import { dreadlordLook } from "../presentation/heroes/dreadlordLook";
import { forsakenPaladinLook } from "../presentation/heroes/forsakenPaladinLook";
import { gromLook } from "../presentation/heroes/gromLook";
import { jainaLook } from "../presentation/heroes/jainaLook";
import { kaelthasLook } from "../presentation/heroes/kaelthasLook";
import { koboldLook } from "../presentation/heroes/koboldLook";
import { lichLook } from "../presentation/heroes/lichLook";
import { lichKingLook } from "../presentation/heroes/lichKingLook";
import { malfurionLook } from "../presentation/heroes/malfurionLook";
import { medivhLook } from "../presentation/heroes/medivhLook";
import { mountainKingLook } from "../presentation/heroes/mountainKingLook";
import { murlocLook } from "../presentation/heroes/murlocLook";
import { peonLook } from "../presentation/heroes/peonLook";
import { pitLordLook } from "../presentation/heroes/pitLordLook";
import { shadowHunterLook } from "../presentation/heroes/shadowHunterLook";
import { sylvanasLook } from "../presentation/heroes/sylvanasLook";
import { thrallLook } from "../presentation/heroes/thrallLook";
import { tinkerLook } from "../presentation/heroes/tinkerLook";
import { wardenLook } from "../presentation/heroes/wardenLook";

const LOOKS: { readonly [character: number]: HeroLook | undefined } = {
  [Character.anubarak]: anubarakLook,
  [Character.beastmaster]: beastmasterLook(BEASTMASTER_MOVES),
  [Character.blademaster]: blademasterLook,
  [Character.cairne]: cairneLook,
  [Character.chen]: chenLook,
  [Character.dreadlord]: dreadlordLook(DREADLORD_GROUND),
  [Character.forsakenPaladin]: forsakenPaladinLook,
  [Character.grom]: gromLook,
  [Character.jaina]: jainaLook,
  [Character.kaelthas]: kaelthasLook,
  [Character.kobold]: koboldLook,
  [Character.lich]: lichLook(LICH_GROUND),
  [Character.lichKing]: lichKingLook,
  [Character.malfurion]: malfurionLook,
  [Character.medivh]: medivhLook,
  [Character.mountainKing]: mountainKingLook(MOUNTAIN_KING_GROUND),
  [Character.murloc]: murlocLook,
  [Character.peon]: peonLook,
  [Character.pitLord]: pitLordLook,
  [Character.shadowHunter]: shadowHunterLook(SHADOW_HUNTER_GROUND),
  [Character.sylvanas]: sylvanasLook,
  [Character.thrall]: thrallLook,
  [Character.tinker]: tinkerLook,
  [Character.warden]: wardenLook(WARDEN_GROUND),
};

export function heroLook(character: number): HeroLook | undefined {
  return LOOKS[character];
}

export function fighterPortrait(character: number, kind: PortraitKind, slot?: number): string {
  for (const rendered of RENDERED_FIGHTERS) {
    if (rendered === character) return `war3mapImported\\Fighter${kind}${fighterRenderName(character)}${slot === undefined ? "" : `P${slot + 1}`}.blp`;
  }
  return fighterIcon(character);
}

const ORIGINAL_ICONS: Readonly<Record<number, string>> = { [Character.rifleman]: "BTNRifleman", [Character.demonHunter]: "BTNHeroDemonHunter" };

function fighterIcon(character: number): string {
  return heroLook(character)?.portrait ?? `ReplaceableTextures\\CommandButtons\\${ORIGINAL_ICONS[character] ?? "BTNRifleman"}.blp`;
}
