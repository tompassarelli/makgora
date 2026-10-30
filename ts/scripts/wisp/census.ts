import { passStartControls } from "./startControls";









import type { Lockstep } from "wisp/src/headless/lockstep";
import { deliverKey } from "./deliverKey";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";
import { Phase, type MatchState } from "../../src/game/lobby/lobbyState";
import { AttackStyle, Character, SpecialAction } from "../../src/game/sim/codes";
import { Action } from "../../src/game/input/actions";
import { DEFAULT_PRESET, keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { canAttack } from "../../src/game/sim/conditions";
import type { Roster } from "../../src/game/sim/roster";
import { fighterAt } from "../../src/game/sim/roster";
import { PartnerBehaviour } from "../../src/game/match/trainingState";


declare function print(this: void, ...values: unknown[]): void;


const DEFAULT_KEYS = presetBindings(DEFAULT_PRESET);
const bound = (action: Action): number => keyFor(DEFAULT_KEYS, action, 0) ?? 0;
const KEY = {
  left: bound(Action.moveLeft), right: bound(Action.moveRight), down: bound(Action.moveDown), up: bound(Action.moveUp), jump: bound(Action.shortHop),
  attack: bound(Action.attack), special: bound(Action.special), grab: bound(Action.grab), shieldLeft: bound(Action.leftTrigger), shieldRight: bound(Action.rightTrigger),
  cLeft: bound(Action.cLeft), cRight: bound(Action.cRight), cUp: bound(Action.cUp), cDown: bound(Action.cDown), modX: bound(Action.modX), modY: bound(Action.modY), strong: bound(Action.strong),
} as const;


type KeyStep = readonly [at: number, key: number, kind: "tap" | "down" | "up"];

interface CensusMove {
  readonly name: string;
  readonly keys: readonly KeyStep[];
  readonly style?: AttackStyle;
}

const tap = (at: number, key: number): KeyStep => [at, key, "tap"];
const hold = (from: number, to: number, ...keys: number[]): KeyStep[] => [...keys.map((key): KeyStep => [from, key, "down"]), ...keys.map((key): KeyStep => [to, key, "up"])];
const JUMP_LEAD = 6;


function special(name: string, direction: number | undefined, air: boolean, follow: readonly KeyStep[] = []): CensusMove {
  const at = air ? JUMP_LEAD : 0;
  const lead = air ? [tap(0, KEY.jump)] : [];
  const press = direction === undefined ? [tap(at, KEY.special)] : [...hold(at, at + 2, direction), tap(at + 1, KEY.special)];
  return { name: `${air ? "air " : ""}${name}`, keys: [...lead, ...press, ...follow.map(([offset, key, kind]): KeyStep => [at + offset, key, kind])] };
}

const SPECIALS: readonly (readonly [string, number | undefined])[] = [["neutral special", undefined], ["side special", KEY.right], ["up special", KEY.up], ["down special", KEY.down]];


export const CENSUS_MOVES: readonly CensusMove[] = [
  { name: "jab", keys: [tap(0, KEY.attack)] },
  { name: "jab chain", keys: [tap(0, KEY.attack), tap(8, KEY.attack), tap(16, KEY.attack)] },
  { name: "forward tilt", keys: [...hold(0, 3, KEY.modX, KEY.modY, KEY.right), tap(2, KEY.attack)], style: AttackStyle.forwardTilt },
  { name: "up tilt", keys: [...hold(0, 3, KEY.modX, KEY.modY, KEY.up), tap(2, KEY.attack)], style: AttackStyle.upTilt },
  { name: "down tilt", keys: [...hold(0, 3, KEY.modX, KEY.modY, KEY.down), tap(2, KEY.attack)], style: AttackStyle.downTilt },
  { name: "forward smash", keys: hold(0, 2, KEY.strong, KEY.right), style: AttackStyle.forwardSmash },
  { name: "up smash", keys: hold(0, 2, KEY.strong, KEY.up), style: AttackStyle.upSmash },
  { name: "down smash", keys: hold(0, 2, KEY.strong, KEY.down), style: AttackStyle.downSmash },
  { name: "dash attack", keys: [...hold(0, 11, KEY.right), tap(10, KEY.attack)] },
  { name: "neutral air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.attack)] },
  { name: "forward air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cRight)] },
  { name: "back air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cLeft)] },
  { name: "up air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cUp)] },
  { name: "down air", keys: [tap(0, KEY.jump), tap(JUMP_LEAD, KEY.cDown)] },
  { name: "grab", keys: [tap(0, KEY.grab)] },
  { name: "pummel", keys: [tap(0, KEY.grab), tap(12, KEY.attack)] },
  { name: "forward throw", keys: [tap(0, KEY.grab), tap(12, KEY.right)] },
  { name: "back throw", keys: [tap(0, KEY.grab), tap(12, KEY.left)] },
  { name: "up throw", keys: [tap(0, KEY.grab), tap(12, KEY.up)] },
  { name: "down throw", keys: [tap(0, KEY.grab), tap(12, KEY.down)] },
  ...SPECIALS.flatMap(([name, direction]) => [false, true].flatMap((air) => [
    special(name, direction, air),
    special(`${name}, again`, direction, air, direction === undefined ? [tap(20, KEY.special)] : [...hold(20, 22, direction), tap(21, KEY.special)]),
  ])),
  special("side special, then attack", KEY.right, false, [tap(12, KEY.attack)]),
  special("up special, then jump", KEY.up, false, [tap(25, KEY.jump)]),
  special("up special, then attack", KEY.up, false, [tap(25, KEY.attack)]),
];


// Murlocs: Down B orders and revives only on the ground, so the air press plays its keys and frames but never starts
const GROUNDED_ONLY: Readonly<Partial<Record<Character, readonly string[]>>> = {
  [Character.murloc]: ["air down special"],
};

const MOVE_FRAMES = 150;

const BASELINE_FRAMES = 30;

const NEAR = 140;

const STAGE_FRAMES = 1200;

export const CENSUS_STAGE = 0;

export const CENSUS_PARTNER = Character.rifleman;

interface Shell {
  readonly game: MatchState;
  readonly world: Roster;
}

const isShell = (value: unknown): value is Shell => typeof value === "object" && value !== null && "game" in value && "world" in value;

function shellOf(clients: Lockstep): Shell {
  const shell = clients.client(0).natives.__smashcraftShell;
  if (!isShell(shell)) throw new Error("p0 has no shell");
  return shell;
}

function keyEvent(clients: Lockstep, key: number, down: boolean): void {
  for (const client of clients.clients) deliverKey(client, 0, key, 0, down);
}


function startTraining(clients: Lockstep, measure: PerfMeasure, fighter: Character, stage: number): void {
  const until = (what: string, done: () => boolean) => {
    for (let index = 0; index < 120 && !done(); index++) clients.frames(1);
    if (!done()) throw new Error(`${what} not reached`);
  };
  clients.start();
  clients.frames(30);
  passStartControls(clients);
  clients.press(0, KEY.right);
  clients.frames(5);
  for (const client of clients.clients) {
    const shell = client.natives.__smashcraftShell;
    if (!isShell(shell)) throw new Error(`p${client.slot} has no shell`);
    const game = shell.game;
    game.characterChoices[0] = fighter;
    game.characterReadiness[0] = true;
    game.computerMask |= 1 << 1;
    game.characterChoices[1] = CENSUS_PARTNER;
    game.characterReadiness[1] = true;
    game.training = true;
    game.trainer.behaviour = PartnerBehaviour.stand;
  }
  clients.press(0, 0x59);
  until("stage selection", () => shellOf(clients).game.phase === Phase.stageMenu);
  for (const client of clients.clients) {
    const shell = client.natives.__smashcraftShell;
    if (!isShell(shell)) throw new Error(`p${client.slot} has no shell`);
    shell.game.stageChoice = stage;
  }
  clients.press(0, 0x59);
  until("the match", () => shellOf(clients).game.phase === Phase.match);
  if (shellOf(clients).game.stageChoice !== stage) throw new Error(`the census did not start on stage ${stage}`);
  measure.begin();
}


function reset(clients: Lockstep): void {
  keyEvent(clients, KEY.shieldLeft, true);
  keyEvent(clients, KEY.shieldRight, true);
  clients.frames(1);
  clients.press(0, KEY.attack);
  clients.frames(1);
  keyEvent(clients, KEY.shieldLeft, false);
  keyEvent(clients, KEY.shieldRight, false);
}


function approach(clients: Lockstep): readonly [number, number] {
  reset(clients);
  clients.frames(20);
  const gap = () => {
    const { world } = shellOf(clients);
    return fighterAt(world, 1).motion.x - fighterAt(world, 0).motion.x;
  };
  keyEvent(clients, KEY.right, true);
  for (let index = 0; index < 120 && gap() > NEAR; index++) clients.frames(1);
  keyEvent(clients, KEY.right, false);
  for (let index = 0; index < 60 && !canAttack(fighterAt(shellOf(clients).world, 0)); index++) clients.frames(1);
  clients.frames(20);
  const first = clients.frame + 1;
  clients.frames(BASELINE_FRAMES);
  return [first, clients.frame];
}

function playMove(clients: Lockstep, move: CensusMove): readonly [number, number, number | undefined, AttackStyle | undefined] {
  const first = clients.frame + 1;
  const before = fighterAt(shellOf(clients).world, 0);
  const attackSerial = before.attack.serial;
  const grabSerial = before.grab.serial;
  let action = before.special.action;
  let started: number | undefined;
  let style: AttackStyle | undefined;
  for (let at = 0; at < MOVE_FRAMES; at++) {
    for (const [when, key, kind] of move.keys) {
      if (when !== at) continue;
      if (kind === "tap") clients.press(0, key);
      else keyEvent(clients, key, kind === "down");
    }
    clients.frames(1);
    if (started !== undefined) continue;
    const { attack, grab, special } = fighterAt(shellOf(clients).world, 0);
    if (attack.serial !== attackSerial) style = attack.style;
    if (attack.serial !== attackSerial || grab.serial !== grabSerial || (special.action !== action && special.action !== SpecialAction.none)) started = at;
    action = special.action;
  }
  return [first, clients.frame, started, style];
}

function problemsOf(clients: Lockstep): { problems: number; lines: string[] } {
  const lines: string[] = [];
  for (const client of clients.clients) for (const error of client.errors) lines.push(`p${client.slot}: ${error}`);
  return { problems: lines.length, lines };
}


export function playFighterCensus(clients: Lockstep, measure: PerfMeasure, fighter: Character, label: string): { problems: number; lines: string[] } {
  startTraining(clients, measure, fighter, CENSUS_STAGE);
  const unstarted: string[] = [];
  const mismatched: string[] = [];
  for (const move of CENSUS_MOVES) {
    const [baseFirst, baseLast] = approach(clients);
    const [moveFirst, moveLast, started, style] = playMove(clients, move);
    if (started === undefined) {
      if (!(GROUNDED_ONLY[fighter] ?? []).includes(move.name)) unstarted.push(move.name);
    } else if (move.style !== undefined && style !== move.style) mismatched.push(`${label}: ${move.name} started attack style ${style ?? "none"}, not ${move.style}`);
    print(`census\t${label}\t${move.name}\t${baseFirst}\t${baseLast}\t${moveFirst}\t${moveLast}\t${started ?? "never"}`);
  }
  const result = problemsOf(clients);
  const [firstUnstarted] = unstarted;
  if (firstUnstarted === undefined && mismatched.length === 0) return result;
  const lines = [...result.lines, ...mismatched, ...(firstUnstarted === undefined ? [] : [`${label}: ${firstUnstarted} never started; ${unstarted.length} of ${CENSUS_MOVES.length} census moves never started`])];
  return { problems: lines.length, lines };
}


export function playStageCensus(clients: Lockstep, measure: PerfMeasure, stage: number, label: string): { problems: number; lines: string[] } {
  startTraining(clients, measure, CENSUS_PARTNER, stage);
  clients.frames(60);
  const first = clients.frame + 1;
  clients.frames(STAGE_FRAMES);
  print(`census\tstage\t${label}\t${first}\t${clients.frame}\t${first}\t${clients.frame}`);
  return problemsOf(clients);
}
