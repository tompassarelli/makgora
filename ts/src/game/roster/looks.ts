import { Character } from "../sim/codes";
import { DREADLORD_GROUND } from "../fighters/dreadlord/moves";
import { LICH_GROUND } from "../fighters/lich/moves";
import { MOUNTAIN_KING_GROUND } from "../fighters/mountain-king/moves";
import { SHADOW_HUNTER_GROUND } from "../fighters/shadow-hunter/moves";
import { WARDEN_GROUND } from "../fighters/warden/moves";
import { BEASTMASTER_MOVES } from "../fighters/beastmaster/moves";
import type { HeroLook } from "../presentation/model/look";
import { type PortraitKind, RENDERED_FIGHTERS, fighterRenderName, lookCharacter } from "./kits";
import { anubarakLook } from "../fighters/anubarak/look";
import { beastmasterLook } from "../fighters/beastmaster/look";
import { blademasterLook } from "../fighters/blademaster/look";
import { cairneLook } from "../fighters/cairne/look";
import { chenLook } from "../fighters/chen/look";
import { dreadlordLook } from "../fighters/dreadlord/look";
import { forsakenPaladinLook } from "../fighters/forsaken-paladin/look";
import { gromLook } from "../fighters/grom/look";
import { jainaLook } from "../fighters/jaina/look";
import { kaelthasLook } from "../fighters/kaelthas/look";
import { koboldLook } from "../fighters/kobold/look";
import { lichLook } from "../fighters/lich/look";
import { lichKingLook } from "../fighters/lich-king/look";
import { malfurionLook } from "../fighters/malfurion/look";
import { medivhLook } from "../fighters/medivh/look";
import { archimondeLook } from "../fighters/archimonde/look";
import { mountainKingLook } from "../fighters/mountain-king/look";
import { murlocLook } from "../fighters/murloc/look";
import { peonLook } from "../fighters/peon/look";
import { pitLordLook } from "../fighters/pit-lord/look";
import { shadowHunterLook } from "../fighters/shadow-hunter/look";
import { sylvanasLook } from "../fighters/sylvanas/look";
import { thrallLook } from "../fighters/thrall/look";
import { tinkerLook } from "../fighters/tinker/look";
import { wardenLook } from "../fighters/warden/look";

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
  [Character.archimonde]: archimondeLook,
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
  return LOOKS[lookCharacter(character)];
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
