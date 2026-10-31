// Variants and pitch come from hit and attack serials, never a random source, so every client and replay sounds alike.
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, LAST_ATTACK_STYLE, SpecialAction } from "../sim/codes";
import { HitElement } from "../sim/hitRegions";
import { isSmashAttack, jabChainFrom } from "../sim/moves";
import { heroDefinition } from "../roster/kits";
import { originalFighterMoves } from "../sim/originalMoves";
import { VERIFIED_STOCK_SOUND_LABELS } from "../../generated/assets/stockSoundInfo";
import { elementLook } from "./elementLooks";
import { murlocMoveVoices, murlocReviveVoices, warcryVoice } from "./matchAudio";
import { SWING_SOUND, SoundTier, TIER_HIT_VOLUME, TIER_SWING_PITCH, TIER_SWING_VOLUME, moveTier } from "./moveTiers";

export const SPECIAL_MOVE = 100;
export const SPECIAL_SLOT_NAMES = ["Neutral special", "Side special", "Up special", "Down special"] as const;
export const ULTIMATE_MOVE = SPECIAL_MOVE + SPECIAL_SLOT_NAMES.length;

export const Weapon = { blade: 0, axe: 1, hammer: 2, blunt: 3, claw: 4, rock: 5 } as const;
export type Weapon = (typeof Weapon)[keyof typeof Weapon];

const FLESH: readonly (readonly string[])[] = [
  ["MetalLightSliceFlesh", "MetalMediumSliceFlesh", "MetalHeavySliceFlesh"],
  ["MetalLightChopFlesh", "MetalMediumChopFlesh", "MetalHeavyChopFlesh"],
  ["WoodMediumBashFlesh", "MetalMediumBashFlesh", "MetalHeavyBashFlesh"],
  ["WoodLightBashFlesh", "WoodMediumBashFlesh", "WoodHeavyBashFlesh"],
  ["MetalLightSliceFlesh", "MetalLightChopFlesh", "MetalMediumChopFlesh"],
  ["WoodMediumBashFlesh", "RockHeavyBashFlesh", "RockHeavyBashFlesh"],
];
const METAL: readonly (readonly string[])[] = [
  ["MetalLightSliceMetal", "MetalMediumSliceMetal", "MetalHeavySliceMetal"],
  ["MetalLightChopMetal", "MetalMediumChopMetal", "MetalHeavyChopMetal"],
  ["WoodMediumBashMetal", "MetalMediumBashMetal", "MetalHeavyBashMetal"],
  ["WoodLightBashMetal", "WoodMediumBashMetal", "WoodHeavyBashMetal"],
  ["MetalLightSliceMetal", "MetalLightChopMetal", "MetalMediumChopMetal"],
  ["WoodMediumBashMetal", "RockHeavyBashMetal", "RockHeavyBashMetal"],
];

interface SpecialSound {
  readonly perform: string | undefined;
  readonly performVolume?: number | undefined;
  readonly onset?: string | undefined;
  readonly hit: string;
  readonly impact?: string | undefined;
  readonly fuse?: string | undefined;
  readonly voice?: readonly string[] | undefined;
}

interface FighterSound {
  readonly weapon: Weapon;
  readonly swing?: readonly string[] | undefined;
  readonly whoosh?: false | undefined;
  readonly effort?: readonly string[] | undefined;
  readonly strong: string;
  readonly specials: readonly [SpecialSound, SpecialSound, SpecialSound, SpecialSound];
  readonly ultimate?: SpecialSound | undefined;
  readonly normals?: { readonly [style: number]: { readonly perform?: string; readonly hit?: string } | undefined } | undefined;
  readonly hoistVoice?: string | undefined;
}

const s = (perform: string | undefined, hit: string, performVolume?: number): SpecialSound => ({ perform, hit, performVolume });

export const FIGHTER_SOUNDS: { readonly [character: number]: FighterSound | undefined } = {
  [Character.rifleman]: {
    weapon: Weapon.blunt, strong: "FlakCannonHit",
    specials: [s("RiflemanAttack1", "GyrocopterAttack"), s("BattleRoar", "MetalMediumChopFlesh"), s("RiflemanAttack1", "GyrocopterAttack"), s("MetalMediumBashMetal", "MetalHeavyChopFlesh")],
  },
  [Character.demonHunter]: {
    weapon: Weapon.blade, strong: "DemonHunterMissileHit",
    specials: [s("DemonHunterMissileLaunch", "DemonHunterMissileHit"), s("DemonHunterMissileLaunch", "MetalHeavySliceFlesh"), s("DemonHunterMissileHit", "MetalMediumSliceFlesh"), s("FireballLaunch", "Fireball")],
  },
  [Character.blademaster]: {
    weapon: Weapon.blade, swing: ["HeroBladeMasterAttack1", "HeroBladeMasterAttack2"], strong: "CriticalStrike",
    specials: [s("HeroBladeMasterAttack2", "MetalMediumSliceFlesh"), s("MirrorImage", "MetalMediumSliceFlesh"), s("HeroBladeMasterAttack1", "MetalMediumSliceFlesh"), s("WindWalk", "CriticalStrike")],
  },
  [Character.mountainKing]: {
    weapon: Weapon.hammer, swing: ["HeroMountainKingAttack1"], strong: "StormBolt",
    specials: [s("StormBoltLaunch", "StormBolt"), s("HeroMountainKingAttack1", "MetalHeavyBashFlesh"), s("HeroMountainKingAttack1", "RockHeavyBashFlesh"), s("Taunt", "ThunderClap")],
  },
  [Character.warden]: {
    weapon: Weapon.blade, effort: ["WardenAttack"], strong: "FanOfKnivesHit",
    specials: [s("ShadowStrikeMissileBirth", "ShadowStrikeBirth"), { ...s("ShadowStrikeBirth", "MetalHeavySliceFlesh", 90), onset: "MetalHeavySliceMetal", impact: "BlinkCaster" }, s("BlinkTarget", "MetalLightSliceFlesh"), s("FanOfKnives", "FanOfKnivesHit")],
  },
  [Character.lich]: {
    weapon: Weapon.blunt, effort: ["HeroLichAttack1"], strong: "LichMissile",
    specials: [s("ZigguratFrostMissileLaunch", "FrostNova"), s("DeathAndDecayTarget", "DeathAndDecayTarget"), s("DarkRitual", "LichMissile"), s("FrostArmor", "FrostBoltHit")],
  },
  [Character.uther]: {
    weapon: Weapon.hammer, swing: ["HeroPaladinAttack1", "HeroPaladinAttack2"], strong: "MetalHeavyBashFlesh",
    specials: [s("HolyBolt", "HolyBolt"), s("HeroPaladinAttack2", "MetalHeavyBashFlesh"), s("HeroPaladinAttack1", "MetalMediumBashFlesh"), s("DivineShield", "MetalHeavyBashMetal")],
  },
  [Character.dreadlord]: {
    weapon: Weapon.claw, strong: "CarrionSwarmDamage",
    specials: [s("CarrionSwarmLaunch", "CarrionSwarmDamage"), s("CarrionSwarmLaunch", "MetalMediumChopFlesh"), s("CarrionSwarmLaunch", "MetalLightChopFlesh"), s("Sleep", "CreepSleep")],
  },
  [Character.shadowHunter]: {
    weapon: Weapon.axe, strong: "HunterMissileHit",
    specials: [s("ShadowHunterMissileLaunch", "ShadowHunterMissileHit"), s("WardBirth", "PoisonArrowHit"), s("VoodooBirth", "MetalMediumChopFlesh"), s("WitchDoctorMissileLaunch", "Polymorph")],
  },
  [Character.pitLord]: {
    weapon: Weapon.axe, swing: ["PitLordAttack1", "PitLordAttack2", "PitLordAttack3"], strong: "PitLordAttackSlam1",
    specials: [s(undefined, "CrushingWaveDamage"), s("BalrogAttack1", "RockHeavyBashFlesh"), s("PitLordAttackSlam1", "RockHeavyBashFlesh"), s("RainOfFireWave", "Fireball")],
    normals: { [AttackStyle.dashAttack]: { perform: "PitLordAttackSlam1", hit: "RockHeavyBashFlesh" } },
  },
  [Character.beastmaster]: {
    weapon: Weapon.axe, effort: ["BeastmasterAttack"], strong: "AxeMissileHit",
    specials: [s("AxeMissileLaunch", "AxeMissileHit"), s("BattleRoar", "StampedeHit"), s("Units\\Creeps\\WarEagle\\HawkReady1.flac", "DruidOfTheTalonMissileHit", 0), s("Units\\Creeps\\QuillBeast\\QuillBoarReady1.flac", "BristleBackMissileHit")],
  },
  [Character.lichKing]: {
    weapon: Weapon.blade, swing: ["HeroDeathKnightAttack1"], strong: "FrostWyrmAttack1",
    specials: [s("DarkSummoningMissileLaunch", "DarkSummoningTarget"), s("DeathCoil", "Ensnare"), s("FrostArmor", "FrostBoltHit"), s("DeathPactTarget", "FrostWyrmAttack1")],
  },
  [Character.thrall]: {
    weapon: Weapon.hammer, strong: "LightningBolt",
    specials: [s("HeroFarSeerAttack1", "LightningBolt"), s("FeralSpiritTarget", "MetalMediumChopFlesh"), s("RevealMap", "MetalMediumBashFlesh"), s("RockHeavyBashFlesh", "MetalHeavyBashFlesh")],
  },
  [Character.jaina]: {
    weapon: Weapon.blunt, strong: "FrostBoltHit",
    specials: [s("FrostBoltLaunch", "FrostBoltHit"), s("Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget1.flac", "FrostBoltHit"), s("BlinkCaster", "BlinkTarget"), s("WaterElementalBirth", "WaterElementalMissile")],
  },
  [Character.sylvanas]: {
    weapon: Weapon.blunt, strong: "BlackArrowHit",
    specials: [s("ArrowLaunch", "BlackArrowHit"), s("Silence", "Curse"), s("BansheeMissileLaunch", "BansheeMissileHit"), s("BansheeMissileLaunch", "BansheeMissileHit")],
    ultimate: s("PossessionMissileLaunch", "PossessionMissileHit"),
  },
  [Character.cairne]: {
    weapon: Weapon.rock, swing: ["HeroTaurenChieftainAttack1", "HeroTaurenChieftainAttack2"], strong: "Pulverize",
    specials: [s("ShockWave", "RockHeavyBashFlesh"), s("HeroTaurenChieftainAttack2", "RockHeavyBashFlesh"), s("AncestralSpirit", "WoodMediumBashFlesh"), { ...s("HeroTaurenChieftainAttack2", "Pulverize"), impact: "Warstomp" }],
  },
  [Character.chen]: {
    weapon: Weapon.blunt, effort: ["BrewmasterAttack1", "BrewmasterAttack2"], strong: "WoodHeavyBashMetal",
    specials: [s("BreathOfFire", "Fireball"), s("StrongDrinkMissile", "StrongDrink"), s("CycloneBirth", "WoodMediumBashFlesh"), s("Taunt", "Fireball")],
  },
  [Character.akama]: {
    weapon: Weapon.blade, strong: "CriticalStrike",
    specials: [s("FanOfKnives", "FanOfKnivesHit"), s(undefined, "MetalMediumSliceFlesh"), s(undefined, "MetalMediumSliceFlesh"), s(undefined, "MetalMediumSliceFlesh")],
  },
  [Character.peon]: {
    weapon: Weapon.axe, strong: "AxeMediumChopWood",
    specials: [{ ...s(undefined, "WoodHeavyBashFlesh"), impact: "Abilities\\Spells\\Items\\ResourceItems\\ReceiveGold.flac" }, s("AxeMediumChopWood", "WoodHeavyBashFlesh"), s("CatapultAttack1", "WoodMediumBashFlesh"), s("CreepSleep", "WoodHeavyBashFlesh")],
    hoistVoice: "Units\\Orc\\Peon\\PeonYes3.flac",
  },
  [Character.tinker]: {
    weapon: Weapon.hammer, strong: "ClusterRocketsImpact",
    specials: [s("ClusterRocketsLaunch", "ClusterRocketsImpact"), s("HeroTinkerMorph", "SearingArrowHit"), s("ClusterRocketsLaunch", "MetalMediumBashFlesh"), s("PocketFactoryBirth", "GoblinSapperExplode")],
  },
  [Character.kaelthas]: {
    weapon: Weapon.blunt, strong: "Fireball",
    specials: [s("FireballLaunch", "FlameStrike"), s("FlameStrikeTarget", "FlameStrike"), s("PhoenixMissileLaunch", "Fireball"), s("BanishCaster", "BanishCaster")],
    normals: { [AttackStyle.grab]: { perform: "SiphonManaCaster" } },
  },
  [Character.murloc]: {
    weapon: Weapon.claw, effort: murlocMoveVoices(), strong: "CrushingWaveDamage",
    specials: [s("EnsnareMissile", "Ensnare"), { ...s("BigWaterStep", "CrushingWaveDamage"), voice: murlocMoveVoices() }, { ...s("CrushingWave", "WaterElementalMissile"), voice: murlocMoveVoices() }, { ...s("BigWaterStep", "CrushingWaveDamage"), voice: murlocReviveVoices() }],
  },
  [Character.grom]: {
    weapon: Weapon.axe, strong: "CriticalStrike",
    specials: [s(warcryVoice(Character.grom), "MetalMediumChopFlesh"), s("DeepFootstep2", "MetalHeavyChopFlesh"), s(undefined, "MetalMediumChopFlesh"), s(undefined, "MetalHeavyChopFlesh")],
  },
  [Character.anubarak]: {
    weapon: Weapon.claw, effort: ["CryptLordAttack1", "CryptLordAttack2"], strong: "ImpaleHit",
    specials: [s("Impale", "ImpaleHit"), s("Burrow", "ImpaleLand"), s("ImpaleLand", "RockHeavyBashFlesh"), s("ScarabBirth", "CryptFiendMissileHit")],
  },
  [Character.malfurion]: {
    weapon: Weapon.blunt, strong: "KeeperOfTheGroveMissileHit",
    specials: [s("KeeperOfTheGroveMissileLaunch", "EntanglingRoots"), s("KeeperOfTheGroveMissileLaunch", "WoodHeavyBashFlesh"), s("DruidOfTheTalonMorph", "DruidOfTheTalonMissileHit"), s("ForceOfNatureBirth", "WoodHeavyBashFlesh")],
  },
  [Character.medivh]: {
    weapon: Weapon.blunt, strong: "ManaFlareMissile",
    specials: [s("SorceressMissileLaunch", "SorceressMissileHit"), s("BlinkCaster", "BlinkTarget"), s("DruidOfTheTalonMorph", "DruidOfTheTalonMissileHit"), s("SorceressMissileLaunch", "ManaFlareMissile")],
  },
  [Character.ladyVashj]: {
    weapon: Weapon.blunt, strong: "CrushingWaveDamage",
    specials: [s("FrostArrowLaunch", "FrostArrowHit"), s("CrushingWave", "CrushingWaveDamage"), s("CrushingWave", "CrushingWaveDamage"), s("ManaShieldCastSound", "FrostArmor")],
    ultimate: s("Curse", "StoneFormMorphAlternate"),
  },
  [Character.archimonde]: {
    weapon: Weapon.claw, strong: "MetalHeavyBashFlesh",
    specials: [s("ManaFlareMissile", "LightningBolt"), s("FlameStrike", "RainOfFireWave"), s("FireballLaunch", "Fireball"), s("ThunderClap", "RockHeavyBashFlesh")],
  },
  [Character.butcher]: {
    weapon: Weapon.axe, strong: "RelentlessCleave",
    specials: [s("AxeMissileLaunch", "MeatWagonMissileHit"), s("MeatWagonAttack1", "RockHeavyBashFlesh"), s("AxeMissileLaunch", "AxeMissileHit"), s("Cannibalize", "Cannibalize")],
    ultimate: s("RelentlessCleave", "Cannibalize"),
  },
  [Character.tyrande]: {
    weapon: Weapon.blunt, strong: "WoodHeavyBashFlesh",
    specials: [s("ArrowLaunch", "SearingArrowHit"), s("DispelMagic", "Defend"), s("BlinkCaster", "WoodLightBashFlesh"), s("ManaShieldCastSound", "Defend")],
    ultimate: s("RevealMap", "FrostNova"),
  },
};

export interface SoundLayer {
  readonly sounds: readonly string[];
  readonly volume: number;
  readonly pitch: number;
}

export interface MoveSound {
  readonly perform: readonly SoundLayer[];
  readonly hit: readonly SoundLayer[];
  readonly strong: readonly SoundLayer[];
  readonly shield: readonly SoundLayer[];
  readonly impact: readonly SoundLayer[];
  readonly fuse: readonly SoundLayer[];
  readonly voice: SoundLayer | undefined;
}

const VOICE_TAKES = 3;
const VOICE_VOLUME = 100;
const PERFORM_VOLUME = 110;
const MAX_VOLUME = 127;
const MODEL_SWING_VOLUME: readonly number[] = [0, 80, 100];
const SWEETENER_VOLUME = 100;
const SHIELD_VOLUME = 100;
const PITCH_STEPS: readonly number[] = [0.96875, 0.984375, 1.0, 1.015625, 1.03125];

const layer = (sounds: readonly string[], volume: number, pitch = 1.0): SoundLayer => ({ sounds, volume, pitch });

export const specialMove = (slot: number): number => SPECIAL_MOVE + slot;
export const isSpecialMove = (move: number): boolean => move >= SPECIAL_MOVE;
const isNormalMove = (move: number): move is AttackStyle => move < SPECIAL_MOVE;

export function specialSlot(action: SpecialAction): number {
  switch (action) {
    case SpecialAction.heroNeutral: case SpecialAction.riflemanBlaster: case SpecialAction.demonHunterEyeBeam: return 0;
    case SpecialAction.heroSide: case SpecialAction.riflemanBear: case SpecialAction.demonHunterFelRush: return 1;
    case SpecialAction.heroUp: case SpecialAction.riflemanRecovery: case SpecialAction.demonHunterWingAscent: return 2;
    case SpecialAction.heroDown: case SpecialAction.riflemanTrap: case SpecialAction.demonHunterImmolate: return 3;
    default: return -1;
  }
}

function resolveSpecial(fighter: FighterSound, move: number): MoveSound | undefined {
  const special = move === ULTIMATE_MOVE ? fighter.ultimate : fighter.specials[move - SPECIAL_MOVE];
  if (special === undefined) return undefined;
  const { weapon } = fighter;
  return {
    perform: [
      ...(special.onset === undefined ? [] : [layer([special.onset], MAX_VOLUME)]),
      ...(special.perform === undefined ? [] : [layer([special.perform], special.performVolume ?? PERFORM_VOLUME)]),
    ],
    hit: [layer([special.hit], at(TIER_HIT_VOLUME, SoundTier.medium))],
    strong: [layer([special.hit], at(TIER_HIT_VOLUME, SoundTier.large)), layer([fighter.strong], SWEETENER_VOLUME)],
    shield: [layer([at(at(METAL, weapon), SoundTier.medium)], SHIELD_VOLUME)],
    impact: special.impact === undefined ? [] : [layer([special.impact], at(TIER_HIT_VOLUME, SoundTier.large))],
    fuse: special.fuse === undefined ? [] : [layer([special.fuse], PERFORM_VOLUME)],
    voice: special.voice === undefined ? undefined : layer(special.voice, VOICE_VOLUME),
  };
}

function resolve(character: Character, move: number): MoveSound | undefined {
  const fighter = FIGHTER_SOUNDS[character];
  if (fighter === undefined) return undefined;
  if (!isNormalMove(move)) return resolveSpecial(fighter, move);
  const { weapon } = fighter;
  const style = move;
  const tier = moveTier(character, style);
  const own = fighter.normals?.[style];
  const perform = fighter.whoosh === false ? [] : [layer([SWING_SOUND], at(TIER_SWING_VOLUME, tier), at(TIER_SWING_PITCH, tier))];
  if (own?.perform !== undefined) perform.push(layer([own.perform], PERFORM_VOLUME));
  else if (fighter.swing !== undefined && tier !== SoundTier.small) perform.push(layer(fighter.swing, at(MODEL_SWING_VOLUME, tier)));
  const body = own?.hit ?? at(at(FLESH, weapon), tier);
  return {
    perform,
    hit: [layer([body], at(TIER_HIT_VOLUME, tier))],
    strong: [layer([own?.hit ?? at(at(FLESH, weapon), SoundTier.large)], at(TIER_HIT_VOLUME, SoundTier.large)), layer([fighter.strong], SWEETENER_VOLUME)],
    shield: [layer([at(at(METAL, weapon), tier)], SHIELD_VOLUME)],
    impact: [],
    fuse: [],
    voice: fighter.effort !== undefined && isSmashAttack(style) ? layer(fighter.effort, VOICE_VOLUME) : undefined,
  };
}

export function soundedMoves(character: Character): number[] {
  const hero = heroDefinition(character);
  const moves = hero?.moves ?? originalFighterMoves(character);
  const dash = moves?.dashAttack ?? (character === Character.demonHunter ? AttackStyle.demonHunterDashAttack : undefined);
  const out: number[] = [];
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    if (style === AttackStyle.grab || style === AttackStyle.shot) continue;
    if (hero !== undefined && hero.moves.normals[style] === undefined) continue;
    if ((style === AttackStyle.dashAttack || style === AttackStyle.demonHunterDashAttack) && style !== dash) continue;
    if (style === AttackStyle.jab2 && jabChainFrom(character, AttackStyle.jab, moves) === undefined) continue;
    if (style === AttackStyle.jab3 && jabChainFrom(character, AttackStyle.jab2, moves) === undefined) continue;
    out.push(style);
  }
  for (let slot = 0; slot < SPECIAL_SLOT_NAMES.length; slot++) out.push(specialMove(slot));
  return out;
}

const resolved: { [key: number]: MoveSound | false | undefined } = {};

export function moveSound(character: Character, move: number): MoveSound | undefined {
  const key = character * 1000 + move;
  let row = resolved[key];
  if (row === undefined) {
    row = resolve(character, move) ?? false;
    resolved[key] = row;
  }
  return row === false ? undefined : row;
}

export function soundFiles(sound: string): readonly string[] {
  return sound.includes("\\") ? [sound] : VERIFIED_STOCK_SOUND_LABELS[sound] ?? [];
}

export type MoveSoundSink = (file: string, volume: number, pitch: number) => void;

function playLayer(sound: SoundLayer, serial: number, salt: number, sink: MoveSoundSink): void {
  if (sound.volume <= 0) return;
  const label = at(sound.sounds, imod(serial, sound.sounds.length));
  const files = soundFiles(label);
  if (files.length === 0) return;
  const file = at(files, imod(serial + salt, files.length));
  sink(file, sound.volume, sound.pitch * at(PITCH_STEPS, imod(serial * 3 + salt, PITCH_STEPS.length)));
}

function playLayers(layers: readonly SoundLayer[], serial: number, sink: MoveSoundSink): void {
  for (let index = 0; index < layers.length; index++) playLayer(at(layers, index), serial, index, sink);
}

export function playPerform(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row === undefined) return;
  playLayers(row.perform, serial, sink);
  if (row.voice !== undefined && imod(serial, VOICE_TAKES) !== 0) playLayer(row.voice, floorDiv(serial, VOICE_TAKES), 0, sink);
}

export function playHit(character: Character, move: number, strong: boolean, element: HitElement, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row === undefined) return;
  playLayers(strong ? row.strong : row.hit, serial, sink);
  const sweetener = elementLook(element).sound;
  if (sweetener !== undefined && !isSpecialMove(move)) playLayer(layer([sweetener], SWEETENER_VOLUME), serial, 0, sink);
}

export function hasPerformSound(character: Character, move: number): boolean {
  return (moveSound(character, move)?.perform.length ?? 0) > 0;
}

export function hasImpactSound(character: Character, move: number): boolean {
  return (moveSound(character, move)?.impact.length ?? 0) > 0;
}

export function playImpact(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row !== undefined) playLayers(row.impact, serial, sink);
}

export function hasFuseSound(character: Character, move: number): boolean {
  return (moveSound(character, move)?.fuse.length ?? 0) > 0;
}

export function playFuse(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row !== undefined) playLayers(row.fuse, serial, sink);
}

export function playShieldHit(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row !== undefined) playLayers(row.shield, serial, sink);
}

export function hoistVoice(character: Character): string | undefined {
  return FIGHTER_SOUNDS[character]?.hoistVoice;
}

export function moveSoundLabels(characters: readonly Character[]): string[] {
  const labels: string[] = [];
  const add = (sound: string) => { if (!labels.includes(sound)) labels.push(sound); };
  for (const character of characters) {
    const voice = hoistVoice(character);
    if (voice !== undefined) add(voice);
    for (let style = 0; style <= AttackStyle.jab3; style++) {
      const row = moveSound(character, style);
      if (row === undefined) continue;
      for (const each of [...row.perform, ...row.hit, ...row.strong, ...row.shield, ...row.impact, ...row.fuse, ...(row.voice === undefined ? [] : [row.voice])]) each.sounds.forEach((sound) => add(sound));
    }
    for (let move = SPECIAL_MOVE; move <= ULTIMATE_MOVE; move++) {
      const row = moveSound(character, move);
      if (row === undefined) continue;
      for (const each of [...row.perform, ...row.hit, ...row.strong, ...row.shield, ...row.impact, ...row.fuse, ...(row.voice === undefined ? [] : [row.voice])]) each.sounds.forEach((sound) => add(sound));
    }
  }
  return labels;
}

export function ultimateCastSound(character: Character): string | undefined {
  return FIGHTER_SOUNDS[character]?.ultimate?.perform;
}

export function specialSoundMove(character: Character, action: SpecialAction): number {
  if (action === SpecialAction.heroUltimate) return FIGHTER_SOUNDS[character]?.ultimate === undefined ? -1 : ULTIMATE_MOVE;
  const slot = specialSlot(action);
  return slot < 0 ? -1 : specialMove(slot);
}
