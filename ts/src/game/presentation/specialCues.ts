




import { f32 } from "wisp/src/sim/f32";
import { Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { eyeBeamShotFrameWhen } from "../sim/eyeBeam";
import { type AuthoredSpecial, FOLLOW_UP_FORM, SpecialForm } from "../sim/specials/schema";
import { ACTIVE_CUE_FRAMES, type CueWindows, heroCueWindows } from "./cueWindows";
import { idiv } from "wisp/src/sim/intMath";
import { runningHeroSpecial } from "../sim/specials/runningMove";
import { commandGrabHolding } from "../sim/specials/commandGrabLock";
import { HERO_ROSTER } from "../roster/kits";
import { PHOENIX_BURN_FRAMES, PHOENIX_STARTUP_FRAMES, PYROBLAST_STARTUP_FRAMES } from "../fighters/kaelthas/specials";
import { GOLD_SACK_SLOT_CUES, peonCueState, peonExtraCues } from "./peonCues";
import {
  DEMONHUNTER_BACKFLIP_FORM,
  DEMONHUNTER_BACKFLIP_FRAMES,
  DEMONHUNTER_DIVE_FORM,
  DEMONHUNTER_DIVE_FRAMES,
  DEMONHUNTER_IMMOLATE_ACTIVE,
  DEMONHUNTER_IMMOLATE_STARTUP,
  DEMONHUNTER_WING_STARTUP,
  FEL_RUSH_FIRST,
  FEL_RUSH_LAST,
  RIFLEMAN_BEAR_CAST_FRAMES,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES,
  RIFLEMAN_SECOND_SHOT_FIRST,
  RIFLEMAN_SECOND_SHOT_FORM,
  RIFLEMAN_SECOND_SHOT_LAST,
} from "../sim/specials";
import { SPECIAL_SLOTS, type SpecialSlot } from "./projectileArt";
import { RIFLEMAN_MODEL_FILE } from "./fighterAssetInfo";
import { FROST_TRAP_MODEL } from "../../generated/assets/frostAssetInfo";
import { IMPACT_DUST_MODEL } from "../assets/impactAssetInfo";
import { GROM_BLOODLUST_MODEL, MURLOC_SWAMP_MIST_MODEL } from "../assets/importedModelInfo";
import { MOUNTAIN_KING_SPECIALS } from "../fighters/mountain-king/specials";
import { HOOK_MODEL } from "../fighters/butcher/specials";
import { HOOK_LINK_MODEL } from "./hookChain";
import { HOWL_FIRST, HOWL_REACH } from "../fighters/pit-lord/specials";
import { SYLVANAS_SPECIALS } from "../fighters/sylvanas/specials";
import { WARDEN_SPECIALS } from "../fighters/warden/specials";
import { QUICKDRAW_DRAW_CUES, QUICKDRAW_STANCE_CUES } from "./quickdrawCues";


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
  /** When its move ends early, the cue keeps playing where it stood until this many frames after it first showed (presentation/cueLinger.ts). */
  readonly lingerFrames?: number | undefined;
}

export const timed = (cue: Cue, sequence: string, seconds: number): Cue => ({ ...cue, sequence, seconds });


export interface MoveCues {
  readonly spell: string;
  readonly startup: Cue;
  readonly active: Cue;
  /** The fighter's own body tint and alpha while either cue shows. */
  readonly body?: { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } | undefined;
  readonly trail?: true | undefined;
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
  const pitch = name === "ThunderClapCaster" || name === "WarStompCaster" || name === "Consecration" ? f32(1.570796327) : 0.0;
  return { model, anchor, scale, sequence, seconds, pitch };
};
const drawn = (model: string, anchor: CueAnchor): Cue => ({ model, anchor, scale: 1.0, drawn: true });



const BLOODLUST = cue(GROM_BLOODLUST_MODEL, "hand", f32(0.8));
// The Blademaster gathers wind and fades into Wind Walk rather than borrowing the Shaman's Bloodlust (#499).
const WIND_GATHER = cue("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", "body", f32(0.4));
const WIND_WALK = cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", f32(0.8));
const WIND_WALK_BODY = { red: 255, green: 255, blue: 255, alpha: 120 };
const WIND_WALK_COUNTER: Cue = { ...cue("Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx", "body", 1.0), sound: "WindWalk" };
const STORM = cue("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", "hand", 1.0);
// Warcraft discards the first seek after selecting an animation, so this held stand ring keeps its default sequence.
const THUNDER_CLAP_CUE: Cue = { ...cue("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", "feet", f32((MOUNTAIN_KING_SPECIALS.down.ground.regions?.[0]?.hit.maxX ?? 0.0) / f32(187.05800313601685))), sequence: undefined, pitch: 0.0, timeScale: 0.0, sound: "ThunderClap" };
const SHADOW = cue("Abilities\\Spells\\Undead\\Curse\\CurseTarget.mdx", "hand", f32(0.7));
// Her own Shadow Strike vortex loops on her body through the 20-frame hold, following the crouch that draws her model back from her position, so the dash reads apart from Fel Rush's green coil.
const SHADOW_DASH_TELL: Cue = { ...cue("Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrike.mdx", "body", f32(1.1)), anchorFrames: [0.0, -9.0, -18.0, -27.0, ...Array.from({ length: 16 }, () => -36.0)].map((x) => ({ x, z: 50.0 })) };
const BLACK_ARROW_FRAMES = SYLVANAS_SPECIALS.neutral.ground.endFrame;
const BLACK_ARROW_SHOT = SYLVANAS_SPECIALS.neutral.ground.projectiles?.[0]?.spawnFrame ?? BLACK_ARROW_FRAMES;
const GLAIVE_GLINT: Cue = { ...timed(cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", f32(0.3)), "birth", 0.0), anchorFrames: Array.from({ length: WARDEN_SPECIALS.side.ground.endFrame }, () => ({ x: -70.0, z: 62.0 })), color: [200, 230, 255], sound: "MetalLightSliceMetal" };
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
  active: { ...timed(cue("Units\\Undead\\Banshee\\Banshee.mdx", "body", f32(1.1)), "walk", 0.0), alpha: 140, color: [170, 230, 255] },
  body: { red: 150, green: 140, blue: 210, alpha: 50 },
};
const DREADLORD_BITE_CUES: MoveCues = { spell: "Healing bite", startup: VAMPIRIC, active: cue("Abilities\\Weapons\\Blood\\BloodImpact.mdx", "ahead", 1.0) };
const VOODOO = cue("Abilities\\Spells\\Orc\\TrollBerserk\\TrollBeserkerTarget.mdx", "hand", f32(0.7));
const FEL = cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.7));
const FINGER_GLOW = cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(1.3));
const HOWL_INHALE: Cue = { ...FEL, scale: f32(0.25), scaleEnd: f32(1.2), scaleFrames: HOWL_FIRST - 1, color: [160, 20, 10], sound: "HowlOfTerror", anchorFrames: Array.from({ length: HOWL_FIRST }, () => ({ x: 38.0, z: 118.0 })) };
const HOWL_ROAR: Cue = { ...cue("Abilities\\Spells\\Other\\HowlOfTerror\\HowlCaster.mdx", "feet", f32(HOWL_REACH / f32(440.0))), color: [255, 60, 30] };
const MURGUL = cue("Abilities\\Weapons\\MurgulMagicMissile\\MurgulMagicMissile.mdx", "hand", f32(0.6));
const BEAST = cue("Abilities\\Spells\\Orc\\Bloodlust\\BloodlustTarget.mdx", "hand", f32(0.6));
const QUIET_BEAST = cue(GROM_BLOODLUST_MODEL, "hand", f32(0.6));
const BREW = cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx", "hand", f32(0.6));
const NATURE = cue("Abilities\\Spells\\NightElf\\Tranquility\\TranquilityTarget.mdx", "hand", f32(0.7));

export const FROST_ARMOR_SHELL_MODEL = "Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorTarget.mdx";

const RUNE = cue("Abilities\\Spells\\Undead\\DarkRitual\\DarkRitualCaster.mdx", "feet", f32(0.6));



const LOG_TEAR_DUST = Array.from({ length: 30 }, () => ({ x: 165.0, z: 6.0 }));

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
    ] }, active: drawn("Abilities\\Spells\\Orc\\Shockwave\\ShockwaveMissile.mdx", "ahead") },
    side: { spell: "Bloodhoof Gore", startup: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.35)), active: cue("Objects\\Spawnmodels\\Demon\\DemonLargeDeathExplode\\DemonLargeDeathExplode.mdx", "ahead", f32(0.6)) },
    up: { spell: "Spirit Lift", startup: QUIET_BEAST, active: cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAura.mdx", "feet", f32(0.7)) },
    down: { spell: "War Stomp", startup: QUIET_BEAST, active: cue("Abilities\\Spells\\Orc\\CommandAura\\CommandAuraTarget.mdx", "body", f32(0.5)) },
  },
  [Character.peon]: {
    neutral: GOLD_SACK_SLOT_CUES,
    side: { spell: "Log Heave", startup: timed(cue(IMPACT_DUST_MODEL, "ahead", f32(0.25)), "stand", 0.0), active: { ...timed(cue(IMPACT_DUST_MODEL, "ahead", f32(0.4)), "stand", 0.0), anchorFrames: LOG_TEAR_DUST } },
    up: { spell: "Worksite Launch", startup: cue("Objects\\Spawnmodels\\Other\\NeutralBuildingExplosion\\NeutralBuildingExplosion.mdx", "feet", f32(0.2)), active: cue("Objects\\Spawnmodels\\Other\\ToonBoom\\ToonBoom.mdx", "feet", f32(0.5)) },
    down: PEON_REST_CUES,
  },
  [Character.thrall]: {
    neutral: { spell: "Chain Lightning", startup: STORM, active: cue("Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx", "hand", 0.5) },
    side: { spell: "Feral Spirit", startup: BEAST, active: cue("units\\orc\\SpiritWolf\\SpiritWolf.mdx", "ahead", 0.5) },
    up: { spell: "Far Sight", startup: STORM, active: cue("Abilities\\Spells\\Orc\\Purge\\PurgeBuffTarget.mdx", "body", 0.5) },
    down: { spell: "Doomhammer Slam", startup: STORM, active: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", f32(0.8)) },
  },
  [Character.sylvanas]: {
    neutral: { spell: "Black Arrow", startup: { ...SHADOW, scale: f32(0.25), scaleEnd: f32(0.45), scaleFrames: BLACK_ARROW_SHOT - 1, anchorFrames: Array.from({ length: BLACK_ARROW_FRAMES }, () => ({ x: 44.0, z: 60.0 })) }, active: { ...cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "hand", f32(0.18)), anchorFrames: Array.from({ length: BLACK_ARROW_FRAMES }, () => ({ x: 44.0, z: 60.0 })) } },
    side: { spell: "Silence", startup: { ...SHADOW, scale: f32(0.3), scaleEnd: f32(0.6), scaleFrames: 18 }, active: { ...cue("Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx", "ahead", f32(0.85)), birth: { eachFrame: false, strike: 0 } } },
    up: { spell: "Banshee Flight", startup: SHADOW, active: cue("Abilities\\Spells\\Undead\\Possession\\PossessionCaster.mdx", "body", f32(0.7)) },
    // Classic draws DrainCaster's particles at full reach whatever its scale, so the grab frames show only the drain beam drawn on the grab region (#582).
    down: { spell: "Life Drain", startup: { ...cue("Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", "hand", f32(0.2)), scaleEnd: f32(0.35), scaleFrames: 15, anchorFrames: Array.from({ length: 52 }, () => ({ x: 38.0, z: 54.0 })) }, active: drawn("Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", "ahead") },
  },
  [Character.chen]: {
    neutral: { spell: "Breath of Fire", startup: BREW, active: { ...timed(cue("Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireMissile.mdx", "breath", 1.0), "birth", 0.0), roll: f32(1.570796327), birth: { eachFrame: true, strike: 0, strikes: 4, strikeRadius: 70.0, trail: 150.0, taper: true, voices: 24, lingerFrames: 6 } } },
    side: { spell: "Body Slam", startup: BEAST, active: cue(IMPACT_DUST_MODEL, "ahead", f32(0.3)) },
    up: { spell: "Storm Rise", startup: STORM, active: cue("Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx", "body", f32(0.6)) },
    down: { spell: "Brew Keg", startup: { ...cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterMissile.mdx", "hand", f32(0.35)), scaleEnd: f32(1.0), scaleFrames: 45 }, active: cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterTarget.mdx", "hand", f32(0.5)) },
  },
  [Character.tinker]: {
    neutral: { spell: "Cluster Rockets", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: drawn("Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl", "hand") },
    side: { spell: "Laser", startup: { ...cue("Abilities\\Weapons\\FireBallMissile\\FireBallMissile.mdx", "hand", f32(1.2)), scaleEnd: f32(2.2), scaleFrames: 19 }, active: cue("Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx", "hand", f32(0.6)) },
    up: { spell: "Rocket Boots", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: cue("Doodads\\Cinematic\\FirePillarMedium\\FirePillarMedium.mdx", "feet", 0.25) },
    down: { spell: "Pocket Factory", startup: drawn("units\\creeps\\HeroTinker\\HeroTinker.mdl", "body"), active: drawn("Units\\Creeps\\HeroTinkerFactory\\HeroTinkerFactory.mdl", "ahead") },
  },
  [Character.kaelthas]: {
    neutral: { spell: "Pyroblast", startup: { ...cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", 0.25), scaleEnd: f32(0.9), scaleFrames: PYROBLAST_STARTUP_FRAMES }, active: drawn("Abilities\\Weapons\\RedDragonBreath\\RedDragonMissile.mdx", "hand") },
    side: { spell: "Flame Strike", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", 0.5), active: drawn("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeTarget.mdx", "ahead") },
    up: KAEL_PHOENIX_CHARGE,
    down: { spell: "Banish", startup: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", 0.5), active: cue("Abilities\\Spells\\Human\\Banish\\BanishTarget.mdx", "hand", 0.5) },
  },
  [Character.murloc]: {
    neutral: { spell: "Ensnare", startup: MURGUL, active: cue("Abilities\\Spells\\Orc\\Ensnare\\EnsnareTarget.mdx", "hand", 0.75) },
    side: { spell: "Tidal Rush", startup: MURGUL, active: timed(cue("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", "feet", 1.0), "birth", 0.0) },
    up: { spell: "Tide Spout", startup: MURGUL, active: timed(cue("Objects\\Spawnmodels\\Naga\\NagaDeath\\NagaDeath.mdx", "feet", 1.0), "birth", 0.0) },
    down: { spell: "Disease Cloud", startup: MURGUL, active: cue(MURLOC_SWAMP_MIST_MODEL, "feet", 0.75) },
  },
  [Character.medivh]: {
    neutral: { spell: "Arcane Omen", startup: ARCANE, active: cue("Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl", "hand", 0.5) },
    side: { spell: "Vanishing Act", startup: ARCANE, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkTarget.mdx", "body", 0.75) },
    up: { spell: "Raven Flight", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\Polymorph\\PolyMorphDoneGround.mdx", "body", 0.75) },
    down: { spell: "Last Word", startup: ARCANE, active: cue("Abilities\\Spells\\Human\\Invisibility\\InvisibilityTarget.mdx", "body", 0.75) },
  },
  [Character.archimonde]: {
    neutral: { spell: "Finger of Death", startup: FINGER_GLOW, active: cue("Abilities\\Spells\\Human\\ManaFlare\\ManaFlareTarget.mdx", "hand", f32(0.5)) },
    side: { spell: "Rain of Fire", startup: FEL, active: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrikeEmbers.mdx", "hand", 0.5) },
    up: { spell: "Fel Ascent", startup: FEL, active: cue("Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx", "feet", 1.0) },
    down: { spell: "Bash", startup: FEL, active: cue("Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx", "ahead", f32(0.5)) },
  },
  [Character.butcher]: {
    neutral: { spell: "Meat Hook", startup: cue(HOOK_MODEL, "hand", f32(0.5)), active: cue(HOOK_LINK_MODEL, "hand", f32(0.5)) },
    side: { spell: "Butcher's Charge", startup: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", f32(0.3)), active: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", f32(0.45)) },
    up: { spell: "Hook Swing", startup: cue("Abilities\\Weapons\\MeatwagonMissile\\MeatwagonMissile.mdx", "hand", f32(0.5)), active: cue("Abilities\\Weapons\\MeatwagonMissile\\MeatwagonMissile.mdx", "hand", f32(0.5)) },
    down: { spell: "Rot", startup: cue("Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx", "body", f32(0.6)), active: cue("Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx", "body", f32(0.6)) },
  },
  [Character.tyrande]: {
    neutral: { spell: "Searing Arrows", startup: cue("Abilities\\Weapons\\SearingArrow\\SearingArrowMissile.mdl", "hand", f32(0.6)), active: cue("Abilities\\Weapons\\SearingArrow\\SearingArrowMissile.mdl", "hand", f32(0.6)) },
    side: { spell: "Trueshot Aura", startup: ARCANE, active: cue("Abilities\\Spells\\NightElf\\TrueshotAura\\TrueshotAura.mdx", "feet", f32(0.8)) },
    up: { spell: "Moonlight Leap", startup: ARCANE, active: cue("Abilities\\Spells\\NightElf\\Starfall\\StarfallCaster.mdx", "feet", f32(0.6)) },
    down: { spell: "Elune's Grace", startup: ARCANE, active: cue("Abilities\\Spells\\Items\\SpellShieldAmulet\\SpellShieldCaster.mdx", "ahead", f32(1.4)) },
  },
  [Character.grom]: {
    neutral: { spell: "Warsong Cry", startup: BLOODLUST, active: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", 0.75) },
    side: { spell: "Gorehowl Rush", startup: BLOODLUST, active: BLOODLUST },
    up: { spell: "Blood Leap", startup: BLOODLUST, active: { ...BEAST, anchor: "body" } },
    down: { spell: "Mannoroth's Bane", startup: BLOODLUST, active: { ...VOODOO, anchor: "ahead" } },
  },
  [Character.ladyVashj]: {
    neutral: { spell: "Multi-Shot", startup: cue("Abilities\\Spells\\Other\\FrostArrows\\NagaColdArrowMissile.mdl", "hand", f32(0.6)), active: cue("Abilities\\Spells\\Other\\FrostArrows\\NagaColdArrowMissile.mdl", "hand", f32(0.6)) },
    side: { spell: "Tidal Serpent", startup: cue("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", "hand", f32(0.4)), active: cue("Abilities\\Weapons\\SerpentWardMissile\\SerpentWardMissile.mdl", "hand", f32(0.6)) },
    up: { spell: "Tidal Surge", startup: cue("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", "feet", f32(0.6)), active: timed(cue("Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveDamage.mdx", "feet", 1.0), "birth", 0.0) },
    down: { spell: "Mana Shield", startup: cue("Abilities\\Spells\\Human\\ManaShield\\ManaShieldCaster.mdl", "body", f32(0.8)), active: cue("Abilities\\Spells\\Human\\ManaShield\\ManaShieldCaster.mdl", "body", f32(0.8)) },
  },
  [Character.blademaster]: {
    neutral: QUICKDRAW_STANCE_CUES,
    side: { spell: "Mirror Image", startup: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "body", 1.0), active: cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageDeathCaster.mdx", "body", 1.0) },
    up: { spell: "Rising Whirlwind", startup: WIND_GATHER, active: cue("Abilities\\Spells\\NightElf\\Cyclone\\CycloneTarget.mdx", "body", f32(0.6)) },
    down: { spell: "Wind Walk", startup: WIND_WALK, active: WIND_WALK, body: WIND_WALK_BODY },
  },
  [Character.mountainKing]: {
    neutral: { spell: "Storm Bolt", startup: STORM, active: cue("Abilities\\Spells\\Other\\ForkedLightning\\ForkedLightningTarget.mdx", "hand", f32(0.8)) },
    side: { spell: "Storm Rush", startup: cue("Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx", "body", f32(0.8)), active: cue("Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx", "feet", f32(0.8)) },
    up: { spell: "Thunder Leap", startup: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", "feet", 0.5), active: cue("Abilities\\Spells\\Orc\\LightningShield\\LightningShieldTarget.mdx", "body", f32(0.8)) },
    down: { spell: "Thunder Clap", startup: STORM, active: THUNDER_CLAP_CUE },
  },
  [Character.warden]: {
    neutral: { spell: "Shadow Strike", startup: cue("Abilities\\Spells\\NightElf\\ShadowStrike\\ShadowStrike.mdx", "hand", f32(0.7)), active: timed(cue("Abilities\\Weapons\\PoisonSting\\PoisonStingTarget.mdx", "hand", 1.0), "stand", 0.0) },
    side: { spell: "Shadow Dash", startup: SHADOW_DASH_TELL, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx", "body", f32(0.6)) },
    up: { spell: "Blink", startup: SHADOW, active: cue("Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx", "body", f32(0.6)) },
    down: { spell: "Fan of Knives", startup: SHADOW, active: { ...cue("Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesCaster.mdx", "body", f32(0.6)), roll: f32(1.570796327), lingerFrames: ACTIVE_CUE_FRAMES } },
  },
  [Character.lich]: {
    neutral: { spell: "Frost Nova", startup: FROST, active: timed(cue("Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx", "hand", 0.5), "stand", 0.0) },
    side: { spell: "Death and Decay", startup: cue("Abilities\\Spells\\Undead\\PlagueCloud\\PlagueCloudCaster.mdx", "hand", f32(0.6)), active: cue("Abilities\\Spells\\Undead\\AnimateDead\\AnimateDeadTarget.mdx", "hand", f32(0.7)) },
    up: { spell: "Spectral Ascent", startup: FROST, active: cue("Abilities\\Spells\\Undead\\Unsummon\\UnsummonTarget.mdx", "body", f32(0.7)) },
    down: { spell: "Frost Armor", startup: timed(cue(FROST_ARMOR_SHELL_MODEL, "body", 1.0), "birth", 0.0), active: timed(cue("Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorDamage.mdx", "body", f32(1.2)), "birth", 0.0) },
  },
  [Character.uther]: {
    neutral: { spell: "Holy Light", startup: timed(cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", f32(0.3)), "birth", 0.0), active: cue("Abilities\\Spells\\Human\\Heal\\HealTarget.mdx", "ahead", f32(0.7)) },
    side: { spell: "Devotion Aura", startup: cue("Abilities\\Spells\\Human\\DevotionAura\\DevotionAura.mdx", "feet", f32(1.6)), active: cue("Abilities\\Spells\\Human\\DevotionAura\\DevotionAura.mdx", "feet", f32(1.6)) },
    up: { spell: "Hammer of the Righteous", startup: timed(cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", f32(0.4)), "birth", 0.0), active: cue("Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx", "hand", f32(0.6)) },
    down: { spell: "Divine Shield", startup: cue("Abilities\\Spells\\Human\\DivineShield\\DivineShieldTarget.mdx", "body", f32(1.0)), active: cue("Abilities\\Spells\\Human\\DivineShield\\DivineShieldTarget.mdx", "body", f32(1.0)) },
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
    neutral: { spell: "Howl of Terror", startup: HOWL_INHALE, active: HOWL_ROAR },
    side: { spell: "Ruin Charge", startup: FEL, active: timed(cue(IMPACT_DUST_MODEL, "feet", f32(0.8)), "stand", 0.0) },
    up: { spell: "Abyssal Leap", startup: FEL, active: timed(cue("Abilities\\Spells\\Other\\Doom\\DoomDeath.mdx", "feet", f32(0.42)), "birth", f32(0.2)) },
    down: { spell: "Rain of Fire", startup: FEL, active: cue("Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", "overhead", f32(0.45)) },
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


export const EYE_BEAM_EYES: Cue = { model: "Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", anchor: "overhead", scale: f32(0.9), sequence: "stand", seconds: 0.0 };
const FEL_FLAMES = "Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx";


export const ORIGINAL_CUES: { readonly [action: number]: MoveCues } = {
  [SpecialAction.riflemanBlaster]: { spell: "Blaster", startup: drawn(RIFLEMAN_MODEL_FILE, "barrel"), active: cue("Abilities\\Weapons\\GyroCopter\\GyroCopterImpact.mdx", "barrel", 0.5) },
  [SpecialAction.riflemanBear]: { spell: "Summon Bear", startup: cue("Abilities\\Spells\\NightElf\\BattleRoar\\RoarTarget.mdx", "body", f32(0.7)), active: cue("Abilities\\Spells\\Orc\\FeralSpirit\\FeralSpiritTarget.mdx", "ahead", f32(0.8)) },
  [SpecialAction.riflemanRecovery]: { spell: "Recoil Shot", startup: cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), active: timed(cue("Abilities\\Weapons\\Mortar\\MortarMissile.mdx", "feet", f32(0.4)), "death", 0.0) },
  [SpecialAction.riflemanTrap]: { spell: "Frost Trap", startup: FROST_TRAP, active: FROST_TRAP },
  [SpecialAction.demonHunterEyeBeam]: { spell: "Eye Beam", startup: EYE_BEAM_EYES, active: { ...EYE_BEAM_EYES, scale: f32(1.3) } },

  [SpecialAction.demonHunterFelRush]: { spell: "Fel Rush", startup: FEL_TELL, active: timed(cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", "body", 1.0), "stand", 0.0) },
  [SpecialAction.demonHunterWingAscent]: { spell: "Metamorphosis wings", startup: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0), active: cue("Abilities\\Spells\\NightElf\\Immolation\\ImmolationDamage.mdx", "feet", 1.0) },
  [SpecialAction.demonHunterImmolate]: { spell: "Immolation", startup: drawn(FEL_FLAMES, "body"), active: drawn(FEL_FLAMES, "body") },
};


// Cue absence uses "none" because Lua drops null array entries.




export type BranchCue = MoveCues | "slot" | "none";


export interface HeroBranchCues {
  readonly recall?: BranchCue | undefined;
  readonly followUps?: readonly BranchCue[] | undefined;
}

const branch = (spell: string, startup: Cue, active: Cue): MoveCues => ({ spell, startup, active });
// A flat stomp ring read as a streak ahead of him on every dive line (#577), so the dive trails lightning instead, and the glow sits on his body because the hammer in his hand leads the dive.
const HAMMERFALL_GLOW = cue("Abilities\\Weapons\\Bolt\\BoltImpact.mdx", "body", f32(0.8));
const HAMMERFALL_CUES: MoveCues = { ...branch("Hammerfall", HAMMERFALL_GLOW, HAMMERFALL_GLOW), trail: true };


export const HERO_BRANCH_CUES: { readonly [character: number]: { readonly [slot in SpecialSlot]?: HeroBranchCues } } = {
  [Character.malfurion]: { down: { recall: "slot" } },
  [Character.jaina]: {
    down: { recall: branch("Recall Water Elemental", ARCANE, cue("Abilities\\Spells\\Human\\MassTeleport\\MassTeleportCaster.mdx", "body", 0.5)) },
  },
  [Character.chen]: {
    side: { followUps: [branch("Body Slam", BEAST, cue(IMPACT_DUST_MODEL, "ahead", f32(0.4)))] },
    down: { followUps: [0, 1, 2, 3].map(() => branch("Keg Toss", BREW, cue("Abilities\\Spells\\Other\\StrongDrink\\BrewmasterTarget.mdx", "ahead", f32(0.6)))) },
  },
  [Character.tinker]: { side: { recall: "slot" } },
  [Character.blademaster]: {
    neutral: { followUps: QUICKDRAW_DRAW_CUES },
    side: { recall: branch("Image Swap", cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageCaster.mdx", "body", 1.0), cue("Abilities\\Spells\\Orc\\MirrorImage\\MirrorImageMissile.mdx", "body", 1.0)) },
    down: { followUps: [branch("Wind Walk Kick", WIND_WALK_COUNTER, WIND_WALK_COUNTER)] },
  },
  [Character.mountainKing]: {
    up: { followUps: [HAMMERFALL_CUES, HAMMERFALL_CUES, HAMMERFALL_CUES, HAMMERFALL_CUES, HAMMERFALL_CUES] },

    down: { followUps: [branch("Small Clap", STORM, { ...cue("Abilities\\Spells\\Orc\\EarthQuake\\EarthquakeTarget.mdx", "feet", f32(0.255)), sound: "ThunderClap" }), "slot", "none"] },
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


export const ORIGINAL_BRANCH_CUES: { readonly [action: number]: { readonly [form: number]: OriginalBranch } } = {
  [SpecialAction.demonHunterWingAscent]: {
    [DEMONHUNTER_BACKFLIP_FORM]: { cues: branch("Backflip", FEL_TELL, timed(cue("Abilities\\Spells\\Undead\\Possession\\PossessionMissile.mdx", "body", 1.0), "stand", 0.0)), first: 1, last: DEMONHUNTER_BACKFLIP_FRAMES },
    [DEMONHUNTER_DIVE_FORM]: { cues: branch("Wing dive", FEL_TELL, cue(FEL_FLAMES, "body", f32(0.8))), first: 1, last: DEMONHUNTER_DIVE_FRAMES - 1 },
  },
  [SpecialAction.riflemanRecovery]: {
    [RIFLEMAN_SECOND_SHOT_FORM]: { cues: branch("Second recoil shot", cue("Abilities\\Spells\\Human\\FlakCannons\\FlakTarget.mdx", "feet", f32(0.8)), cue("Abilities\\Weapons\\SteamTank\\SteamTankImpact.mdx", "feet", f32(0.8))), first: RIFLEMAN_SECOND_SHOT_FIRST, last: RIFLEMAN_SECOND_SHOT_LAST },
  },
};


function originalActiveFrame(action: number, grounded: boolean): number {
  switch (action) {
    case SpecialAction.riflemanBlaster: return grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    case SpecialAction.riflemanBear: return RIFLEMAN_BEAR_CAST_FRAMES;
    case SpecialAction.riflemanRecovery: return RIFLEMAN_RECOVERY_STARTUP_FRAMES;
    case SpecialAction.riflemanTrap: return 2;
    case SpecialAction.demonHunterEyeBeam: return eyeBeamShotFrameWhen(grounded);
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
  const peon = fighter.character === Character.peon ? peonCueState(fighter, PEON_REST_CUES) : undefined;
  if (peon !== undefined) return peon;
  if (fighter.character === Character.dreadlord && action === SpecialAction.heroSide && fighter.special.grabFrame > 0) {
    return commandGrabHolding(fighter, runningHeroSpecial(fighter)) ? { cues: DREADLORD_BITE_CUES, phase: "active" } : NONE;
  }
  if (fighter.character === Character.kaelthas && action === SpecialAction.heroUp && fighter.special.form < FOLLOW_UP_FORM) {
    if (frame > PHOENIX_STARTUP_FRAMES && frame <= PHOENIX_STARTUP_FRAMES + PHOENIX_BURN_FRAMES) return { cues: KAEL_PHOENIX_FORM, phase: "active" };
    return frame <= PHOENIX_STARTUP_FRAMES ? { cues: KAEL_PHOENIX_CHARGE, phase: "startup" } : NONE;
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
  [Character.demonHunter]: [SpecialAction.demonHunterEyeBeam, SpecialAction.demonHunterFelRush, SpecialAction.demonHunterWingAscent, SpecialAction.demonHunterImmolate],
};


export function fighterMoveCues(character: Character): readonly MoveCues[] {
  const hero = HERO_CUES[character];
  if (hero !== undefined) return SPECIAL_SLOTS.map((slot) => hero[slot]);
  return (ORIGINAL_ACTIONS[character] ?? []).flatMap((action) => ORIGINAL_CUES[action] ?? []);
}


export function fighterCueList(character: Character): readonly Cue[] {
  return [...fighterMoveCues(character), ...fighterBranchCues(character), ...(character === Character.dreadlord ? [DREADLORD_BITE_CUES] : []), ...(character === Character.kaelthas ? [KAEL_PHOENIX_FORM] : []), ...(character === Character.sylvanas ? [BANSHEE_FORM] : []), ...peonExtraCues(character)].flatMap((cues) => [cues.startup, cues.active]);
}


export function fighterBranchCues(character: Character): readonly MoveCues[] {
  const out: MoveCues[] = [];
  const add = (cue: BranchCue | undefined): void => {
    if (cue !== undefined && cue !== "none" && cue !== "slot" && !out.includes(cue)) out.push(cue);
  };
  for (const slot of SPECIAL_SLOTS) {
    const branches = HERO_BRANCH_CUES[character]?.[slot];
    add(branches?.recall);
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
  return undefined;
}


function branchWindows(branch: Readonly<OriginalBranch>): CueWindows {
  return { startup: { first: 1, last: Math.max(1, branch.first - 1) }, active: { first: branch.first, last: Math.max(branch.last, branch.first + ACTIVE_CUE_FRAMES - 1) } };
}
