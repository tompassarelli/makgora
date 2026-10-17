




import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { type AuthoredSpecial, FOLLOW_UP_FORM, type FrameWindow, SpecialForm } from "../sim/specials/schema";
import { idiv } from "wisp/src/sim/intMath";
import { runningHeroSpecial } from "../sim/specials/engine";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { PHOENIX_CHARGE_FRAMES, PHOENIX_FLIGHT_FRAMES } from "../sim/heroes/kaelthasSpecials";
import { KOBOLD_BURROW_FIRST, KOBOLD_BURROW_LAST } from "../sim/ultimates";
import { REST_SOUR_FRAME } from "../sim/heroes/peonSpecials";
import {
  CHAOS_STRIKE_AIR_FORM,
  CHAOS_STRIKE_FIRST,
  CHAOS_STRIKE_FORM,
  CHAOS_STRIKE_LAST,
  DEMONHUNTER_GLIDE_SLASH_FORM,
  DEMONHUNTER_IMMOLATE_ACTIVE,
  DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_MANA_BURN_STARTUP,
  DEMONHUNTER_WING_STARTUP,
  EYE_BLAST_FIRST,
  EYE_BLAST_FORM,
  EYE_BLAST_LAST,
  FEL_RUSH_FIRST,
  FEL_RUSH_LAST,
  RIFLEMAN_BEAR_CAST_FRAMES,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES,
  RIFLEMAN_SECOND_SHOT_FIRST,
  RIFLEMAN_SECOND_SHOT_FORM,
  RIFLEMAN_SECOND_SHOT_LAST,
  VENGEFUL_RETREAT_FORM,
  VENGEFUL_RETREAT_MOVE_LAST,
} from "../sim/specials";
import { SPECIAL_SLOTS, type SpecialSlot } from "./projectileArt";
import { RIFLEMAN_MODEL_FILE } from "./fighterAssetInfo";
import { FROST_TRAP_MODEL } from "../../generated/assets/frostAssetInfo";
import { IMPACT_DUST_MODEL } from "../assets/impactAssetInfo";
import { GROM_BLOODLUST_MODEL } from "../assets/importedModelInfo";
import { MOUNTAIN_KING_SPECIALS } from "../sim/heroes/mountainKingSpecials";


export type CueAnchor = "hand" | "body" | "feet" | "ahead" | "behind" | "overhead" | "barrel" | "breath";

export const MISSING_CUE_MODEL = "Objects\\InventoryItems\\QuestionMark\\QuestionMark.mdl";

export const CUE_ANCHORS: { readonly [anchor in CueAnchor]: { readonly x: number; readonly z: number } } = {
  hand: { x: 40.0, z: 70.0 },
  body: { x: 0.0, z: 50.0 },
  feet: { x: 0.0, z: 2.0 },
  ahead: { x: 70.0, z: 45.0 },
  behind: { x: -55.0, z: 55.0 },
  overhead: { x: 0.0, z: 125.0 },
  barrel: { x: 75.0, z: 60.0 },

  breath: { x: 124.0, z: 62.0 },
};

export interface CueBirth {
  readonly eachFrame: boolean;
  readonly strike?: number | undefined;
  readonly strikes?: number | undefined;
  readonly strikeRadius?: number | undefined;
  readonly trail?: number | undefined;
  readonly taper?: boolean | undefined;
  readonly voices?: number | undefined;
  readonly lingerFrames?: number | undefined;
}

export interface Cue {
  readonly model: string;
  readonly anchor: CueAnchor;
  readonly scale: number;
  readonly anchorFrames?: readonly { readonly x: number; readonly z: number }[] | undefined;
  readonly scaleEnd?: number | undefined;
  readonly scaleFrames?: number | undefined;
  readonly birth?: CueBirth | undefined;

  readonly drawn?: boolean | undefined;






  readonly sequence?: string | undefined;
  readonly seconds?: number | undefined;
  readonly pitch?: number | undefined;
  readonly roll?: number | undefined;
  readonly sound?: string | undefined;
  readonly yaw?: number | undefined;
  readonly depth?: number | undefined;
  readonly timeScale?: number | undefined;
  readonly alpha?: number | undefined;
  readonly color?: readonly [number, number, number] | undefined;

  readonly replacesBody?: boolean | undefined;
  readonly rebirthFrames?: number | undefined;
  readonly definitive?: Cue | undefined;
}


export const timed = (cue: Cue, sequence: string, seconds: number): Cue => ({ ...cue, sequence, seconds });


export interface MoveCues {
  readonly spell: string;
  readonly startup: Cue;
  readonly active: Cue;
  /** The fighter's own body tint and alpha while either cue shows. */
  readonly body?: { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } | undefined;
}



const BIRTH_CUES = new Set([
  "StarfallTarget", "MoonWellCasterArt", "TauntCaster", "StarfallCaster", "GyroCopterImpact",
  "FeralSpiritTarget", "FlakTarget", "FireLordDeathExplode", "BlizzardTarget",
  "SteamTankImpact", "CrushingWaveDamage", "SpellBreakerAttack", "ImpaleHitTarget",
  "BreathOfFireMissile", "VolcanoDeath", "MirrorImageCaster", "MirrorImageDeathCaster",
  "MarkOfChaosTarget", "SpiritWalkerChange", "MirrorImageMissile", "ForkedLightningTarget",
  "DefendCaster", "ImpaleTargetDust", "GlaiveMissileTarget", "BlinkCaster", "FanOfKnivesCaster",
  "SpiritTouchTarget", "AnimateDeadTarget", "DarkRitualCaster", "FrostArmorDamage", "DarkRitualTarget",
  "HealTarget", "HolyBoltSpecialArt", "StampedeMissileDeath", "CarrionSwarmDamage", "SleepSpecialArt",
  "FeralSpiritDone", "PolymorphTarget", "AncestralSpiritCaster", "HowlCaster",
  "FlameStrike1", "FreezingBreathMissile", "FrostNovaTarget", "DispelMagicTarget",
  "MassTeleportTarget", "WaterElementalMissile", "NeutralBuildingExplosion", "RedDragonMissile",
  "GoldCredit", "NagaDeath", "AIfbSpecialArt", "PolyMorphDoneGround", "UCancelDeath", "ToonBoom", "BloodlustSpecial",
]);

const cue = (model: string, anchor: CueAnchor, scale: number): Cue => {
  const name = (model.split("\\").pop() ?? model).replace(".mdx", "").replace(".mdl", "");
  const sequence = BIRTH_CUES.has(name) ? "birth" : "stand";

  const seconds = name === "MarkOfChaosTarget" || name === "InvisibilityTarget" ? 0.75 : name === "FlameStrike1" ? f32(1.3)
    : name === "DarkRitualCaster" ? 1.0 : name === "DeathAndDecayTarget" ? 0.5
    : name === "DeathCoilSpecialArt" || name === "ThunderClapCaster" || name === "WarStompCaster" ? f32(0.3)
    : name === "StarfallTarget" ? f32(0.8) : f32(0.2);
  const pitch = name === "ThunderClapCaster" || name === "WarStompCaster" || name === "Consecration" || name === "FanOfKnivesCaster" ? f32(1.570796327) : 0.0;
  return { model, anchor, scale, sequence, seconds, pitch };
};
const drawn = (model: string, anchor: CueAnchor): Cue => ({ model, anchor, scale: 1.0, drawn: true });



const BLOODLUST = cue(GROM_BLOODLUST_MODEL, "hand", f32(0.8));
// The Blademaster gathers wind and fades into Wind Walk rather than borrowing the Shaman's Bloodlust (#499).
const WIND_GATHER = cue("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", "body", f32(0.4));
const WIND_WALK = cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", f32(0.8));
const STORM = cue("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", "hand", 1.0);
// Warcraft discards the first seek after selecting an animation, so this held stand ring keeps its default sequence.
const THUNDER_CLAP_CUE: Cue = { ...cue("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", "feet", f32((MOUNTAIN_KING_SPECIALS.down.ground.regions?.[0]?.hit.maxX ?? 0.0) / f32(187.05800313601685))), sequence: undefined, pitch: 0.0, timeScale: 0.0, sound: "ThunderClap" };
const SHADOW = cue("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", "hand", f32(0.7));
const FROST = cue("Abilities\\Spells\\Undead\\ReplenishMana\\SpiritTouchTarget.mdx", "hand", f32(0.8));
const ARCANE = cue("Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx", "hand", 0.5);
const VAMPIRIC = cue("Abilities\\Spells\\Undead\\UnholyFrenzy\\UnholyFrenzyTarget.mdx", "hand", f32(0.8));
const KAEL_PHOENIX_CHARGE: MoveCues = { spell: "Phoenix", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "body", 0.5), active: cue("Doodads\\Cinematic\\TownBurningFireEmitter\\TownBurningFireEmitter.mdx", "body", f32(0.6)) };
// The flight is the phoenix itself: Kael's body is replaced by it until the flight ends.
const KAEL_PHOENIX_FORM: MoveCues = { spell: "Phoenix", startup: KAEL_PHOENIX_CHARGE.active, active: { ...timed(cue("units\\human\\Phoenix\\Phoenix.mdx", "body", f32(0.55)), "stand", 0.0), replacesBody: true } };
const FROST_TRAP = cue(FROST_TRAP_MODEL, "feet", f32(0.4));
const BANSHEE_FORM: MoveCues = {
  spell: "Banshee Form",
  startup: cue("Abilities\\Spells\\Undead\\Possession\\PossessionTarget.mdx", "body", f32(0.8)),
  active: { ...timed(cue("Units\\Undead\\Banshee\\Banshee.mdx", "body", f32(0.9)), "walk", 0.0), alpha: 150 },
  body: { red: 140, green: 110, blue: 190, alpha: 110 },
};
const DREADLORD_BITE_CUES: MoveCues = { spell: "Healing bite", startup: VAMPIRIC, active: cue("Abilities\\Weapons\\Blood\\BloodImpact.mdx", "ahead", 1.0) };
const VOODOO = cue("Abilities\\Spells\\Orc\\TrollBerserk\\TrollBeserkerTarget.mdx", "hand", f32(0.7));
const FEL = cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.7));
const MURGUL = cue("Abilities\\Weapons\\MurgulMagicMissile\\MurgulMagicMissile.mdx", "hand", f32(0.6));
const BEAST = cue("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", "hand", f32(0.6));
const QUIET_BEAST = cue(GROM_BLOODLUST_MODEL, "hand", f32(0.6));
const BREW = cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx", "hand", f32(0.6));
const NATURE = cue("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", "hand", f32(0.7));

export const FROST_ARMOR_SHELL_MODEL = "Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorTarget.mdx";

const RUNE = cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualCaster.mdx", "feet", f32(0.6));

const RAIN_OF_FIRE_TARGET = "Abilities\\Spells\\Demon\\RainOfFire\\RainOfFireTarget.mdx";
const BURROW = cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.4));
const KOBOLD_BURROW_TRAIL: MoveCues = { spell: "Burrow trail", startup: BURROW, active: BURROW };


export const PEON_REST_CUES: MoveCues = {
  spell: "Rest",
  startup: cue("Abilities\\Spells\\Human\\DivineShield\\DivineShieldTarget.mdx", "body", f32(1.0)),
  active: { ...cue("Abilities\\Spells\\Undead\\Sleep\\SleepTarget.mdx", "body", f32(1.5)), rebirthFrames: 48 },
};


export const HERO_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]: MoveCues } } = {
  [Character.malfurion]: {
    neutral: { spell: "Entangling Roots", startup: NATURE, active: cue("Abilities\\Spells\\NightElf\\EntanglingRoots\\EntanglingRootsTarget.mdx", "ahead", f32(0.35)) },
    side: { spell: "Stag Charge", startup: NATURE, active: { ...cue("units\\critters\\BlackStagMale\\BlackStagMale.mdx", "feet", 1.0), sequence: "walk", seconds: 0.0, replacesBody: true } },
    up: { spell: "Dream Ascent", startup: NATURE, active: cue("Abilities\\Spells\\NightElf\\Tranquility\\Tranquility.mdx", "feet", f32(0.3)) },
    down: { spell: "Force of Nature", startup: NATURE, active: cue("Abilities\\Spells\\NightElf\\TargetArtLumber\\TargetArtLumber.mdx", "ahead", f32(0.7)) },
  },
  [Character.jaina]: {
    neutral: { spell: "Frostbolt", startup: ARCANE, active: cue("Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx", "hand", 0.5) },
    side: { spell: "Blizzard", startup: ARCANE, active: ARCANE },
    up: { spell: "Blink", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportTarget.mdx", "body", 0.5) },
    down: { spell: "Summon Water Elemental", startup: ARCANE, active: cue("Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx", "hand", f32(0.7)) },
  },
  [Character.cairne]: {
    neutral: { spell: "Shockwave", startup: { ...timed(cue("Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx", "ahead", f32(1.0)), "stand", f32(0.2)), scaleEnd: f32(1.2), scaleFrames: 23, timeScale: 0.0, yaw: 0.0, depth: 180.0, anchorFrames: [
      { x: -85.63313293457031, z: 123.28221130371094 },
      { x: -85.63313293457031, z: 123.28221130371094 },
      { x: -85.63313293457031, z: 123.28221130371094 },
      { x: -80.51679992675781, z: 140.6808319091797 },
      { x: -73.28290557861328, z: 154.22276306152344 },
      { x: -63.90773391723633, z: 164.3553924560547 },
      { x: -62.13417434692383, z: 163.8303985595703 },
      { x: -60.890865325927734, z: 161.33053588867188 },
      { x: -59.970542907714844, z: 165.5945587158203 },
      { x: -59.39122009277344, z: 170.12460327148438 },
      { x: -59.272804260253906, z: 174.50018310546875 },
      { x: -59.44647979736328, z: 176.64808654785156 },
      { x: -59.716548919677734, z: 175.77682495117188 },
      { x: -59.85578155517578, z: 172.46859741210938 },
      { x: -65.61457061767578, z: 174.51925659179688 },
      { x: -71.3459701538086, z: 176.01930236816406 },
      { x: -76.68285369873047, z: 177.09344482421875 },
      { x: -82.25807189941406, z: 177.8724822998047 },
      { x: -87.7003402709961, z: 178.27708435058594 },
      { x: -92.6697006225586, z: 178.31686401367188 },
      { x: -97.75504302978516, z: 177.99998474121094 },
      { x: -97.75504302978516, z: 178.06654357910156 },
      { x: -97.75504302978516, z: 178.1291961669922 },
    ], definitive: { model: "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", anchor: "hand", scale: 2.0, sequence: "stand", seconds: f32(0.2), scaleEnd: 2.5, scaleFrames: 23, timeScale: 0.0, depth: 180.0, yaw: 0.0, anchorFrames: [
      { x: -67.9131088256836, z: 125.99826049804688 },
      { x: -67.9131088256836, z: 126.03534698486328 },
      { x: -67.9131088256836, z: 126.07475280761719 },
      { x: -64.76042175292969, z: 141.172119140625 },
      { x: -59.49678039550781, z: 152.7886199951172 },
      { x: -52.29387283325195, z: 161.06788635253906 },
      { x: -53.38129425048828, z: 158.2254180908203 },
      { x: -54.62268829345703, z: 153.97389221191406 },
      { x: -56.12906265258789, z: 156.4182891845703 },
      { x: -57.76899719238281, z: 159.51947021484375 },
      { x: -59.267677307128906, z: 161.93260192871094 },
      { x: -60.895755767822266, z: 162.69654846191406 },
      { x: -62.41767501831055, z: 160.8631134033203 },
      { x: -63.61881637573242, z: 157.06552124023438 },
      { x: -69.67378997802734, z: 158.88551330566406 },
      { x: -75.69843292236328, z: 160.1758270263672 },
      { x: -81.31090545654297, z: 161.07192993164062 },
      { x: -87.18086242675781, z: 161.68270874023438 },
      { x: -92.92227935791016, z: 161.94064331054688 },
      { x: -98.17941284179688, z: 161.8619842529297 },
      { x: -103.5793228149414, z: 161.43994140625 },
      { x: -103.5793228149414, z: 161.5065155029297 },
      { x: -103.5793228149414, z: 161.5691680908203 },
    ] } }, active: drawn("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx", "ahead") },
    side: { spell: "Bloodhoof Gore", startup: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.35)), active: cue("Objects\\Spawnmodels\\Demon\\DemonLargeDeathExplode\\DemonLargeDeathExplode.mdx", "ahead", f32(0.6)) },
    up: { spell: "Spirit Lift", startup: QUIET_BEAST, active: cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAura.mdx", "feet", f32(0.7)) },
    down: { spell: "War Stomp", startup: QUIET_BEAST, active: cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAuraTarget.mdx", "body", f32(0.5)) },
  },
  [Character.peon]: {
    neutral: { spell: "Lumber Toss", startup: drawn("Objects\\InventoryItems\\BundleofLumber\\BundleofLumber.mdx", "hand"), active: drawn("Objects\\InventoryItems\\BundleofLumber\\BundleofLumber.mdx", "hand") },
    side: { spell: "Burrow", startup: timed(cue(IMPACT_DUST_MODEL, "ahead", f32(0.25)), "stand", 0.0), active: drawn("buildings\\orc\\TrollBurrow\\TrollBurrow.mdl", "ahead") },
    up: { spell: "Worksite Launch", startup: cue("Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx", "feet", f32(0.2)), active: cue("Objects\\Spawnmodels\\Other\\ToonBoom\\ToonBoom.mdx", "feet", f32(0.5)) },
    down: PEON_REST_CUES,
  },
  [Character.thrall]: {
    neutral: { spell: "Chain Lightning", startup: STORM, active: cue("Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx", "hand", 0.5) },
    side: { spell: "Feral Spirit", startup: BEAST, active: cue("units\\orc\\SpiritWolf\\SpiritWolf.mdx", "ahead", 0.5) },
    up: { spell: "Far Sight", startup: STORM, active: cue("Abilities\\Spells\\Orc\\Purge\\PurgeBuffTarget.mdx", "body", 0.5) },
    down: { spell: "Doomhammer Slam", startup: STORM, active: timed(cue("Abilities\\Weapons\\AncientProtectorMissile\\AncientProtectorMissile.mdx", "feet", f32(0.95)), "death", f32(0.3)) },
  },
  [Character.sylvanas]: {
    neutral: { spell: "Black Arrow", startup: { ...SHADOW, scale: f32(0.25), scaleEnd: f32(0.45), scaleFrames: 15, anchorFrames: Array.from({ length: 40 }, () => ({ x: 44.0, z: 60.0 })) }, active: { ...cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.18)), anchorFrames: Array.from({ length: 40 }, () => ({ x: 44.0, z: 60.0 })) } },
    side: { spell: "Silence", startup: { ...SHADOW, scale: f32(0.3), scaleEnd: f32(0.6), scaleFrames: 18 }, active: { ...cue("Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx", "ahead", f32(0.85)), birth: { eachFrame: false, strike: 0 } } },
    up: { spell: "Banshee Flight", startup: SHADOW, active: cue("Abilities\\Spells\\Undead\\Possession\\PossessionCaster.mdx", "body", f32(0.7)) },
    down: { spell: "Life Drain", startup: { ...cue("Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", "hand", f32(0.2)), scaleEnd: f32(0.35), scaleFrames: 15, anchorFrames: Array.from({ length: 52 }, () => ({ x: 38.0, z: 54.0 })) }, active: { ...cue("Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", "ahead", f32(0.3)), anchorFrames: Array.from({ length: 52 }, () => ({ x: 68.0, z: 54.0 })) } },
  },
  [Character.chen]: {
    neutral: { spell: "Breath of Fire", startup: BREW, active: { ...timed(cue("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx", "breath", 1.0), "birth", 0.0), roll: f32(1.570796327), birth: { eachFrame: true, strike: 0, strikes: 4, strikeRadius: 70.0, trail: 150.0, taper: true, voices: 24, lingerFrames: 6 } } },
    side: { spell: "Drunken Haze", startup: BREW, active: cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterTarget.mdx", "hand", f32(0.7)) },
    up: { spell: "Storm Rise", startup: STORM, active: cue("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", "body", f32(0.6)) },
    down: { spell: "Threefold Stance", startup: BREW, active: cue("Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx", "body", f32(0.6)) },
  },
  [Character.tinker]: {
    neutral: { spell: "Cluster Rockets", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: drawn("Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl", "hand") },
    side: { spell: "Laser", startup: { ...cue("Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", "hand", f32(1.2)), scaleEnd: f32(2.2), scaleFrames: 19 }, active: cue("Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx", "hand", f32(0.6)) },
    up: { spell: "Rocket Boots", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: cue("Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", "feet", 0.25) },
    down: { spell: "Pocket Factory", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: drawn("Units\\Creeps\\HeroTinkerFactory\\HeroTinkerFactory.mdl", "ahead") },
  },
  [Character.kaelthas]: {
    neutral: { spell: "Flamestrike", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", 0.5), active: drawn("Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx", "hand") },
    side: { spell: "Drain Mana", startup: cue("Abilities\\Spells\\Other\\Drain\\ManaDrainCaster.mdx", "hand", 1.0), active: cue("Abilities\\Spells\\Other\\Drain\\ManaDrainTarget.mdx", "ahead", 1.0) },
    up: KAEL_PHOENIX_CHARGE,
    down: { spell: "Banish", startup: cue("Abilities\\Spells\\Orc\\EtherealForm\\SpiritWalkerChange.mdx", "hand", 0.5), active: cue("Abilities\\Spells\\Human\\Banish\\BanishTarget.mdx", "hand", 0.5) },
  },
  [Character.murloc]: {
    neutral: { spell: "Ensnare", startup: MURGUL, active: cue("Abilities\\Spells\\Orc\\Ensnare\\EnsnareTarget.mdx", "hand", 0.75) },
    side: { spell: "Tidal Rush", startup: MURGUL, active: timed(cue("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", "feet", 1.0), "birth", 0.0) },
    up: { spell: "Tide Spout", startup: MURGUL, active: timed(cue("Objects\\Spawnmodels\\Naga\\NagaDeath\\NagaDeath.mdx", "feet", 1.0), "birth", 0.0) },
    down: { spell: "Disease Cloud", startup: MURGUL, active: { ...cue("Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx", "feet", 0.75), color: [104, 156, 104] } },
  },
  [Character.medivh]: {
    neutral: { spell: "Arcane Omen", startup: ARCANE, active: cue("Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl", "hand", 0.5) },
    side: { spell: "Vanishing Act", startup: ARCANE, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkTarget.mdx", "body", 0.75) },
    up: { spell: "Raven Flight", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\Polymorph\\PolyMorphDoneGround.mdx", "body", 0.75) },
    down: { spell: "Last Word", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", 0.75) },
  },
  [Character.anubarak]: {
    neutral: { spell: "Impale", startup: BURROW, active: cue("Abilities\\Spells\\Undead\\Impale\\ImpaleMissTarget.mdl", "ahead", f32(0.6)) },
    side: { spell: "Burrow Hunt", startup: BURROW, active: cue("Objects\\Spawnmodels\\Undead\\UCancelDeath\\UCancelDeath.mdx", "feet", f32(0.5)) },
    up: { spell: "Crypt Eruption", startup: BURROW, active: cue("Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx", "feet", f32(0.4)) },
    down: { spell: "Carrion Beetle", startup: BURROW, active: drawn("Units\\Undead\\Scarab\\Scarab.mdl", "ahead") },
  },
  [Character.grom]: {
    neutral: { spell: "Warsong Cry", startup: BLOODLUST, active: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", 0.75) },
    side: { spell: "Gorehowl Rush", startup: BLOODLUST, active: BLOODLUST },
    up: { spell: "Blood Leap", startup: BLOODLUST, active: { ...BEAST, anchor: "body" } },
    down: { spell: "Mannoroth's Bane", startup: BLOODLUST, active: { ...VOODOO, anchor: "ahead" } },
  },
  [Character.kobold]: {
    neutral: { spell: "Wick Flick", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", f32(0.3)), active: cue("Abilities\\Weapons\\LavaSpawnMissile\\LavaSpawnMissile.mdx", "hand", f32(0.4)) },
    side: { spell: "Panic Dig", startup: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.3)), active: cue("Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx", "feet", f32(0.25)) },
    up: { spell: "Candle Escape", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", f32(0.3)), active: cue("Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedTarget.mdx", "feet", f32(0.3)) },
    down: { spell: "Mine!", startup: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.3)), active: timed(cue("Objects\\Spawnmodels\\Human\\FragmentationShards\\FragBoomSpawn.mdx", "feet", f32(0.3)), "birth", 0.0) },
  },
  [Character.blademaster]: {
    neutral: { spell: "Wind Cutter", startup: WIND_GATHER, active: cue("Abilities\\Spells\\Other\\Tornado\\Tornado_Target.mdx", "hand", f32(0.6)) },
    side: { spell: "Wind Walk", startup: WIND_WALK, active: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", "ahead", f32(0.8)) },
    up: { spell: "Rising Whirlwind", startup: WIND_GATHER, active: cue("Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Mirror Image", startup: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "body", 1.0), active: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageDeathCaster.mdx", "body", 1.0) },
  },
  [Character.mountainKing]: {
    neutral: { spell: "Storm Bolt", startup: STORM, active: cue("Abilities\\Spells\\Other\\ForkedLightning\\ForkedLightningTarget.mdx", "hand", f32(0.8)) },
    side: { spell: "Storm Rush", startup: cue("Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx", "body", f32(0.8)), active: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.8)) },
    up: { spell: "Thunder Leap", startup: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", 0.5), active: cue("Abilities\\Spells\\Orc\\LightningShield\\LightningShieldTarget.mdx", "body", f32(0.8)) },
    down: { spell: "Thunder Clap", startup: STORM, active: THUNDER_CLAP_CUE },
  },
  [Character.warden]: {
    neutral: { spell: "Shadow Strike", startup: cue("Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrike.mdx", "hand", f32(0.7)), active: timed(cue("Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx", "hand", 1.0), "stand", 0.0) },
    side: { spell: "Shadow Pursuit", startup: SHADOW, active: cue("Abilities\\Weapons\\GlaiveMissile\\GlaiveMissileTarget.mdx", "ahead", 1.0) },
    up: { spell: "Blink", startup: SHADOW, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx", "body", f32(0.6)) },
    down: { spell: "Fan of Knives", startup: SHADOW, active: cue("Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesCaster.mdx", "body", f32(0.6)) },
  },
  [Character.lich]: {
    neutral: { spell: "Frost Nova", startup: FROST, active: timed(cue("Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx", "hand", 0.5), "stand", 0.0) },
    side: { spell: "Death and Decay", startup: cue("Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx", "hand", f32(0.6)), active: cue("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", "hand", f32(0.7)) },
    up: { spell: "Spectral Ascent", startup: FROST, active: cue("Abilities\\Spells\\Undead\\Unsummon\\UnsummonTarget.mdx", "body", f32(0.7)) },
    down: { spell: "Frost Armor", startup: timed(cue(FROST_ARMOR_SHELL_MODEL, "body", 1.0), "birth", 0.0), active: timed(cue("Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorDamage.mdx", "body", f32(1.2)), "birth", 0.0) },
  },
  [Character.forsakenPaladin]: {
    neutral: { spell: "Cleansing Sword", startup: { ...SHADOW, scale: f32(0.35) }, active: cue("Abilities\\Spells\\Undead\\UnholyFrenzy\\UnholyFrenzyTarget.mdx", "hand", f32(0.5)) },
    side: { spell: "Righteous Fury", startup: { ...SHADOW, scale: f32(0.4) }, active: timed(cue("Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx", "hand", f32(0.2)), "birth", f32(0.2)) },
    up: { spell: "Ascension", startup: { ...SHADOW, scale: f32(0.35) }, active: cue("Abilities\\Spells\\Undead\\Possession\\PossessionTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Consecration", startup: { ...SHADOW, scale: f32(0.4) }, active: timed(cue("Abilities\\Spells\\Human\\InnerFire\\InnerFireTarget.mdx", "hand", f32(0.2)), "stand", f32(0.2)) },
  },
  [Character.dreadlord]: {
    neutral: { spell: "Carrion Swarm", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\CarrionSwarm\\CarrionSwarmDamage.mdx", "hand", f32(0.8)) },
    side: { spell: "Corkscrew Pounce", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Items\\VampiricPotion\\VampPotionCaster.mdx", "behind", f32(0.8)) },
    up: { spell: "Bat Ascension", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\DarkSummoning\\DarkSummonTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Sleep", startup: VAMPIRIC, active: cue("Abilities\\Spells\\Undead\\Sleep\\SleepSpecialArt.mdx", "hand", f32(0.8)) },
  },
  [Character.shadowHunter]: {
    neutral: { spell: "Spirit Glaive", startup: VOODOO, active: { ...cue("Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx", "hand", f32(0.4)), roll: f32(1.570796327) } },
    side: { spell: "Serpent Ward", startup: VOODOO, active: cue("Abilities\\Spells\\Orc\\StasisTrap\\StasisTotemTarget.mdx", "ahead", f32(0.7)) },
    up: { spell: "Loa Vault", startup: cue("Abilities\\Spells\\Orc\\SpiritLink\\SpiritLinkTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritDone.mdx", "feet", f32(0.8)) },
    down: { spell: "Hex", startup: VOODOO, active: cue("Abilities\\Spells\\Human\\Polymorph\\PolymorphTarget.mdx", "hand", f32(0.6)) },
  },
  [Character.pitLord]: {
    neutral: { spell: "Howl of Terror", startup: FEL, active: cue("Abilities\\Spells\\Other\\HowlOfTerror\\HowlCaster.mdx", "body", f32(0.7)) },
    side: { spell: "Ruin Charge", startup: FEL, active: timed(cue(IMPACT_DUST_MODEL, "feet", f32(0.8)), "stand", 0.0) },
    up: { spell: "Abyssal Leap", startup: FEL, active: timed(cue("Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", "feet", f32(0.5)), "birth", f32(0.2)) },
    down: { spell: "Rain of Fire", startup: FEL, active: { ...timed(cue(RAIN_OF_FIRE_TARGET, "overhead", f32(0.5)), "birth", f32(0.8)), timeScale: 1.5 } },
  },
  [Character.lichKing]: {
    neutral: { spell: "Howling Blast", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx", "hand", 1.0) },
    side: { spell: "Val'kyr Shadowguard", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\Cripple\\CrippleTarget.mdx", "ahead", f32(0.8)) },
    up: { spell: "Ascension of the Damned", startup: RUNE, active: cue("Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", "body", 0.5) },
    down: { spell: "Defile", startup: RUNE, active: drawn("Abilities\\Spells\\Undead\\UnholyAura\\UnholyAura.mdx", "feet") },
  },
  [Character.beastmaster]: {
    neutral: { spell: "Wild Axes", startup: BEAST, active: cue("Abilities\\Weapons\\Axe\\AxeMissile.mdx", "hand", 1.0) },
    side: { spell: "Summon Bear", startup: BEAST, active: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "ahead", f32(0.6)) },
    up: { spell: "Summon Hawk", startup: BEAST, active: cue("Abilities\\Weapons\\DruidoftheTalonMissile\\DruidoftheTalonMissile.mdx", "body", f32(0.6)) },
    down: { spell: "Summon Quilbeast", startup: BEAST, active: cue("Abilities\\Weapons\\QuillSprayMissile\\QuillSprayMissile.mdx", "ahead", f32(0.6)) },
  },
};







const FEL_TELL = timed(cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "body", 0.5), "stand", f32(0.3));


const MANA_BURN_HAND = "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx";
const FEL_FLAMES = "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx";


export const ORIGINAL_CUES: { readonly [action: number]: MoveCues } = {
  [SpecialAction.riflemanBlaster]: { spell: "Blaster", startup: drawn(RIFLEMAN_MODEL_FILE, "barrel"), active: cue("Abilities\\Weapons\\GyroCopter\\GyroCopterImpact.mdx", "barrel", 0.5) },
  [SpecialAction.riflemanBear]: { spell: "Summon Bear", startup: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritTarget.mdx", "ahead", f32(0.8)) },
  [SpecialAction.riflemanRecovery]: { spell: "Recoil Shot", startup: cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), active: timed(cue("Abilities\\Weapons\\Mortar\\MortarMissile.mdx", "feet", f32(0.4)), "death", 0.0) },
  [SpecialAction.riflemanTrap]: { spell: "Frost Trap", startup: FROST_TRAP, active: FROST_TRAP },
  [SpecialAction.demonHunterManaBurn]: { spell: "Mana Burn", startup: drawn(MANA_BURN_HAND, "hand"), active: cue("Abilities\\Spells\\Human\\Feedback\\SpellBreakerAttack.mdx", "hand", 1.0) },

  [SpecialAction.demonHunterFelRush]: { spell: "Fel Rush", startup: FEL_TELL, active: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", "body", 1.0), "stand", 0.0) },
  [SpecialAction.demonHunterWingAscent]: { spell: "Metamorphosis wings", startup: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0), active: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0) },
  [SpecialAction.demonHunterImmolate]: { spell: "Immolation", startup: drawn(FEL_FLAMES, "body"), active: drawn(FEL_FLAMES, "body") },
};


// Cue absence uses "none" because Lua drops null array entries.




export type BranchCue = MoveCues | "slot" | "none";


export interface HeroBranchCues {
  readonly recall?: BranchCue | undefined;
  readonly marked?: BranchCue | undefined;
  readonly followUps?: readonly BranchCue[] | undefined;
}

const branch = (spell: string, startup: Cue, active: Cue): MoveCues => ({ spell, startup, active });


export const HERO_BRANCH_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]?: HeroBranchCues } } = {
  [Character.malfurion]: { down: { recall: "slot" } },
  [Character.anubarak]: { down: { recall: "slot" } },
  [Character.jaina]: {
    down: { recall: branch("Recall Water Elemental", ARCANE, cue("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportCaster.mdx", "body", 0.5)) },
  },
  [Character.chen]: {
    down: { followUps: [
      branch("Fire Palm", BEAST, timed(cue("Abilities\\Spells\\Items\\AIfb\\AIfbSpecialArt.mdx", "ahead", f32(0.8)), "birth", 0.0)),
      branch("Storm Step", STORM, cue("Abilities\\Spells\\Other\\Monsoon\\MonsoonBoltTarget.mdx", "body", f32(0.5))),
    ] },
  },
  [Character.peon]: {
    side: { recall: branch("Pack Up", timed(cue(IMPACT_DUST_MODEL, "ahead", f32(0.15)), "stand", 0.0), cue("UI\\Feedback\\GoldCredit\\GoldCredit.mdl", "hand", f32(0.7))) },
  },
  [Character.tinker]: { side: { recall: "slot" } },
  [Character.blademaster]: {
    side: { followUps: [
      branch("Backstab", WIND_WALK, cue("Abilities\\Weapons\\Blood\\BloodImpact.mdx", "ahead", 1.0)),
      branch("Step Out", WIND_WALK, cue("Abilities\\Spells\\Orc\\EtherealForm\\SpiritWalkerChange.mdx", "body", f32(0.7))),
    ] },
    down: { recall: branch("Image Swap", cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "body", 1.0), cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageMissile.mdx", "body", 1.0)) },
  },
  [Character.mountainKing]: {
    neutral: { recall: branch("Storm Bolt recall", STORM, cue("Abilities\\Spells\\Orc\\LightningShield\\LightningShieldBuff.mdx", "hand", f32(0.8))) },
    up: { followUps: [branch("Hammerfall", STORM, cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", f32(0.6)))] },

    down: { followUps: [branch("Small Clap", STORM, { ...cue("Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx", "feet", f32(0.255)), sound: "ThunderClap" }), "slot", "none"] },
  },
  [Character.warden]: {
    side: { marked: branch("Shadow Pursuit", SHADOW, cue("Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrike.mdx", "body", f32(0.7))) },
  },
  [Character.lich]: {
    neutral: { recall: branch("Frost Nova burst", FROST, timed(cue("Abilities\\Spells\\Other\\BreathOfFrost\\BreathOfFrostTarget.mdx", "hand", f32(0.6)), "death", 0.0)) },
    down: { recall: branch("Dark Ritual", FROST, cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualTarget.mdx", "body", 1.0)) },
  },
  [Character.shadowHunter]: {
    side: { recall: branch("Ward recall", VOODOO, cue("Abilities\\Spells\\Orc\\AncestralSpirit\\AncestralSpiritCaster.mdx", "ahead", 0.5)) },
  },
  [Character.beastmaster]: {
    up: { recall: branch("Hawk Dive", BEAST, cue("Abilities\\Weapons\\DragonHawkMissile\\DragonHawkMissile.mdx", "hand", f32(0.8))) },
    side: { recall: branch("Stampede", BEAST, cue("Abilities\\Spells\\Other\\Stampede\\StampedeMissile.mdx", "ahead", f32(0.6))) },
    down: { recall: "slot" },
  },
};


export interface OriginalBranch {
  readonly cues: MoveCues;
  readonly first: number;
  readonly last: number;
}


const CHAOS_STRIKE_CUES: OriginalBranch = { cues: branch("Chaos Strike", FEL_TELL, timed(cue("Abilities\\Spells\\NightElf\\MoonGlaive\\MoonGlaiveCaster.mdx", "ahead", 1.0), "stand", 0.0)), first: CHAOS_STRIKE_FIRST, last: CHAOS_STRIKE_LAST };


export const EYE_BLAST_EYES: Cue = { model: "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", anchor: "overhead", scale: f32(0.9), sequence: "stand", seconds: 0.0 };

export const ORIGINAL_BRANCH_CUES: { readonly [action: number]: { readonly [form: number]: OriginalBranch } } = {
  [SpecialAction.demonHunterManaBurn]: {
    [EYE_BLAST_FORM]: { cues: branch("Eye Blast", EYE_BLAST_EYES, timed(cue("Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx", "breath", f32(1.5)), "birth", 0.0)), first: EYE_BLAST_FIRST, last: EYE_BLAST_LAST },
  },
  [SpecialAction.demonHunterFelRush]: {

    [VENGEFUL_RETREAT_FORM]: { cues: branch("Vengeful Retreat", FEL_TELL, timed(cue("Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx", "body", 1.0), "stand", 0.0)), first: 1, last: VENGEFUL_RETREAT_MOVE_LAST },
    [CHAOS_STRIKE_FORM]: CHAOS_STRIKE_CUES,
    [CHAOS_STRIKE_AIR_FORM]: CHAOS_STRIKE_CUES,
  },

  [SpecialAction.demonHunterWingAscent]: {
    [DEMONHUNTER_GLIDE_SLASH_FORM]: { cues: branch("Glide slash", FEL_TELL, cue("Abilities\\Spells\\Undead\\Impale\\ImpaleHitTarget.mdx", "ahead", f32(0.8))), first: 1, last: 1 },
  },
  [SpecialAction.riflemanRecovery]: {
    [RIFLEMAN_SECOND_SHOT_FORM]: { cues: branch("Second recoil shot", cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), cue("Abilities\\Weapons\\SteamTank\\SteamTankImpact.mdx", "feet", f32(0.8))), first: RIFLEMAN_SECOND_SHOT_FIRST, last: RIFLEMAN_SECOND_SHOT_LAST },
  },
};


export interface CueWindows {
  readonly startup: FrameWindow;
  readonly active: FrameWindow;
}


export const ACTIVE_CUE_FRAMES = 18;

const widen = (window: { first: number; last: number }, first: number, last: number): void => {
  window.first = Math.min(window.first, first);
  window.last = Math.max(window.last, last);
};






export function heroCueWindows(move: Readonly<AuthoredSpecial>, minimumActive = ACTIVE_CUE_FRAMES): CueWindows {

  const active = { first: 1000000, last: 0 };

  for (const region of move.regions ?? []) widen(active, region.firstFrame + 1, region.lastFrame + 1);
  for (const projectile of move.projectiles ?? []) widen(active, projectile.spawnFrame, projectile.spawnFrame);
  for (const segment of move.motion ?? []) {
    if (segment.velocityX !== 0 || segment.velocityZ !== 0 || (segment.aimedSpeed ?? 0) !== 0
      || (segment.driftSpeed ?? 0) !== 0 || segment.relocate !== undefined) widen(active, segment.first, segment.last);
  }
  if (move.placement !== undefined) widen(active, move.placement.frame, move.placement.frame);
  if (move.burst !== undefined) widen(active, move.burst.frame, move.burst.frame);
  if (move.ritual !== undefined) widen(active, move.ritual.frame, move.ritual.frame);
  if (move.commandGrab !== undefined) widen(active, move.commandGrab.first, move.commandGrab.last);
  if (move.guard !== undefined) widen(active, move.guard.first, move.guard.last);
  if (move.intangible !== undefined) widen(active, move.intangible.first, move.intangible.last);

  if (move.armor !== undefined) widen(active, move.armor.first, move.armor.shell === true ? move.armor.first : move.armor.last);
  if (active.last === 0) widen(active, 1, 1);
  const first = Math.max(1, active.first);
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.min(move.endFrame, Math.max(active.last, first + minimumActive - 1)) } };
}


function originalActiveFrame(action: number, grounded: boolean): number {
  switch (action) {
    case SpecialAction.riflemanBlaster: return grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR_CAST_FRAMES;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY_STARTUP_FRAMES;
    case SpecialAction.riflemanTrap: return 2;
    case SpecialAction.demonHunterManaBurn: return DEMONHUNTER_MANA_BURN_STARTUP;
    case SpecialAction.demonHunterFelRush: return FEL_RUSH_FIRST;
    case SpecialAction.demonHunterWingAscent: return DEMONHUNTER_WING_STARTUP;
    case SpecialAction.demonHunterImmolate: return DEMONHUNTER_IMMOLATE_STARTUP;
    default: return 1;
  }
}


export function originalCueWindows(action: number, grounded: boolean): CueWindows {
  const first = originalActiveFrame(action, grounded);
  const authoredLast = action === SpecialAction.demonHunterFelRush ? FEL_RUSH_LAST
    : action === SpecialAction.demonHunterImmolate ? DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE - 1 : first;
  return { startup: { first: 1, last: Math.max(1, first - 1) }, active: { first, last: Math.max(authoredLast, first + ACTIVE_CUE_FRAMES - 1) } };
}




export interface CueState {
  readonly cues: MoveCues | undefined;
  readonly phase: "none" | "startup" | "active";
}

const NONE: CueState = { cues: undefined, phase: "none" };


export function specialCueState(fighter: Readonly<Fighter>): CueState {
  const { action, frame } = fighter.special;
  if (action === SpecialAction.none || fighter.status.out) return NONE;
  if (fighter.character === Character.peon && action === SpecialAction.heroDown) {
    return { cues: PEON_REST_CUES, phase: frame <= REST_SOUR_FRAME ? "startup" : "active" };
  }
  if (fighter.character === Character.dreadlord && action === SpecialAction.heroSide && fighter.special.grabFrame > 0) {
    return frame <= fighter.special.grabFrame + 16 ? { cues: DREADLORD_BITE_CUES, phase: "active" } : NONE;
  }
  if (fighter.character === Character.kaelthas && action === SpecialAction.heroUp && fighter.special.form < FOLLOW_UP_FORM) {
    if (frame > PHOENIX_CHARGE_FRAMES && frame <= PHOENIX_CHARGE_FRAMES + PHOENIX_FLIGHT_FRAMES) return { cues: KAEL_PHOENIX_FORM, phase: "active" };
    return frame <= PHOENIX_CHARGE_FRAMES ? { cues: KAEL_PHOENIX_CHARGE, phase: frame < 16 ? "startup" : "active" } : NONE;
  }
  if (fighter.character === Character.kobold && action === SpecialAction.heroUltimate) {
    return frame >= KOBOLD_BURROW_FIRST && frame <= KOBOLD_BURROW_LAST ? { cues: KOBOLD_BURROW_TRAIL, phase: "active" } : NONE;
  }
  if (fighter.character === Character.sylvanas && action === SpecialAction.heroUltimate) {
    const seek = runningHeroSpecial(fighter)?.motion?.find((segment) => segment.seek !== undefined);
    if (seek === undefined) return NONE;
    if (frame >= seek.first && frame <= seek.last) return { cues: BANSHEE_FORM, phase: "active" };
    return fighter.special.form === 0 && frame < seek.first ? { cues: BANSHEE_FORM, phase: "startup" } : NONE;
  }
  let cues: MoveCues | undefined;
  let windows: CueWindows | undefined;
  if (action >= SpecialAction.heroNeutral && action <= SpecialAction.heroDown) {
    const move = runningHeroSpecial(fighter);
    const slot = SPECIAL_SLOTS[action - SpecialAction.heroNeutral] ?? "neutral";
    const branchCue = heroBranchCue(HERO_BRANCH_CUES[fighter.character]?.[slot], fighter.special.form);
    if (branchCue === "none") return NONE;
    cues = branchCue === undefined || branchCue === "slot" ? HERO_CUES[fighter.character]?.[slot] : branchCue;
    windows = move === undefined ? undefined : heroCueWindows(move, cues?.active === THUNDER_CLAP_CUE ? 1 : ACTIVE_CUE_FRAMES);
  } else {
    const branch = ORIGINAL_BRANCH_CUES[action]?.[fighter.special.form];
    cues = branch === undefined ? ORIGINAL_CUES[action] : branch.cues;
    windows = branch === undefined ? originalCueWindows(action, fighter.motion.grounded) : branchWindows(branch);
  }
  if (cues === undefined || windows === undefined) return NONE;
  if (frame >= windows.active.first && frame <= windows.active.last) return { cues, phase: "active" };
  if (frame >= windows.startup.first && frame <= windows.startup.last) return { cues, phase: "startup" };
  return { cues, phase: "none" };
}


export const ORIGINAL_ACTIONS: { readonly [character: number]: readonly SpecialAction[] } = {
  [Character.rifleman]: [SpecialAction.riflemanBlaster, SpecialAction.riflemanBear, SpecialAction.riflemanRecovery, SpecialAction.riflemanTrap],
  [Character.demonHunter]: [SpecialAction.demonHunterManaBurn, SpecialAction.demonHunterFelRush, SpecialAction.demonHunterWingAscent, SpecialAction.demonHunterImmolate],
};


export function fighterMoveCues(character: Character): readonly MoveCues[] {
  const hero = HERO_CUES[character];
  if (hero !== undefined) return SPECIAL_SLOTS.map((slot) => hero[slot]);
  return (ORIGINAL_ACTIONS[character] ?? []).flatMap((action) => ORIGINAL_CUES[action] ?? []);
}


export function fighterCueList(character: Character): readonly Cue[] {
  return [...fighterMoveCues(character), ...fighterBranchCues(character), ...(character === Character.dreadlord ? [DREADLORD_BITE_CUES] : []), ...(character === Character.kaelthas ? [KAEL_PHOENIX_FORM] : []), ...(character === Character.kobold ? [KOBOLD_BURROW_TRAIL] : []), ...(character === Character.sylvanas ? [BANSHEE_FORM] : [])].flatMap((cues) => [cues.startup, cues.active]);
}


export function fighterBranchCues(character: Character): readonly MoveCues[] {
  const out: MoveCues[] = [];
  const add = (cue: BranchCue | undefined): void => {
    if (cue !== undefined && cue !== "none" && cue !== "slot" && !out.includes(cue)) out.push(cue);
  };
  for (const slot of SPECIAL_SLOTS) {
    const branches = HERO_BRANCH_CUES[character]?.[slot];
    add(branches?.recall);
    add(branches?.marked);
    for (const cue of branches?.followUps ?? []) add(cue);
  }
  for (const action of ORIGINAL_ACTIONS[character] ?? []) for (const branch of Object.values(ORIGINAL_BRANCH_CUES[action] ?? {})) add(branch.cues);
  return out;
}


export function allCueModels(): readonly string[] {
  const models: string[] = [];
  const characters: readonly Character[] = [ Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];
  for (const character of characters) for (const cue of fighterCueList(character)) if (cue.drawn !== true && !models.includes(cue.model)) models.push(cue.model);
  return models;
}


export function fighterOwnCues(character: Character): readonly Cue[] {
  const own: Cue[] = [];
  for (const cue of fighterCueList(character)) if (cue.drawn !== true && !own.includes(cue)) own.push(cue);
  return own;
}


export function heroBranchCue(branches: Readonly<HeroBranchCues> | undefined, form: number): BranchCue | undefined {
  if (form >= FOLLOW_UP_FORM) return branches?.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1];
  if (form === SpecialForm.recall) return branches?.recall;
  if (form === SpecialForm.marked) return branches?.marked;
  return undefined;
}


function branchWindows(branch: Readonly<OriginalBranch>): CueWindows {
  return { startup: { first: 1, last: Math.max(1, branch.first - 1) }, active: { first: branch.first, last: Math.max(branch.last, branch.first + ACTIVE_CUE_FRAMES - 1) } };
}
