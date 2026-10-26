import { f32 } from "wisp/src/sim/f32";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { Character, DownState } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import { fighterName } from "../src/game/sim/heroes/registry";
import { mainDeckLeft, mainDeckRight } from "../src/game/sim/stage";
import {
  DIS, type Defender, type Di, type Ending, Explorer, OPENERS, type Opener, PERCENTS, TECH_OPTIONS, defenderMask, free, openerRoot, settled,
} from "./comboExplorer";

export const THROW_ROLES = ["combo starter", "tech-chase starter", "kill throw", "positional", "percent-window confirm"] as const;
export type ThrowRole = (typeof THROW_ROLES)[number];
export const THROW_DIRECTIONS = ["forward", "back", "up", "down"] as const;
export type ThrowDirection = (typeof THROW_DIRECTIONS)[number];

export const ROLE_PERCENTS: Readonly<Record<ThrowRole, readonly number[]>> = {
  "combo starter": [0, 30, 60],
  "tech-chase starter": [0, 30, 60, 90],
  "kill throw": [150],
  "positional": [60],
  "percent-window confirm": PERCENTS,
};

export interface ThrowDeclaration {
  readonly fighter: string;
  readonly throw: ThrowDirection;
  readonly role: ThrowRole;
  readonly percents: readonly number[];
}

export interface ThrowRoleUnit {
  readonly attacker: Character;
  readonly declaration: ThrowDeclaration;
}

export interface ThrowRoleResult {
  readonly fighter: string;
  readonly throw: ThrowDirection;
  readonly role: ThrowRole;
  readonly percents: readonly number[];
  readonly passes: boolean;
  readonly measured: string;
  readonly problems: readonly string[];
}

export const VICTIM = Character.kobold;
export const VICTIM_WEIGHT = 75;
const STAGE = 0;
const SPACINGS = [40, 70, 100, 20, 140] as const;
const LANDING_SPREAD = 3;
const POSITIONAL_SHARE = 0.16;
const CONFIRM_BAND = 10;
const KILL_HORIZON = 300;
const LAND_HORIZON = 150;
const LEDGE_INSET = 60;

const left = mainDeckLeft(STAGE);
const right = mainDeckRight(STAGE);
const reflect = (x: number): number => left + right - x;

function openerFor(direction: ThrowDirection): Opener {
  const opener = OPENERS.find((candidate) => candidate.throw === direction);
  if (opener === undefined) throw new Error(`no ${direction} throw opener`);
  return opener;
}

function placed(attacker: Character, direction: ThrowDirection, percent: number, x: number, spacing: number): ComboSetup {
  const backward = direction === "back";
  const attackerX = backward ? reflect(x) : f32(x - spacing);
  return {
    stage: STAGE, attacker, defender: VICTIM, attackerX, defenderX: f32(attackerX + spacing), facing: 1,
    attackerZ: 0, defenderZ: 0, percent, defenderWeight: VICTIM_WEIGHT,
  };
}

function throwSetup(attacker: Character, direction: ThrowDirection, percent: number, x: number): ComboSetup | undefined {
  const opener = openerFor(direction);
  for (const spacing of SPACINGS) {
    const setup = placed(attacker, direction, percent, x, spacing);
    const played = openerRoot(setup, opener, { name: "none", di: "none" });
    if (played === undefined) continue;
    free(played.root.saved);
    return setup;
  }
  return undefined;
}

interface Flight {
  readonly ko: boolean;
  readonly releaseX: number;
  readonly actionableX: number | undefined;
  readonly tumbles: boolean;
  readonly actsBeforeLanding: boolean;
  readonly landing: number | undefined;
}

function fly(setup: ComboSetup, direction: ThrowDirection, di: Di, horizon: number): Flight | undefined {
  const played = openerRoot(setup, openerFor(direction), { name: di, di });
  if (played === undefined) return undefined;
  const { sim } = played;
  const d: Defender = { name: di, di };
  const stocks = sim.b.status.stocks;
  const releaseX = sim.b.motion.x;
  let freedAt: number | undefined;
  let actionableX: number | undefined;
  let tumbles = false;
  let actsBeforeLanding = false;
  let landing: number | undefined;
  let wasTumbling = sim.b.down.state === DownState.tumble;
  let ko = false;
  for (let n = 1; n <= horizon; n++) {
    const a = sim.a;
    const b = sim.b;
    sim.step(0, defenderMask(d, n, freedAt, b, a));
    if (sim.b.status.stocks < stocks) {
      ko = true;
      break;
    }
    const after = sim.b;
    if (landing === undefined && (after.motion.grounded || after.down.state === DownState.bound || after.down.state === DownState.tech)) {
      landing = n;
      tumbles = wasTumbling;
    }
    if (landing === undefined && canAttack(after)) actsBeforeLanding = true;
    wasTumbling = after.down.state === DownState.tumble;
    if (freedAt === undefined && settled(after)) {
      freedAt = n;
      actionableX = after.motion.x;
    }
  }
  free(played.root.saved);
  return { ko, releaseX, actionableX, tumbles, actsBeforeLanding, landing };
}

interface Search {
  readonly worst: Ending;
  readonly worstDi: Di;
}

function worstCase(setup: ComboSetup, direction: ThrowDirection, percent: number): Search | undefined {
  let worst: Search | undefined;
  for (const di of DIS) {
    const d: Defender = { name: di, di };
    const played = openerRoot(setup, openerFor(direction), d);
    if (played === undefined) return undefined;
    const { best } = new Explorer(played.sim).search(played.root, d, percent, worst?.worst);
    free(played.root.saved);
    if (worst === undefined || worse(best, worst.worst)) worst = { worst: best, worstDi: di };
  }
  return worst;
}

const worse = (x: Ending, y: Ending): boolean => (x.ko !== y.ko ? !x.ko : x.moves.length !== y.moves.length ? x.moves.length < y.moves.length : x.damage < y.damage);

const centre = (): number => f32((left + right) / 2);

function comboStarter(attacker: Character, declaration: ThrowDeclaration): Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents"> {
  const problems: string[] = [];
  const cells = declaration.percents.map((percent) => {
    const setup = throwSetup(attacker, declaration.throw, percent, centre());
    const search = setup === undefined ? undefined : worstCase(setup, declaration.throw, percent);
    if (search === undefined) problems.push(`the throw does not land at ${percent}%`);
    else if (search.worst.moves.length < 2) problems.push(`no follow-up lands against DI ${search.worstDi} at ${percent}%`);
    return `${percent}%: ${search === undefined ? "no throw" : search.worst.moves.slice(1).join(", ") || `none (DI ${search.worstDi})`}`;
  });
  return { passes: problems.length === 0, measured: cells.join("; "), problems };
}

function techChaseStarter(attacker: Character, declaration: ThrowDeclaration): Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents"> {
  const problems: string[] = [];
  const landings = new Map<Di, number[]>();
  const cells = declaration.percents.map((percent) => {
    const setup = throwSetup(attacker, declaration.throw, percent, centre());
    if (setup === undefined) {
      problems.push(`the throw does not land at ${percent}%`);
      return `${percent}%: no throw`;
    }
    for (const di of DIS) {
      const flight = fly(setup, declaration.throw, di, LAND_HORIZON);
      if (flight === undefined || flight.ko || flight.landing === undefined || !flight.tumbles || flight.actsBeforeLanding) {
        problems.push(`DI ${di} at ${percent}% is not a tumble landing inside hitstun`);
        continue;
      }
      landings.set(di, [...(landings.get(di) ?? []), flight.landing]);
    }
    const d: Defender = { name: "none", di: "none" };
    const played = openerRoot(setup, openerFor(declaration.throw), d);
    if (played === undefined) return `${percent}%: no throw`;
    const explorer = new Explorer(played.sim);
    const { best } = explorer.search(played.root, d, percent);
    free(played.root.saved);
    if (best.situation !== "tech chase") {
      problems.push(`at ${percent}% the throw ends in ${best.ko ? "a KO" : best.moves.length > 1 ? `a true follow-up (${best.moves.slice(1).join(", ")})` : "no tech chase"}`);
      return `${percent}%: ${best.moves.slice(1).join(", ") || "no tech chase"}`;
    }
    const reads = explorer.techReads(best, "none", percent);
    const uncovered = TECH_OPTIONS.filter((_, index) => reads[index] === undefined);
    if (uncovered.length > 0) problems.push(`at ${percent}% no read covers ${uncovered.join(", ")}`);
    return `${percent}%: ${TECH_OPTIONS.length - uncovered.length}/${TECH_OPTIONS.length} tech options read`;
  });
  for (const [di, frames] of landings) {
    const spread = Math.max(...frames) - Math.min(...frames);
    if (frames.length === declaration.percents.length && spread > LANDING_SPREAD) problems.push(`DI ${di} landing frames ${frames.join("/")} spread ${spread} frames`);
  }
  const spreads = [...landings.values()].map((frames) => `${Math.min(...frames)}–${Math.max(...frames)}`);
  return { passes: problems.length === 0, measured: `${cells.join("; ")}; lands ${[...new Set(spreads)].join(", ")} frames after release`, problems };
}

function killThrow(attacker: Character, declaration: ThrowDeclaration): Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents"> {
  const problems: string[] = [];
  const ledge = f32(right - LEDGE_INSET);
  const cells = declaration.percents.map((percent) => {
    const setup = throwSetup(attacker, declaration.throw, percent, ledge);
    if (setup === undefined) {
      problems.push(`the throw does not land at the ledge at ${percent}%`);
      return `${percent}%: no throw`;
    }
    const survives = DIS.filter((di) => fly(setup, declaration.throw, di, KILL_HORIZON)?.ko !== true);
    if (survives.length > 0) problems.push(`at ${percent}% the victim survives DI ${survives.join(", ")}`);
    return `${percent}%: ${survives.length === 0 ? "KO under every DI" : `survives DI ${survives.join(", ")}`}`;
  });
  return { passes: problems.length === 0, measured: cells.join("; "), problems };
}

function positional(attacker: Character, declaration: ThrowDeclaration): Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents"> {
  const problems: string[] = [];
  const midway = f32((centre() + right) / 2);
  const width = right - left;
  const cells = declaration.percents.map((percent) => {
    const setup = throwSetup(attacker, declaration.throw, percent, midway);
    if (setup === undefined) {
      problems.push(`the throw does not land at ${percent}%`);
      return `${percent}%: no throw`;
    }
    const carried = DIS.map((di) => {
      const flight = fly(setup, declaration.throw, di, KILL_HORIZON);
      if (flight === undefined) return { di, ok: false, share: 0 };
      if (flight.ko) return { di, ok: true, share: 1 };
      const x = flight.actionableX ?? flight.releaseX;
      const share = Math.abs(x - flight.releaseX) / width;
      return { di, ok: x < left || x > right || share > POSITIONAL_SHARE, share };
    });
    const short = carried.filter(({ ok }) => !ok);
    if (short.length > 0) problems.push(`at ${percent}% DI ${short.map(({ di }) => di).join(", ")} leaves the victim on stage within ${POSITIONAL_SHARE * 100}% of the stage width`);
    const least = Math.min(...carried.map(({ share }) => share));
    return `${percent}%: carried at least ${Math.round(least * 100)}% of the stage width`;
  });
  return { passes: problems.length === 0, measured: cells.join("; "), problems };
}

function percentWindowConfirm(attacker: Character, declaration: ThrowDeclaration): Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents"> {
  const kills = declaration.percents.filter((percent) => {
    const setup = throwSetup(attacker, declaration.throw, percent, centre());
    const search = setup === undefined ? undefined : worstCase(setup, declaration.throw, percent);
    return search?.worst.ko === true;
  });
  const band = kills.filter((percent) => kills.includes(percent + CONFIRM_BAND));
  const problems = [
    ...(band.length === 0 ? [`no band of ${CONFIRM_BAND}% where a follow-up KOs against every DI`] : []),
    ...(kills.length === declaration.percents.length ? ["the kill is guaranteed at every percent, so it is not a window"] : []),
  ];
  return { passes: problems.length === 0, measured: kills.length === 0 ? "no guaranteed KO" : `guaranteed KO at ${kills.join(", ")}%`, problems };
}

const TESTS: Readonly<Record<ThrowRole, (attacker: Character, declaration: ThrowDeclaration) => Omit<ThrowRoleResult, "fighter" | "throw" | "role" | "percents">>> = {
  "combo starter": comboStarter,
  "tech-chase starter": techChaseStarter,
  "kill throw": killThrow,
  "positional": positional,
  "percent-window confirm": percentWindowConfirm,
};

export function checkThrowRole(unit: ThrowRoleUnit): ThrowRoleResult {
  const { declaration } = unit;
  return { fighter: fighterName(unit.attacker), throw: declaration.throw, role: declaration.role, percents: declaration.percents, ...TESTS[declaration.role](unit.attacker, declaration) };
}

export function coverageProblems(declarations: readonly ThrowDeclaration[]): string[] {
  const fighters = [...new Set(declarations.map((declaration) => declaration.fighter))];
  return fighters.flatMap((fighter) => {
    const own = declarations.filter((declaration) => declaration.fighter === fighter);
    const missing = THROW_DIRECTIONS.filter((direction) => !own.some((declaration) => declaration.throw === direction));
    const roles = new Set(own.map((declaration) => declaration.role));
    return [
      ...(missing.length > 0 ? [`${fighter} declares no role for its ${missing.join(", ")} throw`] : []),
      ...(roles.size < 3 ? [`${fighter}'s throws cover ${roles.size} roles, fewer than 3`] : []),
    ];
  });
}
