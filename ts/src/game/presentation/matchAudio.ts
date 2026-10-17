


import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { IMPORTED_MENU_MUSIC, IMPORTED_STAGE_MUSIC } from "../assets/importedMusicInfo";
import { Character } from "../sim/codes";
import { type StageTile, selectableStage } from "../menu/stageCatalog";


export const MatchCue = {
  three: 0, two: 1, one: 2, go: 3, game: 4, time: 5, stockLost: 6, lastStock: 7, hover: 8, confirm: 9, cheer: 10, meterReady: 11, itemSpawn: 12,
  candleDrop: 13, candleSnuff: 14, candleReturn: 15, candleRelight: 16,
} as const;
export type MatchCue = (typeof MatchCue)[keyof typeof MatchCue];





const KOBOLD_VOICE = ["Units\\Creeps\\Kobold\\", "Kobold", "What", "YesAttack"] as const;

const koboldLines = (line: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${KOBOLD_VOICE[0]}${KOBOLD_VOICE[1]}${line}${index + 1}.flac`);

const CUE_SOUNDS: readonly (readonly string[])[] = [
  ["Sound\\Interface\\BattleNetTick.flac"],
  ["Sound\\Interface\\BattleNetTick.flac"],
  ["Sound\\Interface\\BattleNetTick.flac"],
  ["Sound\\Interface\\BattleNetTick.flac"],
  ["Sound\\Cinematics\\BellTollAlliance.flac"],
  ["Sound\\Cinematics\\BellTollAlliance.flac"],
  ["Sound\\Interface\\BattleNetDeath1.flac"],
  ["Sound\\Interface\\Warning.flac"],
  ["Sound\\Interface\\MouseOver1.flac"],
  ["Sound\\Interface\\BigButtonClick.flac"],
  ["Sound\\Cinematics\\CrowdCheer1.flac"],
  ["Sound\\Interface\\ItemReceived.flac"],
  ["Sound\\Interface\\Hint.flac"],
  koboldLines("Pissed", 4),
  ["Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorTarget1.flac"],
  koboldLines("Yes", 3),
  ["Abilities\\Spells\\Human\\InnerFire\\InnerFireBirth.flac"],
];

export function cueSound(cue: MatchCue, serial = 0): string {
  const variants = at(CUE_SOUNDS, cue);
  return at(variants, floorMod(serial, variants.length));
}

const cueSoundPaths = (): string[] => {
  const paths: string[] = [];
  for (const variants of CUE_SOUNDS) paths.push(...variants);
  return paths;
};



const MUSIC = "Sound\\Music\\mp3Music\\";


export const MENU_MUSIC = IMPORTED_MENU_MUSIC.path;





const STAGE_MUSIC: Readonly<Record<StageTile, string>> = {
  0: `${MUSIC}Human1.flac`,
  2: IMPORTED_STAGE_MUSIC[2].path,
  3: IMPORTED_STAGE_MUSIC[3].path,
  4: IMPORTED_STAGE_MUSIC[4].path,
  6: IMPORTED_STAGE_MUSIC[6].path,
  7: IMPORTED_STAGE_MUSIC[7].path,
  10: IMPORTED_STAGE_MUSIC[10].path,
  11: IMPORTED_STAGE_MUSIC[11].path,
  12: IMPORTED_STAGE_MUSIC[12].path,
  13: IMPORTED_STAGE_MUSIC[13].path,
  14: IMPORTED_STAGE_MUSIC[14].path,
};


export const stageMusic = (stage: number): string => (selectableStage(stage) ? STAGE_MUSIC[stage] : STAGE_MUSIC[0]);

export const Race = { human: 0, orc: 1, nightElf: 2, undead: 3 } as const;
export type Race = (typeof Race)[keyof typeof Race];


const RACES: Readonly<Record<Character, Race>> = {
  23: Race.undead,
  1: Race.human,
  2: Race.nightElf,
  3: Race.orc,
  4: Race.human,
  5: Race.nightElf,
  6: Race.undead,
  7: Race.human,
  8: Race.undead,
  9: Race.orc,
  10: Race.undead,
  11: Race.orc,
  12: Race.undead,
  13: Race.orc,
  14: Race.human,
  15: Race.undead,
  16: Race.orc,
  17: Race.orc,
  18: Race.orc,
  19: Race.orc,
  20: Race.human,
  21: Race.nightElf,
  26: Race.human,
  22: Race.orc,
  24: Race.nightElf,
  25: Race.human,
};

export const characterRace = (character: Character): Race => RACES[character];


const VICTORY_MUSIC: readonly string[] = [
  `${MUSIC}HumanVictory.flac`, `${MUSIC}OrcVictory.flac`, `${MUSIC}NightElfVictory.flac`, `${MUSIC}UndeadVictory.flac`,
];


export const victoryMusic = (winner: Character | undefined): string | undefined =>
  winner === undefined ? undefined : at(VICTORY_MUSIC, characterRace(winner));






const VOICES: Readonly<Record<Exclude<Character, typeof Character.medivh>, readonly [string, string, string?, string?]>> = {
  23: ["Units\\Undead\\HeroCryptLord\\", "NerubianCryptLord"],
  1: ["Units\\Human\\Rifleman\\", "Rifleman"],
  2: ["Units\\NightElf\\HeroDemonHunter\\", "HeroDemonHunter"],
  3: ["Units\\Orc\\HeroBladeMaster\\", "HeroBladeMaster"],
  4: ["Units\\Human\\HeroMountainKing\\", "HeroMountainKing"],
  5: ["Units\\NightElf\\HeroWarden\\", "HeroWarden"],
  6: ["Units\\Undead\\HeroLich\\", "HeroLich"],
  7: ["Units\\Undead\\HeroDeathKnight\\", "DeathKnight"],
  8: ["Units\\Undead\\HeroDreadLord\\", "HeroDreadLord"],
  9: ["Units\\Orc\\HeroShadowHunter\\", "ShadowHunter"],
  10: ["Units\\Demon\\HeroPitLord\\", "HPitLord"],
  11: ["Units\\Creeps\\BeastMaster\\", "OgreBeastMaster"],
  12: ["Units\\Undead\\EvilArthas\\", "EvilArthas", "What"],
  13: ["Units\\Orc\\Thrall\\", "Thrall"],
  14: ["Units\\Human\\Jaina\\","Jaina","What"],
  15: ["Units\\Undead\\EvilSylvanas\\","EvilSylvanas"],
  16: ["Units\\Orc\\Cairne\\","Cairne"],
  17: ["Units\\Creeps\\PandarenBrewmaster\\","PandarenBrewmaster"],
  18: ["Units\\Orc\\Peon\\","Peon"],
  19: ["Units\\Creeps\\HeroTinker\\","HeroTinker"],
  20: ["Units\\Human\\Kael\\","Kael"],
  21: ["Units\\Creeps\\Murloc\\", "Murloc", "Ready", "YesAttack"],
  26: KOBOLD_VOICE,
  22: ["Units\\Orc\\Hellscream\\", "Grom"],
  24: ["Units\\NightElf\\Furion\\", "Furion", "What"],
};

function voice(character: Character, line: string): string {
  if (character === Character.medivh) return `Sound\\Dialogue\\TutorialCampaign\\Tutorial01\\T01Medivh${line === "Ready" ? "02" : "59"}.flac`;
  const [directory, prefix, ready, warcry] = VOICES[character];
  const spoken = line === "Ready" ? ready ?? line : line === "Warcry" ? warcry ?? line : line;
  return `${directory}${prefix}${spoken}1.flac`;
}


export const readyVoice = (character: Character): string => voice(character, "Ready");


export const warcryVoice = (character: Character): string => voice(character, "Warcry");

export const JOB_DONE_VOICE = "Sound\\Buildings\\Orc\\PeonJobDone.flac";


const VICTORY_ANIMATIONS: Readonly<Record<Character, string>> = {
  [Character.rifleman]: "rifleman victory",
  [Character.demonHunter]: "spell",
  [Character.blademaster]: "stand victory",
  [Character.mountainKing]: "stand - 4",
  [Character.warden]: "warden victory",
  [Character.lich]: "lich victory",
  [Character.forsakenPaladin]: "forsakenpaladin victory",
  [Character.dreadlord]: "dreadlord victory",
  [Character.shadowHunter]: "shadowhunter victory",
  [Character.pitLord]: "spell",
  [Character.beastmaster]: "beastmaster victory",
  [Character.lichKing]: "lichking victory",
  [Character.thrall]: "spell",
  [Character.jaina]: "stand victory",
  [Character.sylvanas]: "spell",
  [Character.cairne]: "cairnebloodhoof victory",
  [Character.chen]: "chenstormstout victory",
  [Character.peon]: "peon victory",
  [Character.tinker]: "goblintinker victory",
  [Character.kaelthas]: "kaelthassunstrider victory",
  [Character.murloc]: "murloc victory",
  [Character.grom]: "stand victory",
  [Character.anubarak]: "anubarak victory",
  [Character.malfurion]: "spell",
  [Character.medivh]: "medivh victory",
  [Character.kobold]: "kobold victory",
};

export const victoryAnimation = (character: Character): string => VICTORY_ANIMATIONS[character];


export function interfaceSoundPaths(characters: readonly Character[]): string[] {
  const paths = cueSoundPaths();
  for (const character of characters) paths.push(readyVoice(character), warcryVoice(character));
  return paths.filter((path, index) => paths.indexOf(path) === index);
}

export function presentationSoundPaths(characters: readonly Character[], stages: readonly StageTile[]): string[] {
  const paths = [...cueSoundPaths(), MENU_MUSIC, ...VICTORY_MUSIC];
  for (const stage of stages) paths.push(stageMusic(stage));
  for (const character of characters) paths.push(readyVoice(character), warcryVoice(character));
  if (characters.includes(Character.peon)) paths.push(JOB_DONE_VOICE);
  return paths.filter((path, index) => paths.indexOf(path) === index);
}
