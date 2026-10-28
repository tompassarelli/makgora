// Every fighter's down special pressed in the air (#448): rising, falling, near the deck and offstage.
// `bun scripts/aerialDownSpecials.ts` prints the per-fighter table kept in docs/design/aerial-down-specials.md.
import { Action, maskOf } from "../src/game/input/actions";
import { adaptInput } from "../src/game/match/inputAdapter";
import { inputRow } from "../src/game/input/inputRow";
import { Phase } from "../src/game/lobby/lobbyState";
import { stepMatch } from "../src/game/match/step";
import { createReplaySnapshot } from "../src/game/replay/snapshot";
import { copyFighterState } from "../src/generated/state/fighterState";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { runningHeroSpecial } from "../src/game/sim/specials/engine";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/roster/kits";
import { setWorldMotionValue } from "../src/game/sim/motion";
import { fighterAt } from "../src/game/sim/roster";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP } from "../src/game/sim/specials";

export const AERIAL_DOWN_SETUPS = [
  { name: "Rising", x: 100.0, z: 240.0, vz: 8.0 },
  { name: "Falling", x: 100.0, z: 240.0, vz: -4.0 },
  { name: "Near ground", x: 100.0, z: 40.0, vz: -1.0 },
  { name: "Offstage", x: 900.0, z: 240.0, vz: -4.0 },
] as const;

export const AERIAL_DOWN_FRAMES = 120;

/** Each fighter's aerial down special, as the #448 lead approved it. */
export const AERIAL_DOWN_CHOICES: Readonly<Record<number, string>> = {
  [Character.rifleman]: "Freeze Trap tossed in the air falls and arms on deck contact",
  [Character.demonHunter]: "Immolate in the air, a Falco-style shine that holds him in place and a jump cancels",
  [Character.blademaster]: "Wind Walk's counter guard in the air, with no travel",
  [Character.mountainKing]: "aerial Thunder Clap; lands into the grounded clap",
  [Character.warden]: "Fan of Knives in the air, a ring of knives with a shine-like semi-spike that nearly stops her fall and a jump cancels",
  [Character.lich]: "Frost Armor cast in the air; lands into the grounded cast",
  [Character.uther]: "Divine Shield in the air; lands into the grounded bubble",
  [Character.dreadlord]: "aerial Sleep orb; lands into the grounded cast",
  [Character.shadowHunter]: "aerial Hex orb; lands into the grounded cast",
  [Character.pitLord]: "aerial Rain of Fire; lands into the grounded cast",
  [Character.beastmaster]: "downward quill volley; commands a deployed Quilbeast",
  [Character.lichKing]: "downward shadow pulse with the Defile hit",
  [Character.thrall]: "falling two-sided Doomhammer Slam",
  [Character.jaina]: "downward water bolt; recall works while falling",
  [Character.sylvanas]: "Life Drain grab while falling",
  [Character.cairne]: "War Stomp: Endurance armor while falling, two-sided stomp, 26 landing frames",
  [Character.chen]: "Earth stance armor in the air; lands into the grounded stance",
  [Character.peon]: "Rest in the air: the frame-2 jolt, then he sleeps while falling and keeps sleeping after landing",
  [Character.tinker]: "drops one Clockwerk Goblin; lands into the grounded factory build",
  [Character.kaelthas]: "Banish curse in the air; lands into the grounded cast",
  [Character.murloc]: "small plague cloud at the cast point",
  [Character.grom]: "aerial chop; lands into the grounded chop",
  [Character.anubarak]: "downward beetle; recall works while falling",
  [Character.malfurion]: "downward branch; recall works while falling",
  [Character.medivh]: "Last Word holds height, blinks back and bursts",
  [Character.ladyVashj]: "Mana Shield toggles in the air as on the ground",
  [Character.archimonde]: "aerial Bash, a hammer-fist that drives a foe below him down",
};

export interface AerialDownRow {
  readonly character: Character;
  readonly setup: number;
  /** Special action and form after the press frame; action 0 means refused. */
  readonly action: number;
  readonly form: number;
  /** First frame with a strike window, projectile, placement, trap, guard or armor; 0 for none. */
  readonly effect: number;
  /** First grounded frame; 0 for none. */
  readonly landed: number;
  /** First frame the special was over; 0 for none. */
  readonly ended: number;
}

/** Whether the special shows its hitbox or effect this frame. */
export function aerialDownEffect(f: Readonly<Fighter>): boolean {
  const { special } = f;
  if (special.action === SpecialAction.demonHunterImmolate) return special.frame >= DEMONHUNTER_IMMOLATE_STARTUP && special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
  const move = runningHeroSpecial(f);
  const during = (window: { readonly first: number; readonly last: number } | undefined): boolean =>
    window !== undefined && special.frame >= window.first && special.frame <= window.last;
  return move?.regions?.some(region => special.frame - 1 >= region.firstFrame && special.frame - 1 <= region.lastFrame) === true
    || during(move?.commandGrab) || during(move?.guard)
    || f.projectiles.some(projectile => projectile.life > 0) || f.placed.life > 0 || f.pack.some(placed => placed.life > 0) || f.freezeTrap.life > 0 || f.status.armorFrames > 0;
}

/** Presses down special once, holding down, from one airborne setup; stops at the first effect when `untilEffect`. */
export function aerialDownSpecial(character: Character, setup: number, untilEffect = false): AerialDownRow {
  const start = AERIAL_DOWN_SETUPS[setup]!;
  const state = createReplaySnapshot();
  const owner = fighterAt(state.world, 0);
  copyFighterState(owner, createFighter(character, start.x, 1), 3);
  copyFighterState(fighterAt(state.world, 1), createFighter(Character.rifleman, -480.0, 1), 3);
  owner.motion.z = start.z;
  owner.motion.vz = start.vz;
  owner.motion.grounded = false;
  owner.motion.surface = undefined;
  setWorldMotionValue(owner.motion.meleeX, owner.motion.x);
  setWorldMotionValue(owner.motion.meleeZ, owner.motion.z);
  setWorldMotionValue(owner.motion.meleeVelocityZ, owner.motion.vz);
  state.match.phase = Phase.match;
  state.match.stageChoice = 0;
  state.match.matchSeed = 448;
  state.match.hazards = false;
  state.match.items.on = false;
  state.match.timeLimitMinutes = 0;
  state.match.ultimatesOff = true;
  let action = 0;
  let form = 0;
  let effect = 0;
  let landed = 0;
  let ended = 0;
  for (let tick = 1; tick <= AERIAL_DOWN_FRAMES; tick++) {
    const row = inputRow({ held: tick === 1 ? maskOf(Action.moveDown, Action.special) : maskOf(Action.moveDown),
      pressed: tick === 1 ? maskOf(Action.special) : 0, axisZ: -127, specialZ: tick === 1 ? -1 : 0 });
    if (row === undefined) throw new Error("aerial down special input row");
    adaptInput(row, owner, tick, state.controls.inputs[0], state.controls.commands[0]);
    stepMatch(state.match, state.world, state.controls, tick);
    if (tick === 1) {
      action = owner.special.action;
      form = owner.special.form;
      if (action === SpecialAction.none) break;
    }
    if (landed === 0 && owner.motion.grounded) landed = tick;
    if (ended === 0 && owner.special.action === SpecialAction.none) ended = tick;
    if (effect === 0 && ended === 0 && aerialDownEffect(owner)) effect = tick;
    if (untilEffect && effect !== 0) break;
  }
  return { character, setup, action, form, effect, landed, ended };
}

/** A press that does nothing: refused, or over before its effect. */
export const deadInput = (row: Readonly<AerialDownRow>): boolean => row.action === SpecialAction.none || row.effect === 0;

const event = (frame: number): string => frame === 0 ? "—" : `${frame}`;

function cell(row: Readonly<AerialDownRow>): string {
  if (row.action === SpecialAction.none) return "R";
  const form = row.action === SpecialAction.heroDown ? `S${row.form}` : `A${row.action}`;
  return `${form} W${event(row.effect)} L${event(row.landed)}/E${event(row.ended)}`;
}

export function aerialDownTable(): string {
  const lines = [`| Fighter | Aerial choice | ${AERIAL_DOWN_SETUPS.map(setup => setup.name).join(" | ")} |`,
    `|---|---|${AERIAL_DOWN_SETUPS.map(() => "---").join("|")}|`];
  let dead = 0;
  let presses = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const rows = AERIAL_DOWN_SETUPS.map((_, setup) => aerialDownSpecial(character, setup));
    presses += rows.length;
    dead += rows.filter(deadInput).length;
    lines.push(`| ${fighterName(character)} | ${AERIAL_DOWN_CHOICES[character] ?? "—"} | ${rows.map(cell).join(" | ")} |`);
  }
  lines.push("", `${SELECTABLE_CHARACTERS.length} fighters, ${presses} presses, ${dead} dead inputs.`);
  return lines.join("\n");
}

if (import.meta.main) console.log(aerialDownTable());
