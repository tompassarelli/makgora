import { f32 } from "wisp/src/sim/f32";
import { Action, bit } from "../src/game/input/actions";
import { comboScene } from "../src/game/match/comboRoute";
import { type Scene, airborne, fighter, frameMasks } from "../src/game/match/padScene";
import { Character } from "../src/game/sim/codes";
import { canAttack, inGrabContext } from "../src/game/sim/conditions";
import { fighterName } from "../src/game/roster/kits";
import { surfaceRight, surfaceZ } from "../src/game/sim/stage";

const STAGE = 1;
const DECK = 2;
const EDGE = surfaceRight(STAGE, DECK, 0);
const TOP = surfaceZ(STAGE, DECK, 0);
const DEFENDER = Character.rifleman;
const OPENER_LIMIT = 60;
const FOLLOW_UP_LIMIT = 40;

const ATTACK = bit(Action.attack);
const SPECIAL = bit(Action.special);
const JUMP = bit(Action.jump);
const GRAB = bit(Action.grab);
const WALK = bit(Action.walk);
const LEFT = bit(Action.moveLeft);
const RIGHT = bit(Action.moveRight);
const UP = bit(Action.moveUp);
const DOWN = bit(Action.moveDown);
const SHIELD = bit(Action.rightTrigger);
const SMASH_LEFT = bit(Action.cLeft);
const SMASH_RIGHT = bit(Action.cRight);
const SMASH_UP = bit(Action.cUp);
const SMASH_DOWN = bit(Action.cDown);

export interface Aerial {
  readonly name: string;
  readonly mask: number;
  readonly facing: number;
}

export const AERIALS: readonly Aerial[] = [
  { name: "neutral air", mask: ATTACK, facing: 1 },
  { name: "forward air", mask: SMASH_RIGHT, facing: 1 },
  { name: "back air", mask: SMASH_RIGHT, facing: -1 },
  { name: "up air", mask: SMASH_UP, facing: 1 },
  { name: "down air", mask: SMASH_DOWN, facing: 1 },
];

export interface FollowUp {
  readonly name: string;
  readonly mask: number;
}

export const FOLLOW_UPS: readonly FollowUp[] = [
  { name: "jab", mask: ATTACK },
  { name: "forward tilt", mask: WALK | RIGHT | ATTACK },
  { name: "down tilt", mask: WALK | DOWN | ATTACK },
  { name: "grab", mask: GRAB },
  { name: "down special", mask: SPECIAL | DOWN },
];

export interface DefenderOption {
  readonly name: string;
  readonly mask: number;
}

export const DEFENDER_OPTIONS: readonly DefenderOption[] = [
  { name: "hold shield", mask: SHIELD },
  { name: "jump out of shield", mask: SHIELD | JUMP },
  { name: "shield grab", mask: SHIELD | GRAB },
  { name: "roll in", mask: SHIELD | LEFT },
];

const GAPS = [0, 6, 12] as const;
const SPACINGS = [25, 40, 55] as const;
const HEIGHTS = [10, 20, 30, 45, 60, 90] as const;

export interface Pressure {
  readonly aerial: string;
  readonly gap: number;
  readonly spacing: number;
  readonly height: number;
}

function pressureScene(attacker: Character, aerial: Aerial, p: Pressure): Scene {
  const defenderX = f32(EDGE - p.gap);
  const attackerX = f32(defenderX - p.spacing);
  const s = comboScene({ stage: STAGE, attacker, defender: DEFENDER, attackerX, defenderX, facing: aerial.facing, attackerZ: 0, defenderZ: 0, percent: 0 });
  const b = fighter(s, 1);
  b.facing = -1;
  b.motion.x = defenderX;
  b.motion.z = TOP;
  b.motion.grounded = true;
  b.motion.surface = DECK;
  airborne(fighter(s, 0), attackerX, f32(TOP + p.height));
  return s;
}

const step = (s: Scene, a: number, b: number): void => frameMasks(s, (slot) => (slot === 0 ? a : slot === 1 ? b : 0));

export type Outcome = "connects" | "off stage" | "whiffs" | "beaten";

export interface Trial {
  readonly fighter: string;
  readonly pressure: Pressure;
  readonly followUp: string;
  readonly option: string;
  readonly outcome: Outcome;
}

function trial(attacker: Character, aerial: Aerial, p: Pressure, teeterStun: number, f: FollowUp, option: DefenderOption): Outcome | undefined {
  const s = pressureScene(attacker, aerial, p);
  const a = fighter(s, 0);
  const b = fighter(s, 1);
  const shields = b.visuals.shield;
  let contact = false;
  let stunned = false;
  let pressed: number | undefined;
  let hits = b.visuals.hit;
  let blocks = b.visuals.shield;
  const struck = a.visuals.hit;
  for (let n = 1; n <= OPENER_LIMIT + FOLLOW_UP_LIMIT; n++) {
    const press = contact && pressed === undefined && a.motion.grounded && canAttack(a);
    if (press) {
      pressed = n;
      hits = b.visuals.hit;
      blocks = b.visuals.shield;
    }
    const free = contact && b.shield.stun <= 0 && b.launch.hitlag <= 0;
    step(s, n === 1 ? aerial.mask : press ? f.mask : 0, free ? option.mask : SHIELD);
    if (!contact && b.visuals.shield !== shields) contact = true;
    if (!contact) {
      if (a.motion.grounded) return undefined;
      continue;
    }
    if (!stunned && teeterStun > 0 && b.motion.grounded && b.motion.x === EDGE && b.shield.stun > 0) {
      b.shield.stun += teeterStun;
      stunned = true;
    }
    if (a.visuals.hit !== struck || inGrabContext(a) && !inGrabContext(b)) return "beaten";
    if (!b.motion.grounded && b.motion.x > EDGE) return "off stage";
    if (pressed === undefined) continue;
    if (b.visuals.shield !== blocks || b.visuals.hit !== hits || inGrabContext(b)) return "connects";
    if (n - pressed >= FOLLOW_UP_LIMIT) return "whiffs";
  }
  return pressed === undefined ? undefined : "whiffs";
}

export function measureFighter(attacker: Character, teeterStun = 0): Trial[] {
  const trials: Trial[] = [];
  for (const aerial of AERIALS) {
    for (const gap of GAPS) for (const spacing of SPACINGS) for (const height of HEIGHTS) {
      const pressure = { aerial: aerial.name, gap, spacing, height };
      for (const f of FOLLOW_UPS) for (const option of DEFENDER_OPTIONS) {
        const outcome = trial(attacker, aerial, pressure, teeterStun, f, option);
        if (outcome !== undefined) trials.push({ fighter: fighterName(attacker), pressure, followUp: f.name, option: option.name, outcome });
      }
    }
  }
  return trials;
}

export const TEETER_STUNS = [0, 2, 4] as const;

const OUTCOMES: readonly Outcome[] = ["connects", "off stage", "whiffs", "beaten"];

const share = (trials: readonly Trial[], outcome: Outcome): string =>
  `${(100 * trials.filter((t) => t.outcome === outcome).length / Math.max(1, trials.length)).toFixed(0)}%`;

export function edgeShieldPage(attackers: readonly Character[]): string[] {
  const lines = [`| Teeter stun | Fighter | Strings | Trials | ${OUTCOMES.join(" | ")} |`, `| ---: | --- | ---: | ---: |${OUTCOMES.map(() => " ---: |").join("")}`];
  const byOption = [`| Teeter stun | Defender option | Trials | ${OUTCOMES.join(" | ")} |`, `| ---: | --- | ---: |${OUTCOMES.map(() => " ---: |").join("")}`];
  const missed = new Set<string>();
  for (const stun of TEETER_STUNS) {
    const all = attackers.flatMap((attacker) => {
      const trials = measureFighter(attacker, stun);
      const strings = new Set(trials.map((t) => JSON.stringify(t.pressure))).size;
      if (strings === 0) missed.add(fighterName(attacker));
      else lines.push(`| ${stun} | ${fighterName(attacker)} | ${strings} | ${trials.length} | ${OUTCOMES.map((o) => share(trials, o)).join(" | ")} |`);
      return trials;
    });
    lines.push(`| ${stun} | all | ${new Set(all.map((t) => t.fighter + JSON.stringify(t.pressure))).size} | ${all.length} | ${OUTCOMES.map((o) => share(all, o)).join(" | ")} |`);
    for (const option of DEFENDER_OPTIONS) {
      const own = all.filter((t) => t.option === option.name);
      byOption.push(`| ${stun} | ${option.name} | ${own.length} | ${OUTCOMES.map((o) => share(own, o)).join(" | ")} |`);
    }
  }
  return [...lines, "", ...byOption, ...(missed.size === 0 ? [] : ["", `No aerial met the shield from the hop grid: ${[...missed].join(", ")}.`])];
}
