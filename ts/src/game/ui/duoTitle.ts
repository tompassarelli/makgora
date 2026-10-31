import { Character } from "../sim/codes";
import { fighterName } from "../roster/kits";

export const DUO_TITLE = fighterName(Character.murloc);

export const hudTitle = (character: Character, duoTitle: boolean): string => duoTitle ? DUO_TITLE : fighterName(character).toUpperCase();
