import { resolve } from "node:path";
import { CHARACTER_ATTRIBUTES_URL, readCharacterAttributes } from "../../../references/melee-frame-data/character-attributes";
import { fighter, solo } from "../../src/game/match/padScene";
import { normalAttackStyle } from "../../src/game/input/combat";
import { AttackStyle, Character } from "../../src/game/sim/codes";
import {
  AIR_DODGE_INTANGIBLE_END, AIR_DODGE_INTANGIBLE_START, GROUND_ROLL_FRAMES, GROUND_ROLL_INTANGIBLE_END, GROUND_ROLL_INTANGIBLE_START,
  SPOT_DODGE_FRAMES, SPOT_DODGE_INTANGIBLE_END, SPOT_DODGE_INTANGIBLE_START,
} from "../../src/game/sim/conditions";
import { AIR_DODGE_LANDING_LAG, EMPTY_LANDING_LAG } from "../../src/game/sim/down";
import { restingTraction } from "../../src/game/sim/groundMovement";
import { AIR_DODGE_ANIMATION_FRAMES, AIR_DODGE_DECAY } from "../../src/game/sim/jumpsAndDodges";
import { LEDGE_HANG_LIMIT_FRAMES, LEDGE_INTANGIBLE_DECAY, ledgeIntangibleFrames, ledgeSnap } from "../../src/game/sim/ledge";
import { attackLandingLag, uncancelledLandingLag } from "../../src/game/sim/moves";
import { TILT_STICK_DOWN, TILT_STICK_UP, TILT_STICK_X } from "../../src/game/sim/stick";
import { CROUCH_STICK_THRESHOLD, DASH_STICK_THRESHOLD, STICK_DEADZONE, STICK_SMASH_DEADZONE, TAP_JUMP_STICK_THRESHOLD, WALK_MIDDLE_STICK_THRESHOLD } from "../../src/game/sim/stickZones";
import { LEDGE_REGRAB_FRAMES } from "../../src/game/sim/transitions";
import { type LedgerRow, PARITY, shortNumber } from "./row";

const wiki = (page: string): string => `https://www.ssbwiki.com/${page}`;
const SIM = "ts/src/game/sim";
const LEDGE = `${SIM}/ledge.ts`;
const PLATFORMS = `${SIM}/platformMoves.ts`;
const STICK_ZONES = `${SIM}/stickZones.ts`;
const STICK_DEADZONE_URL = "https://smashboards.com/threads/%E2%80%9Cup-down-zoning%E2%80%9D-your-loose-zone-for-simpler-shield-dropping.441075";
const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;
const ALWAYS_CANCELLED = "every aerial lands with the halved lag, with no input";

function commonLandingLag(): number {
  const counts = new Map<number, number>();
  for (const { normalLandingLag } of readCharacterAttributes(resolve(import.meta.dir, "../../.."))) counts.set(normalLandingLag, (counts.get(normalLandingLag) ?? 0) + 1);
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

function landingLagCancel(): string {
  const differs = AERIALS.find((style) => attackLandingLag(style) !== Math.max(1, Math.floor(uncancelledLandingLag(style) / 2)));
  return differs === undefined ? ALWAYS_CANCELLED : `aerial style ${differs} lands with ${attackLandingLag(differs)} of ${uncancelledLandingLag(differs)}`;
}

function tractionAboveWalk(): string {
  const f = fighter(solo(0, Character.rifleman));
  const walk = f.tuning.physics.walkSpeed;
  f.motion.vx = walk * 1.5;
  const above = restingTraction(f, 1.0);
  f.motion.vx = walk * 0.5;
  const below = restingTraction(f, 1.0);
  return `×${shortNumber(above)} above walk speed at rest, ×${shortNumber(below)} below`;
}

function strongAttack(): string {
  const press = normalAttackStyle(1, 0, false, false, false);
  const strong = normalAttackStyle(1, 0, false, true, false);
  if (press === AttackStyle.forwardTilt && strong === AttackStyle.forwardSmash) return "the Strong button or C-stick; a full stick press alone is a tilt";
  return `full press gives style ${press}, Strong gives ${strong}`;
}

const snapText = (character: Character): string => {
  const { x, y, height } = ledgeSnap(character);
  return `x ${shortNumber(x)}, y ${shortNumber(y)}, height ${shortNumber(height)}`;
};

export const MOVEMENT_ROWS: readonly LedgerRow[] = [
  {
    id: "normal-landing-lag", family: "movement", name: "Normal landing lag, the most common value across the cast",
    melee: { value: commonLandingLag(), source: CHARACTER_ATTRIBUTES_URL }, ours: () => EMPTY_LANDING_LAG,
    anchor: { file: `${SIM}/down.ts`, symbol: "EMPTY_LANDING_LAG" }, status: PARITY,
  },
  {
    id: "l-cancel", family: "movement", name: "L-cancel, probed on every aerial",
    melee: { value: "an L, R or Z press within 7 frames before landing halves an aerial's landing lag", source: wiki("L-cancel") }, ours: landingLagCancel,
    anchor: { file: `${SIM}/moves.ts`, symbol: "attackLandingLag" },
    status: { kind: "deviation", reason: "an input chore on every aerial with no decision in it", decided: "2026-10-06", issue: 54, elsewhere: "Removed from Brawl onward, with more autocancel; kept in Project M and Project+ ([SmashWiki](https://www.ssbwiki.com/L-cancel))" },
  },
  {
    id: "aerial-auto-cancel", family: "movement", name: "Aerial auto-cancel windows",
    melee: { value: "per aerial: landing before or after its window takes normal landing lag", source: wiki("Auto-cancel") }, ours: () => "none",
    anchor: { file: `${SIM}/moves.ts`, symbol: "attackLandingLag" },
    status: { kind: "open", reason: "missing: every aerial takes its landing lag whatever the frame", issue: 293 },
  },
  {
    id: "edge-cancel", family: "movement", name: "Edge cancel",
    melee: { value: "landing lag ends when the fighter slides off an edge", source: wiki("Edge_cancel") }, ours: () => "landing lag ends when the fighter slides off an edge",
    anchor: { file: `${SIM}/step.ts`, symbol: "slideOffEdge" }, status: PARITY,
  },
  {
    id: "teeter", family: "movement", name: "Teeter at an edge, and the teeter cancel",
    melee: { value: "only a fighter facing the edge with forward not held teeters; facing away it slides off or edge-slips", source: wiki("Edge_cancel") },
    ours: () => "either facing, a fighter in landing lag, standing or ending a dash with the stick not held toward the edge stops and teeters; held toward it, the fighter slides off",
    anchor: { file: `${SIM}/teeter.ts`, symbol: "teeterAtEdge" },
    status: { kind: "deviation", reason: "Melee's teeter is one forward-facing animation; a symmetric rule leaves no hidden facing rule deciding the result (docs/gameplay-design.md, Teeter and the teeter cancel)", decided: "2026-10-26", issue: 458 },
  },
  {
    id: "teeter-walk-off-stick", family: "movement", name: "Stick tilt that walks a fighter off instead of teetering",
    melee: { undocumented: "no public page states the tilt; SmashWiki says only that the stick must pass a certain amount", source: wiki("Teeter") },
    ours: () => `${shortNumber(WALK_MIDDLE_STICK_THRESHOLD)} toward the edge, the end of the slow walk`,
    anchor: { file: `${SIM}/teeter.ts`, symbol: "teeterAtEdge" },
    status: { kind: "open", reason: "ours; no public source gives Melee's value", issue: 293 },
  },
  {
    id: "teeter-landing-speed", family: "movement", name: "A landing with the stick not held toward the edge teeters whatever its speed",
    melee: { value: "only a fighter moving sufficiently slowly stays teetering", source: wiki("Edge_cancel") }, ours: () => "teeters at any speed, its landing lag ended",
    anchor: { file: `${SIM}/teeter.ts`, symbol: "teeterAtEdge" },
    status: { kind: "deviation", reason: "SmashWiki gives no speed; one facing rule reads at a glance (docs/gameplay-design.md, Teeter and the teeter cancel)", decided: "2026-10-26", issue: 458 },
  },
  {
    id: "shield-pushback-teeter", family: "movement", name: "Shield pushed to an edge",
    melee: { value: "the pushback slides the shielding fighter off the edge", source: wiki("Shield") },
    ours: () => "stops at the edge and teeters, its shieldstun unchanged, in either facing",
    anchor: { file: `${SIM}/teeter.ts`, symbol: "teeterShieldAtEdge" },
    status: { kind: "deviation", reason: "a pushback slide off the edge is a free escape from corner pressure; stopping at the edge rewards the corner (docs/gameplay-design.md, Shield pressure at an edge)", decided: "2026-10-26", issue: 483, elsewhere: "Smash 4 and Ultimate stop the shield at the edge too ([SmashWiki](https://www.ssbwiki.com/Shield))" },
  },
  {
    id: "ledge-catch-box", family: "movement", name: "Ledge catch box",
    melee: { undocumented: "no public page states the catch box in Melee units", source: wiki("Edge") },
    ours: () => `Rifleman ${snapText(Character.rifleman)}; Illidan ${snapText(Character.demonHunter)}; heroes Fox's scaled by body height`,
    anchor: { file: LEDGE, symbol: "ledgeCatchBox" },
    status: { kind: "open", reason: "boxes said to be Fox's, Falco's and Captain Falcon's; no public source gives Melee's box", issue: 293 },
  },
  {
    id: "ledge-intangibility", family: "movement", name: "Ledge intangibility on the first grab",
    melee: { value: 30, source: wiki("Edge") }, ours: () => ledgeIntangibleFrames(0),
    anchor: { file: LEDGE, symbol: "LEDGE_INTANGIBLE_FRAMES" }, status: PARITY,
  },
  {
    id: "ledge-intangibility-regrab", family: "movement", name: "Ledge intangibility lost per regrab without touching the stage",
    melee: { value: 0, source: wiki("Edge") }, ours: () => LEDGE_INTANGIBLE_DECAY,
    anchor: { file: LEDGE, symbol: "LEDGE_INTANGIBLE_DECAY" },
    status: { kind: "deviation", reason: "the corner belongs to the attacker, so the ledge cannot be chained (docs/gameplay-design.md, Ledge intangibility decay)", decided: "2026-10-09" },
  },
  {
    id: "ledge-regrab-lock", family: "movement", name: "Ledge regrab lock",
    melee: { value: 30, source: wiki("Edge") }, ours: () => LEDGE_REGRAB_FRAMES,
    anchor: { file: `${SIM}/transitions.ts`, symbol: "LEDGE_REGRAB_FRAMES" }, status: PARITY,
  },
  {
    id: "ledge-hang-limit", family: "movement", name: "Ledge hang limit",
    melee: { value: "660 frames under 100%, 480 from 100%", source: wiki("Edge") },
    ours: () => `${LEDGE_HANG_LIMIT_FRAMES} frames at any percent`,
    anchor: { file: LEDGE, symbol: "LEDGE_HANG_LIMIT_FRAMES" },
    status: { kind: "open", reason: "ours: a first value for Tom to tune (docs/gameplay-design.md, Ledge hang limit), shorter than Melee's 11 and 8 seconds", issue: 293 },
  },
  {
    id: "ledgedash-intangibility", family: "movement", name: "Ledge intangibility after letting go (ledgedash)",
    melee: { value: "kept after letting go", source: wiki("Ledgedash") }, ours: () => "lost on letting go",
    anchor: { file: `${SIM}/transitions.ts`, symbol: "clearLedge" },
    status: { kind: "deviation", reason: "the corner belongs to the attacker (docs/gameplay-design.md, Ledge intangibility decay)", decided: "2026-10-09" },
  },
  {
    id: "platform-drop", family: "movement", name: "Platform drop",
    melee: { value: "a fresh down falls through", source: wiki("Platform") }, ours: () => "a fresh hard down drops at once; down held after mounting crouches",
    anchor: { file: PLATFORMS, symbol: "dropFromPlatform" },
    status: { kind: "deviation", reason: "Tom removed the descent animation and frames (docs/gameplay-design.md, Platforms)", decided: "2026-10-14", issue: 392, elsewhere: "Ultimate drops through at once; Rivals 2 not sourced" },
  },
  {
    id: "platform-ascent", family: "movement", name: "Platform ascent",
    melee: { value: "a rising fighter passes up through with no change to its action", source: wiki("Platform") },
    ours: () => "down past crouch depth, without an aerial, mounts at once; otherwise passes through",
    anchor: { file: PLATFORMS, symbol: "mountPlatform" },
    status: { kind: "deviation", reason: "Tom's instant-mount rule (docs/gameplay-design.md, Platforms)", decided: "2026-10-14", issue: 392, elsewhere: "Ultimate passes through the same way; Rivals 2 not sourced" },
  },
  {
    id: "platforms-in-hitstun", family: "movement", name: "Platforms in hitstun",
    melee: { value: "lands; no drop through", source: wiki("Platform") }, ours: () => "lands; no drop through",
    anchor: { file: PLATFORMS, symbol: "intentOpen" }, status: PARITY,
  },
  {
    id: "stick-deadzone", family: "movement", name: "Stick deadzone",
    melee: { value: 0.2875, source: STICK_DEADZONE_URL }, ours: () => STICK_DEADZONE,
    anchor: { file: STICK_ZONES, symbol: "STICK_DEADZONE" },
    status: { kind: "open", reason: "ours treats |x| < 0.28 as neutral, Melee |x| < 0.2875; on Melee's 80-step stick both leave steps 0-22 neutral, on our 127-step pad ours makes step 36 live", issue: 293 },
  },
  {
    id: "stick-smash-deadzone", family: "movement", name: "Smash flick deadzone",
    melee: { undocumented: "no public page states the value a flick must start inside", source: wiki("Control_stick") }, ours: () => STICK_SMASH_DEADZONE,
    anchor: { file: STICK_ZONES, symbol: "STICK_SMASH_DEADZONE" },
    status: { kind: "open", reason: "ours; no public source gives Melee's value", issue: 293 },
  },
  {
    id: "stick-dash", family: "movement", name: "Dash stick threshold",
    melee: { value: 0.8, source: wiki("Turn") }, ours: () => DASH_STICK_THRESHOLD,
    anchor: { file: STICK_ZONES, symbol: "DASH_STICK_THRESHOLD" }, status: PARITY,
  },
  {
    id: "stick-crouch", family: "movement", name: "Crouch stick threshold",
    melee: { value: 0.6875, source: wiki("Crouch") }, ours: () => CROUCH_STICK_THRESHOLD,
    anchor: { file: STICK_ZONES, symbol: "CROUCH_STICK_THRESHOLD" }, status: PARITY,
  },
  {
    id: "stick-tap-jump", family: "movement", name: "Tap jump stick threshold, used by the platform bands",
    melee: { value: 0.6625, source: wiki("Tap_jump") }, ours: () => TAP_JUMP_STICK_THRESHOLD,
    anchor: { file: STICK_ZONES, symbol: "TAP_JUMP_STICK_THRESHOLD" }, status: PARITY,
  },
  {
    id: "tap-jump", family: "movement", name: "Tap jump",
    melee: { value: "stick up jumps, always", source: wiki("Tap_jump") }, ours: () => "off: jump is its own button",
    anchor: { file: STICK_ZONES, symbol: "TAP_JUMP_WINDOW" },
    status: { kind: "deviation", reason: "jump is its own button", decided: "2026-10-06", issue: 49, elsewhere: "Optional from Brawl onward (\"Stick Jump\" in Ultimate; [SmashWiki](https://www.ssbwiki.com/Tap_jump))" },
  },
  {
    id: "tilt-versus-smash", family: "movement", name: "Tilt or smash, probed on a full forward press",
    melee: { value: "stick speed: a flick smashes, a slower press tilts", source: wiki("Smash_attack") }, ours: strongAttack,
    anchor: { file: "ts/src/game/input/combat.ts", symbol: "normalAttackStyle" },
    status: { kind: "deviation", reason: "smashes come from the Strong button, after Rivals of Aether's strong attack (docs/gameplay-design.md, Ground states)", decided: "2026-10-24", issue: 186 },
  },
  {
    id: "tilt-modifier", family: "movement", name: "Tilt modifier stick values",
    melee: { value: "none", source: wiki("Control_stick") },
    ours: () => `x ${shortNumber(TILT_STICK_X)}, up ${shortNumber(TILT_STICK_UP)}, down ${shortNumber(TILT_STICK_DOWN)}`,
    anchor: { file: `${SIM}/stick.ts`, symbol: "TILT_STICK_X" },
    status: { kind: "deviation", reason: "a box controller's modifier, one stick unit inside roll, tap jump and crouch", decided: "2026-10-25", issue: 282 },
  },
  {
    id: "air-dodge", family: "movement", name: "Air dodge",
    melee: { value: "directional; ends in helpless fall until landing", source: wiki("Air_dodge") }, ours: () => "once per airtime, ending actionable; refreshed on landing, ledge catch and being hit",
    anchor: { file: `${SIM}/jumpsAndDodges.ts`, symbol: "beginAirDodge" },
    status: { kind: "deviation", reason: "the air dodge works as in Smash", decided: "2026-10-06", issue: 100, elsewhere: "Ultimate: one directional air dodge per airtime, no helpless fall, refreshed on landing, ledge grab and being hit ([SmashWiki](https://www.ssbwiki.com/Air_dodge)). Rivals of Aether 2: the dodge ends in an ordinary fall ([workshop](https://rivals2.com/workshop/?p=389))" },
  },
  {
    id: "air-dodge-decay", family: "movement", name: "Air dodge speed decay a frame",
    melee: { value: 0.9, source: wiki("Air_dodge") }, ours: () => AIR_DODGE_DECAY,
    anchor: { file: `${SIM}/jumpsAndDodges.ts`, symbol: "AIR_DODGE_DECAY" }, status: PARITY,
  },
  {
    id: "fast-fall-control", family: "movement", name: "Fast fall input",
    melee: { value: "a fresh stick down, diagonals included", source: wiki("Fast_fall") }, ours: () => "down with neutral horizontal input only; diagonals keep drifting",
    anchor: { file: `${SIM}/fighter.ts`, symbol: "FAST_FALL_INPUT_WINDOW" },
    status: { kind: "deviation", reason: "owner-selected control", decided: "2026-09-30" },
  },
  {
    id: "horizontal-dodge-control", family: "movement", name: "Horizontal air dodge direction",
    melee: { value: "where the stick points", source: wiki("Air_dodge") }, ours: () => "a horizontal-only digital air dodge angles 18° below horizontal",
    anchor: { file: `${SIM}/jumpsAndDodges.ts`, symbol: "beginAirDodge" },
    status: { kind: "deviation", reason: "owner-selected control; the shallow angle keeps horizontal momentum into the landing", decided: "2026-09-30" },
  },
  {
    id: "traction-doubling", family: "movement", name: "Traction above walk speed, probed headless",
    melee: { value: "×2 above walk speed at rest, ×1 below", source: wiki("Traction") }, ours: tractionAboveWalk,
    anchor: { file: `${SIM}/groundMovement.ts`, symbol: "restingTraction" }, status: PARITY,
  },
  {
    id: "dodge-timing", family: "movement", name: "Dodge timing profile",
    melee: { value: "per fighter", source: wiki("Spot_dodge") },
    ours: () => `spot dodge ${SPOT_DODGE_FRAMES}, intangible ${SPOT_DODGE_INTANGIBLE_START}–${SPOT_DODGE_INTANGIBLE_END}; rolls ${GROUND_ROLL_FRAMES}, intangible ${GROUND_ROLL_INTANGIBLE_START}–${GROUND_ROLL_INTANGIBLE_END}; air dodge ${AIR_DODGE_ANIMATION_FRAMES}, intangible ${AIR_DODGE_INTANGIBLE_START}–${AIR_DODGE_INTANGIBLE_END}, landing ${AIR_DODGE_LANDING_LAG}`,
    anchor: { file: `${SIM}/conditions.ts`, symbol: "SPOT_DODGE_FRAMES" },
    status: { kind: "deviation", reason: "one shared frame-data profile for every fighter", decided: "2026-10-06" },
  },
];
