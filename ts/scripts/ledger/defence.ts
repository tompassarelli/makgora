import { resolve } from "node:path";
import { FIGHTCORE_URL, type FightCoreRow, readFightCore } from "../../../references/melee-frame-data/fightcore";
import { Action } from "../../src/game/input/actions";
import { fighter, frame, scene, solo } from "../../src/game/match/padScene";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../../src/game/sim/codes";
import {
  DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN, DOWN_ATTACK_INTANGIBLE_FRAMES_UP, DOWN_RECOVERY_INTANGIBLE_FRAMES, DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN,
  DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP, TECH_INTANGIBLE_FRAMES, TECH_ROLL_INTANGIBLE_FRAMES, WALL_TECH_STARTUP_FRAMES,
} from "../../src/game/sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_RESET_THRESHOLD, DOWN_ROLL_FRAMES, DOWN_STAND_FRAMES, DOWN_WAIT_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../../src/game/sim/down";
import { SHIELD_MAX } from "../../src/game/sim/fighter";
import { TECH_REPEAT_MINIMUM_AGE_FRAMES, TECH_WINDOW_FRAMES } from "../../src/game/sim/geometry/techInput";
import { damageLevelForKnockback } from "../../src/game/sim/knockback";
import { MASH_FRAMES } from "../../src/game/sim/mash";
import {
  DOWN_ATTACK_FRAMES, GRAB_HOLD_MINIMUM_FRAMES, GRAB_RELEASE_STUN_FRAMES, PUMMEL_DAMAGE,
  attackDurationFramesForGrounding, attackStartupFrames, characterAttackActiveFrames, grabHoldFrames,
} from "../../src/game/sim/moves";
import {
  SHIELD_BREAK_RESTORED_ENERGY, SHIELD_REGEN_PER_FRAME, SHIELD_RELEASE_LAG_FRAMES, digitalShieldstunFrames, shieldContactPushbackMelee, shieldDrain,
  shieldSizeMultiplier,
} from "../../src/game/sim/shield";
import { SURFACE_REFLECT_ATTENUATION, SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES } from "../../src/game/sim/surfaces";
import { AUTHORED_TECH_TIMING } from "../../src/game/sim/tuning";
import { type LedgerRow, PARITY, type Value, probe, range, shortNumber } from "./row";

const wiki = (page: string): string => `https://www.ssbwiki.com/${page}`;
const DOWN = "ts/src/game/sim/down.ts";
const CONDITIONS = "ts/src/game/sim/conditions.ts";
const SHIELD = "ts/src/game/sim/shield.ts";
const MOVES = "ts/src/game/sim/moves.ts";
const GRABS = "ts/src/game/sim/grabs.ts";
const ROOT = resolve(import.meta.dir, "../../..");
const DAMAGE = range(1, 50);
const PERCENT = range(0, 300);

const SHARED_PROFILE = { kind: "open", reason: "one shared profile for every fighter against Melee's per-fighter values", issue: 293 } as const;
const NO_SOURCE = { kind: "open", reason: "ours; no public source gives Melee's value", issue: 293 } as const;

const FIGHT_CORE: readonly FightCoreRow[] = readFightCore(ROOT);

function fightCoreFrames(moves: readonly string[]): Value {
  const totals = new Map<string, number[]>();
  for (const row of FIGHT_CORE) {
    if (row.section !== "Getups/Techs" && row.section !== "Grab/Throw") continue;
    if (!moves.includes(row.move) || row.totalFrames === null) continue;
    totals.set(row.character, [...(totals.get(row.character) ?? []), row.totalFrames]);
  }
  const all = [...totals.values()].flat();
  const fox = totals.get("Fox")?.[0];
  if (fox === undefined) throw new Error(`fightcore.csv has no Fox ${moves.join(" or ")} row`);
  const least = Math.min(...all), most = Math.max(...all);
  if (least === most) return least;
  const others = [...totals].filter(([, frames]) => frames.some((total) => total !== fox)).map(([character]) => character);
  const which = others.length <= 6 ? `: ${others.join(", ")}` : "";
  return `Fox ${fox}; ${others.length} of ${totals.size} fighters differ${which}; ${least}-${most}`;
}

const meleeShieldstun = (damage: number, perDamage: number): number => Math.floor(((perDamage * damage + 2) * 200) / 201);

const MELEE_TECH_INTANGIBILITY = "the roll as long as in place; no public frame count";

const techIntangibility = (inPlace: number, roll: number): string => (inPlace === roll ? MELEE_TECH_INTANGIBILITY : `in place 1-${inPlace}, roll 1-${roll}`);

const tumbleKnockback = (): number => range(0, 200).find((knockback) => damageLevelForKnockback(knockback) === 3) ?? Number.NaN;

function outOfShield(): string {
  const options: string[] = [];
  const jump = solo(0, Character.rifleman);
  for (let n = 1; n <= 10; n++) frame(jump, [Action.rightTrigger]);
  frame(jump, [Action.rightTrigger, Action.jump]);
  if (fighter(jump, 0).jump.squat > 0) options.push("jump");
  const grab = solo(0, Character.rifleman);
  for (let n = 1; n <= 10; n++) frame(grab, [Action.rightTrigger]);
  frame(grab, [Action.rightTrigger, Action.grab]);
  if (fighter(grab, 0).attack.style === AttackStyle.grab) options.push("grab");
  return options.length === 0 ? "none" : options.join(" and ");
}

function upSpecialOutOfShield(): string {
  const s = solo(0, Character.rifleman);
  const f = fighter(s, 0);
  for (let n = 1; n <= 10; n++) frame(s, [Action.rightTrigger]);
  frame(s, [Action.rightTrigger, Action.jump]);
  frame(s, [Action.jump, Action.special, Action.moveUp]);
  if (f.special.action !== SpecialAction.none) return "from jump squat";
  for (let n = 1; n <= 10 && f.motion.grounded; n++) frame(s, [Action.jump]);
  frame(s, [Action.moveUp]);
  frame(s, [Action.special, Action.moveUp]);
  return f.special.action !== SpecialAction.none ? "only after takeoff: an up special pressed in jump squat is dropped" : "not out of shield";
}

function pummels(): string {
  const s = scene(0, [{ character: Character.rifleman, x: 0.0, facing: 1 }, { character: Character.rifleman, x: 40.0, facing: -1 }]);
  frame(s, [Action.grab]);
  for (let n = 1; n <= 30 && fighter(s, 0).grab.action !== GrabAction.hold; n++) frame(s, []);
  if (fighter(s, 0).grab.action !== GrabAction.hold) throw new Error("the probe grab never reached its hold");
  for (let n = 0; n < 40; n++) frame(s, n % 2 === 0 ? [Action.attack] : []);
  const count = fighter(s, 0).grab.pummels;
  return count > 1 ? `repeatable, ${shortNumber(PUMMEL_DAMAGE)}%` : `${count} a grab, ${shortNumber(PUMMEL_DAMAGE)}%`;
}

export const DEFENCE_ROWS: readonly LedgerRow[] = [
  {
    id: "tech-window", family: "defence", name: "Tech window (frames before landing a press still techs)",
    melee: { value: 20, source: wiki("Tech") }, ours: () => TECH_WINDOW_FRAMES,
    anchor: { file: "ts/src/game/sim/geometry/techInput.ts", symbol: "TECH_WINDOW_FRAMES" }, status: PARITY,
  },
  {
    id: "tech-lockout", family: "defence", name: "Tech lockout after a press",
    melee: { value: 40, source: wiki("Tech") }, ours: () => TECH_REPEAT_MINIMUM_AGE_FRAMES,
    anchor: { file: "ts/src/game/sim/geometry/techInput.ts", symbol: "TECH_REPEAT_MINIMUM_AGE_FRAMES" }, status: PARITY,
  },
  {
    id: "tech-in-place-frames", family: "defence", name: "Tech in place, total frames, every fighter in fightcore.csv",
    melee: { value: fightCoreFrames(["Tech-Neutral"]), source: FIGHTCORE_URL }, ours: () => TECH_IN_PLACE_FRAMES,
    anchor: { file: DOWN, symbol: "TECH_IN_PLACE_FRAMES" }, status: PARITY,
  },
  {
    id: "tech-roll-frames", family: "defence", name: "Tech roll, total frames, every fighter in fightcore.csv",
    melee: { value: fightCoreFrames(["Tech-Roll Forward", "Tech-Roll Backward"]), source: FIGHTCORE_URL }, ours: () => TECH_ROLL_FRAMES,
    anchor: { file: DOWN, symbol: "TECH_ROLL_FRAMES" }, status: PARITY,
  },
  {
    id: "tech-intangibility", family: "defence", name: "Tech intangibility, in place and roll",
    melee: { value: MELEE_TECH_INTANGIBILITY, source: wiki("Tech") },
    ours: () => techIntangibility(TECH_INTANGIBLE_FRAMES, TECH_ROLL_INTANGIBLE_FRAMES),
    anchor: { file: CONDITIONS, symbol: "TECH_ROLL_INTANGIBLE_FRAMES" }, status: PARITY,
  },
  {
    id: "missed-tech-bound", family: "defence", name: "Missed tech: frames bouncing on the floor (DownBound)",
    melee: { undocumented: "fightcore.csv's Getups/Techs rows and SmashWiki's Tech page give no DownBound length", source: wiki("Tech") }, ours: () => DOWN_BOUND_FRAMES,
    anchor: { file: DOWN, symbol: "DOWN_BOUND_FRAMES" }, status: NO_SOURCE,
  },
  {
    id: "floor-rebound", family: "defence", name: "Missed tech into the floor at speed",
    melee: { value: "the fall stops", source: wiki("Meteor_smash") }, ours: () => `rebounds ×${shortNumber(SURFACE_REFLECT_ATTENUATION)}, as off walls`,
    anchor: { file: "ts/src/game/sim/surfaces.ts", symbol: "SURFACE_REFLECT_ATTENUATION" },
    status: { kind: "deviation", reason: "a missed tech keeps its momentum, so a hard spike can carry off the top (docs/physics.md, Floor bounces)", decided: "2026-10-15", elsewhere: "Smash 4 and Ultimate: floors no longer halt knockback momentum; a missed tech rebounds like a stage spike, so a meteor can KO off the top ([SmashWiki](https://www.ssbwiki.com/Floor))" },
  },
  {
    id: "down-wait", family: "defence", name: "Frames lying down before standing by itself",
    melee: { undocumented: "not on SmashWiki", source: wiki("Lock") }, ours: () => DOWN_WAIT_FRAMES,
    anchor: { file: DOWN, symbol: "DOWN_WAIT_FRAMES" }, status: NO_SOURCE,
  },
  {
    id: "jab-reset", family: "defence", name: "Jab reset: a hit on a lying fighter that forces a getup",
    melee: { value: "at most 7% and under 80 knockback", source: wiki("Lock") },
    ours: () => `at most ${shortNumber(DOWN_DAMAGE_RESET_THRESHOLD)}% and under ${tumbleKnockback()} knockback`,
    anchor: { file: DOWN, symbol: "DOWN_DAMAGE_RESET_THRESHOLD" }, status: PARITY,
  },
  {
    id: "getup-stand", family: "defence", name: "Neutral getup, frames vulnerable after standing",
    melee: { value: 30, source: wiki("Lock") }, ours: () => DOWN_STAND_FRAMES,
    anchor: { file: DOWN, symbol: "DOWN_STAND_FRAMES" }, status: PARITY,
  },
  {
    id: "getup-roll", family: "defence", name: "Getup roll, total frames, fightcore.csv",
    melee: { value: fightCoreFrames(["Getup-Roll Forward (Back)", "Getup-Roll Forward (Stomach)", "Getup-Roll Backward (Back)", "Getup-Roll Backward (Stomach)"]), source: FIGHTCORE_URL }, ours: () => DOWN_ROLL_FRAMES,
    anchor: { file: DOWN, symbol: "DOWN_ROLL_FRAMES" }, status: SHARED_PROFILE,
  },
  {
    id: "getup-attack", family: "defence", name: "Getup attack, total frames (ours starts its hit on frame 16), fightcore.csv",
    melee: { value: fightCoreFrames(["Getup-Attack (Back)", "Getup-Attack (Stomach)"]), source: FIGHTCORE_URL }, ours: () => DOWN_ATTACK_FRAMES,
    anchor: { file: MOVES, symbol: "DOWN_ATTACK_FRAMES" }, status: SHARED_PROFILE,
  },
  {
    id: "getup-intangibility", family: "defence", name: "Getup intangibility: stand, roll and attack, face up/face down",
    melee: { undocumented: "neither fightcore.csv nor SmashWiki gives getup intangibility", source: FIGHTCORE_URL },
    ours: () => `stand 1-${DOWN_RECOVERY_INTANGIBLE_FRAMES}; roll 1-${DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP}/1-${DOWN_ROLL_INTANGIBLE_FRAMES_BACK_DOWN}; attack 1-${DOWN_ATTACK_INTANGIBLE_FRAMES_UP}/1-${DOWN_ATTACK_INTANGIBLE_FRAMES_DOWN}`,
    anchor: { file: CONDITIONS, symbol: "DOWN_ROLL_INTANGIBLE_FRAMES_BACK_UP" }, status: NO_SOURCE,
  },
  {
    id: "wall-tech-jump-frames", family: "defence", name: "Wall tech jump, total frames, fightcore.csv",
    melee: { value: fightCoreFrames(["Tech-Wall Jump"]), source: FIGHTCORE_URL }, ours: () => AUTHORED_TECH_TIMING.wallJumpAnimationEndFrame,
    anchor: { file: "ts/src/game/sim/tuning.ts", symbol: "AUTHORED_TECH_TIMING" }, status: PARITY,
  },
  {
    id: "wall-tech-frames", family: "defence", name: "Wall tech, total frames, fightcore.csv",
    melee: { value: fightCoreFrames(["Tech-Wall"]), source: FIGHTCORE_URL }, ours: () => AUTHORED_TECH_TIMING.wallAnimationEndFrame,
    anchor: { file: "ts/src/game/sim/tuning.ts", symbol: "AUTHORED_TECH_TIMING" },
    status: { kind: "open", reason: "ours ends the wall tech on frame 26, short of fightcore.csv's Tech-Wall total", issue: 293 },
  },
  {
    id: "wall-tech-intangibility", family: "defence", name: "Wall and ceiling tech: hang and intangibility",
    melee: { undocumented: "SmashWiki's Tech page: a few intangible frames, with no count", source: wiki("Tech") },
    ours: () => `${WALL_TECH_STARTUP_FRAMES}-frame hang, intangible ${SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES}; ceiling impulse frame ${AUTHORED_TECH_TIMING.ceilingImpulseFrame}`,
    anchor: { file: "ts/src/game/sim/surfaces.ts", symbol: "SURFACE_TECH_WALL_COLLISION_GRACE_FRAMES" }, status: NO_SOURCE,
  },
  {
    id: "shieldstun-ground", family: "defence", name: "Shieldstun from a ground attack on a full shield, probed at damage 1-50",
    melee: { value: "⌊(0.45d + 2)·200/201⌋", source: wiki("Shield") },
    ours: probe({ text: "⌊(0.45d + 2)·200/201⌋", inputs: DAMAGE, label: (damage) => `damage ${damage}`, ours: (damage) => digitalShieldstunFrames(damage), melee: (damage) => meleeShieldstun(damage, 0.45) }),
    anchor: { file: SHIELD, symbol: "shieldstunFrames" }, status: PARITY,
  },
  {
    id: "shieldstun-aerial", family: "defence", name: "Shieldstun from an aerial on a full shield, probed at damage 1-50",
    melee: { value: "⌊(0.45d + 2)·200/201⌋", source: wiki("Shield") },
    ours: probe({ text: "⌊(0.6d + 2)·200/201⌋", inputs: DAMAGE, label: (damage) => `damage ${damage}`, ours: (damage) => digitalShieldstunFrames(damage, true), melee: (damage) => meleeShieldstun(damage, 0.6) }),
    anchor: { file: SHIELD, symbol: "shieldstunFrames" },
    status: { kind: "deviation", reason: "aerials take a third more shieldstun per damage, tilting slightly toward aggression (docs/gameplay-design.md, Aerials on shield)", decided: "2026-10-06", issue: 106, elsewhere: "Ultimate: ⌊0.8 × damage × 0.33 + 2⌋ for aerials, 0.264 a damage, with shield hitlag × 0.67 ([SmashWiki](https://www.ssbwiki.com/Shieldstun), [hitlag](https://www.ssbwiki.com/Hitlag)). Rivals 2: 0.8 × damage + 1 for every attack, and the input buffer drops to 2 frames after a shield contact ([Dragdown](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense))" },
  },
  {
    id: "shield-health", family: "defence", name: "Shield health",
    melee: { value: 60, source: wiki("Shield") }, ours: () => SHIELD_MAX,
    anchor: { file: "ts/src/game/sim/fighter.ts", symbol: "SHIELD_MAX" }, status: PARITY,
  },
  {
    id: "shield-drain", family: "defence", name: "Shield drain a frame, full press",
    melee: { value: 0.28, source: wiki("Shield") }, ours: () => shieldDrain(1.0),
    anchor: { file: SHIELD, symbol: "shieldDrain" }, status: PARITY,
  },
  {
    id: "shield-regen", family: "defence", name: "Shield regeneration a frame",
    melee: { value: 0.07, source: wiki("Shield") }, ours: () => SHIELD_REGEN_PER_FRAME,
    anchor: { file: SHIELD, symbol: "SHIELD_REGEN_PER_FRAME" }, status: PARITY,
  },
  {
    id: "shield-break-restore", family: "defence", name: "Shield health after a break",
    melee: { value: 30, source: wiki("Shield") }, ours: () => SHIELD_BREAK_RESTORED_ENERGY,
    anchor: { file: SHIELD, symbol: "SHIELD_BREAK_RESTORED_ENERGY" }, status: PARITY,
  },
  {
    id: "shield-size", family: "defence", name: "Shield size, full press, probed at health 0-60",
    melee: { value: "0.85·(h·0.5/60) + 0.15", source: wiki("Shield") },
    ours: probe({
      text: "0.85·(h·0.5/60) + 0.15", inputs: range(0, 60), label: (health) => `health ${health}`,
      ours: (health) => shieldSizeMultiplier(health, 1.0), melee: (health) => ((health * 0.5) / 60) * 0.85 + 0.15,
      close: (ours, melee) => Math.abs(ours - melee) <= 1e-6,
    }),
    anchor: { file: SHIELD, symbol: "shieldSizeMultiplier" }, status: PARITY,
  },
  {
    id: "shield-pushback", family: "defence", name: "Defender's shield pushback, full press, probed at damage 1-50",
    melee: { value: "min(2, (0.09d + 0.4)·0.6)", source: wiki("Shield") },
    ours: probe({
      text: "min(2, (0.09d + 0.4)·0.6)", inputs: DAMAGE, label: (damage) => `damage ${damage}`,
      ours: (damage) => shieldContactPushbackMelee(damage, 1.0, false), melee: (damage) => Math.min(2, (0.09 * damage + 0.4) * 0.6),
      close: (ours, melee) => Math.abs(ours - melee) <= 1e-5,
    }),
    anchor: { file: SHIELD, symbol: "shieldContactPushbackMelee" }, status: PARITY,
  },
  {
    id: "shield-release", family: "defence", name: "Shield release lag",
    melee: { value: 15, source: wiki("Shield") }, ours: () => SHIELD_RELEASE_LAG_FRAMES,
    anchor: { file: SHIELD, symbol: "SHIELD_RELEASE_LAG_FRAMES" },
    status: { kind: "deviation", reason: "Melee's 15 makes dropping shield almost never worth it; Ultimate's 11, the starting point, makes it a real option beside jumping or rolling out (docs/gameplay-design.md, Principles)", decided: "2026-10-06", issue: 100, elsewhere: "Ultimate: 11 frames" },
  },
  {
    id: "powershield", family: "defence", name: "Powershield",
    melee: { value: "first 4 frames of shield on a hit: no shield damage, more pushback, same shieldstun; first 2 reflect projectiles", source: wiki("Powershield") },
    ours: () => "a parry: no shield damage, no shieldstun, no release lag",
    anchor: { file: SHIELD, symbol: "grantParry" },
    status: { kind: "deviation", reason: "a true parry whose reward is the defender's own punish (docs/gameplay-design.md, Powershield and parry)", decided: "2026-10-06", issue: 102, elsewhere: "Ultimate: release-timed in the first 5 frames of the 11-frame shield drop; any attack skips the drop lag and acts 3 frames sooner than a block against direct hits; no reflection ([SmashWiki](https://www.ssbwiki.com/Perfect_shield)). Rivals 2: a 4-frame perfect shield plus a separate parry, active 6–13, that stuns the attacker 40–100 frames ([Dragdown](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense))" },
  },
  {
    id: "platform-shield-drop", family: "defence", name: "Shield drop through a platform",
    melee: { value: "down while shielding drops through", source: wiki("Shield_dropping") }, ours: () => "none: a raised shield stays on the platform",
    anchor: { file: "ts/src/game/sim/platformMoves.ts", symbol: "dropFromPlatform" },
    status: { kind: "deviation", reason: "shielded fighters keep their jump, dodge or release choices (docs/gameplay-design.md, Platform shield drop)", decided: "2026-10-14", issue: 103, elsewhere: "Removed in Ultimate; Project+ keeps it" },
  },
  {
    id: "out-of-shield", family: "defence", name: "Jump and grab out of shield, probed headless",
    melee: { value: "jump and grab", source: wiki("Out_of_shield") }, ours: outOfShield,
    anchor: { file: CONDITIONS, symbol: "canShieldGrab" }, status: PARITY,
  },
  {
    id: "up-special-out-of-shield", family: "defence", name: "Up special out of shield, probed headless",
    melee: { value: "from jump squat", source: wiki("Out_of_shield") }, ours: upSpecialOutOfShield,
    anchor: { file: CONDITIONS, symbol: "cancelsJumpSquat" },
    status: { kind: "open", reason: "Melee cancels jump squat into an up special (a jump-cancelled up special out of shield); ours cancels it only into grab and up smash", issue: 293 },
  },
  {
    id: "grab-frames", family: "defence", name: "Standing grab, total frames, fightcore.csv",
    melee: { value: fightCoreFrames(["Grab"]), source: FIGHTCORE_URL }, ours: () => `${attackDurationFramesForGrounding(AttackStyle.grab, true)}, active from ${attackStartupFrames(AttackStyle.grab)} for ${characterAttackActiveFrames(Character.rifleman, AttackStyle.grab)}, every fighter`,
    anchor: { file: MOVES, symbol: "attackStartupFrames" }, status: SHARED_PROFILE,
  },
  {
    id: "grab-hold", family: "defence", name: "Grab hold frames, probed at 0-300%",
    melee: { value: "⌊76 + 1.6p⌋", source: wiki("Grab") },
    ours: probe({ text: "⌊90 + 1.75p⌋", inputs: PERCENT, label: (percent) => `${percent}%`, ours: grabHoldFrames, melee: (percent) => Math.floor(90 + 1.75 * percent) }),
    anchor: { file: MOVES, symbol: "grabHoldFrames" },
    status: { kind: "deviation", reason: "Ultimate's hold formula with a visible escape meter (docs/gameplay-design.md, Grab holds and pummels)", decided: "2026-10-14", issue: 101, elsewhere: "Brawl onward: 90 + 1.7 frames per percent, 8 per stick mash input (14.4 per button in Smash 4 and Ultimate), never under 19 ([SmashWiki](https://www.ssbwiki.com/Grab)). Rivals 2: one pummel per grab, Attack or Special, broken when the victim presses the same button ([FAQ](https://rivals2.com/faq)); a 60-frame hold animation ([workshop](https://rivals2.com/workshop/?p=389))" },
  },
  {
    id: "grab-mash", family: "defence", name: "Hold frames each mash input removes",
    melee: { value: 6, source: wiki("Grab") }, ours: () => MASH_FRAMES,
    anchor: { file: "ts/src/game/sim/mash.ts", symbol: "MASH_FRAMES" },
    status: { kind: "deviation", reason: "Ultimate's stick mash value, with the hold formula (docs/gameplay-design.md, Grab holds and pummels)", decided: "2026-10-14" },
  },
  {
    id: "grab-hold-minimum", family: "defence", name: "Shortest grab hold",
    melee: { value: "none", source: wiki("Grab") }, ours: () => `${GRAB_HOLD_MINIMUM_FRAMES} frames`,
    anchor: { file: MOVES, symbol: "GRAB_HOLD_MINIMUM_FRAMES" },
    status: { kind: "deviation", reason: "a throw input on any of the first 59 held frames is guaranteed (docs/gameplay-design.md, Grab holds and pummels)", decided: "2026-10-14" },
  },
  {
    id: "pummel", family: "defence", name: "Pummel, probed headless: the code's repeatable pummel (2026-10-17, #81) is current; the older one-pummel text is corrected",
    melee: { value: "repeatable, 3%", source: wiki("Pummel") }, ours: pummels,
    anchor: { file: MOVES, symbol: "PUMMEL_DAMAGE" }, status: PARITY,
  },
  {
    id: "grab-release", family: "defence", name: "Grab release frames",
    melee: { undocumented: "SmashWiki's Grab page names the release but gives no frame counts", source: wiki("Grab") },
    ours: () => `victim ${GRAB_RELEASE_STUN_FRAMES} frames in release stun, grabber 10 letting go`,
    anchor: { file: MOVES, symbol: "GRAB_RELEASE_STUN_FRAMES" },
    status: { kind: "deviation", reason: "every release frees the victim 4 frames first, so no release leads to a guaranteed regrab (docs/gameplay-design.md, Grab holds and pummels)", decided: "2026-10-14" },
  },
  {
    id: "throw-knockback", family: "defence", name: "Throw knockback",
    melee: { value: "knockback hits at weight 100", source: wiki("Throw") }, ours: () => "knockback hits at the victim's weight",
    anchor: { file: GRABS, symbol: "authoredThrowEffect" },
    status: { kind: "open", reason: "ours throws with the victim's weight, so heavy fighters fly less off a throw; Melee throws every fighter as weight 100", issue: 293 },
  },
  {
    id: "throw-speed", family: "defence", name: "Throw animation speed",
    melee: { value: "some throws scale by weight/100", source: wiki("Throw") }, ours: () => "the same for every victim",
    anchor: { file: GRABS, symbol: "authoredThrowEffect" },
    status: { kind: "open", reason: "ours plays every throw at one speed", issue: 293 },
  },
  {
    id: "throw-regrab", family: "defence", name: "Regrab during a throw's hitstun",
    melee: { value: "allowed: throws chain into grabs", source: wiki("Throw") }, ours: () => "refused until the throw's hitstun ends",
    anchor: { file: CONDITIONS, symbol: "canBeGrabbed" },
    status: { kind: "deviation", reason: "removes throw-to-regrab chains while keeping throw-to-attack combos (docs/gameplay-design.md, Throw regrabs)", decided: "2026-10-06" },
  },
];
