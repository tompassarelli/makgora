import { f32 } from "wisp/src/sim/f32";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { frameSteered } from "../src/game/match/padScene";
import { stateChecksum } from "../src/game/replay/canonical";
import { AttackStyle, Character, DownState } from "../src/game/sim/codes";
import { canAttack, canBeGrabbed } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { fighterName } from "../src/game/roster/kits";
import { attackStartupFrames } from "../src/game/sim/moves";
import { totalVelocityZ } from "../src/game/sim/motion";
import { floorBelow } from "../src/game/sim/stage";
import { copyControls, neutralControls } from "../src/game/sim/roster";
import { DEFAULT_POLICY, VICTIM_OPTIONS, type VictimOption } from "./agencyBranch";
import { LINK_GROUND_MODES, jumpCancelFrame, modeStarts } from "./comboLinkModes";
import { type BranchStick, branchFollowUps, branchMove, branchOpen } from "./comboLinkBranches";
import { type Region, REGIONS, landedRegion } from "./comboLinkRegions";
import { onShield } from "./comboLinkShield";
import {
  AERIAL_HEIGHTS, AIR_MODES, DASH_GRAB, DIS, type Defender, type Di, FINE_FRAMES, GATE_X, GATE_Z, type Mode, type Move,
  OPENERS, type Opener, type Saved, SPACINGS, STAND, Sim, defenderMask, free, openerRoot, owned, settled, setupFor, started, startedOf,
} from "./comboExplorer";

export const LINK_PERCENTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] as const;
export const LINK_WEIGHTS = [60, 75, 100, 143] as const;
export const LINK_VICTIM = Character.rifleman;
export const FOLLOW_UPS: readonly string[] = [
  ...OPENERS.filter((opener) => opener.throw === undefined && opener.move.kind === "ground").map((opener) => opener.name),
  "grab",
  ...OPENERS.filter((opener) => opener.throw === undefined && opener.move.kind !== "ground").map((opener) => opener.name),
];

export type LinkClass = "true" | "DI-dependent" | "read" | "none";

export const SLACK = DEFAULT_POLICY.slack;
const LIMIT = 150;
export const CANDIDATES = 4;
const SETUP_SPACINGS: readonly number[] = [...new Set([...SPACINGS, ...Array.from({ length: 30 }, (_, index) => (index + 1) * 10)])];
const SETUP_HEIGHTS: readonly (readonly [number, number])[] = [...AERIAL_HEIGHTS, ...[20, 60, 80, 120, 140, 160].map((height) => [height, 0] as const)];
const NEUTRAL = neutralControls();
const TECH_LEAD_FRAMES = 10;

export interface LinkRow {
  readonly fighter: string;
  readonly opener: string;
  readonly region: Region;
  readonly percent: number;
  readonly weight: number;
  readonly followUp: string;
  readonly advantage?: number;
  readonly ko?: true;
  readonly angle?: number;
  readonly ledgeKo?: true;
  readonly shieldAdvantage?: number;
  readonly shieldDamage?: number;
  readonly shieldBreak?: true;
  readonly reach: boolean;
  readonly contact?: number;
  readonly input?: string;
  readonly class: LinkClass;
  readonly diEscapes: readonly Di[];
  readonly optionEscapes: readonly string[];
}

export interface LinkOpener {
  readonly attacker: Character;
  readonly opener: number;
  readonly melee?: readonly string[];
}

export interface LinkUnit extends LinkOpener {
  readonly percents?: readonly number[];
}

const NO_DI: Defender = { name: "none", di: "none" };

interface Standing {
  readonly advantage: number;
  readonly gap: number;
}

function standingAfter(sim: Sim, from: Saved): Standing {
  const idle = idleTrack(sim, from, NO_DI);
  if (idle === "ko") return { advantage: LIMIT, gap: 0 };
  if (idle === undefined) return { advantage: -LIMIT, gap: Infinity };
  release(idle);
  return { advantage: idle.free - idle.start, gap: Math.abs((idle.bx[idle.start] ?? 0) - (idle.ax[idle.start] ?? 0)) };
}

interface Approach {
  readonly setup: ComboSetup;
  readonly opener: Opener;
}

type Measured = Approach & Standing;

function approachesFor(attacker: Character, victim: Character, opener: Opener): Map<Region, readonly Approach[]> {
  const most = new Map<Region, Measured>();
  const closest = new Map<Region, Measured>();
  const airborne = opener.airborne === true;
  const variants = airborne || branchFollowUps(attacker, opener).length > 0 ? [opener, { ...opener, drift: true }] : [opener];
  for (const variant of variants) for (const height of airborne ? SETUP_HEIGHTS : [[0, 0] as const]) for (const spacing of SETUP_SPACINGS) {
    const setup: ComboSetup = { ...setupFor(attacker, victim, opener, 0, "centre", spacing, height), defenderWeight: 75 };
    const played = openerRoot(setup, variant, NO_DI);
    if (played === undefined) continue;
    const region = landedRegion(played.sim, opener);
    const measured: Measured = { setup, opener: variant, ...standingAfter(played.sim, played.root.saved) };
    free(played.root.saved);
    if (measured.advantage > (most.get(region)?.advantage ?? -Infinity)) most.set(region, measured);
    if (measured.advantage > 0 && measured.gap < (closest.get(region)?.gap ?? Infinity)) closest.set(region, measured);
  }
  return new Map([...most].map(([region, best]) => {
    const near = closest.get(region);
    return [region, near === undefined || near === best ? [best] : [best, near]];
  }));
}

const CLASS_RANK: Readonly<Record<LinkClass, number>> = { none: 0, read: 1, "DI-dependent": 2, true: 3 };

function approachRows(attacker: Character, approaches: readonly Approach[], region: Region, percent: number, weight: number): LinkRow[] {
  const [first, ...rest] = approaches.map((approach) => cellRows(attacker, approach, region, percent, weight)).filter((rows) => rows.length > 0);
  if (first === undefined) return [];
  return first.map((row, index) => rest.reduce((best, rows) => {
    const other = rows[index];
    return other !== undefined && (CLASS_RANK[other.class] > CLASS_RANK[best.class] || (other.class === best.class && other.diEscapes.length < best.diEscapes.length)) ? other : best;
  }, row));
}

interface Track {
  readonly ax: number[];
  readonly az: number[];
  readonly avx: number[];
  readonly loose: boolean[];
  readonly attacker: number[];
  readonly saved: (Saved | undefined)[];
}

const emptyTrack = (): Track => ({ ax: [], az: [], avx: [], loose: [], attacker: [], saved: [] });
const release = (track: Track): void => {
  for (const saved of track.saved) if (saved !== undefined) free(saved);
  track.saved.length = 0;
};

interface Idle extends Track {
  readonly bx: readonly number[];
  readonly bz: readonly number[];
  readonly grounded: readonly boolean[];
  readonly branch: readonly boolean[];
  readonly actionable: boolean;
  readonly start: number;
  readonly jumpCancel: number | undefined;
  readonly free: number;
  readonly window: number;
}

function idleTrack(sim: Sim, from: Saved, d: Defender): Idle | "ko" | undefined {
  sim.load(from);
  const track = emptyTrack();
  const bx: number[] = [];
  const bz: number[] = [];
  const grounded: boolean[] = [];
  const branch: boolean[] = [];
  const stocks = sim.b.status.stocks;
  let freeAt = LIMIT + 1;
  let start = -1;
  let firstBranch = -1;
  let wasTumbling = sim.b.down.state === DownState.tumble && !sim.b.motion.grounded;
  for (let n = 1; n <= LIMIT && (start < 0 || n <= freeAt + SLACK); n++) {
    const a = sim.a;
    const b = sim.b;
    if (start < 0 && canAttack(a)) start = n;
    branch[n] = branchOpen(a);
    if (firstBranch < 0 && branch[n] === true) firstBranch = n;
    track.ax[n] = a.motion.x;
    track.az[n] = a.motion.z;
    track.avx[n] = a.motion.vx;
    grounded[n] = a.motion.grounded;
    track.loose[n] = !owned(b);
    track.saved[n] = sim.save();
    track.attacker.push(0);
    sim.step(0, defenderMask(d, n, undefined, b, a));
    if (sim.b.status.stocks < stocks) {
      release(track);
      return "ko";
    }
    bx[n] = b.motion.x;
    bz[n] = b.motion.z;
    const landed = wasTumbling && b.motion.grounded;
    wasTumbling = b.down.state === DownState.tumble && !b.motion.grounded;
    if (freeAt > LIMIT && landed) freeAt = n;
    else if (freeAt > LIMIT && settled(b)) freeAt = n + 1;
  }
  if (start < 0 && firstBranch < 0) {
    release(track);
    return undefined;
  }
  const jumpCancel = start > 0 ? jumpCancelFrame(sim, track.saved, d, start) : undefined;
  return { ...track, bx, bz, grounded, branch, actionable: start >= 0, start: start >= 0 ? start : firstBranch, jumpCancel, free: freeAt, window: Math.min(LIMIT, freeAt + SLACK) };
}

function modeTrack(sim: Sim, from: Saved, d: Defender, idle: Idle, mode: Mode, start: number, earliest: number): Track {
  sim.load(from);
  const track = emptyTrack();
  for (let n = 1; n <= idle.window; n++) {
    const a = sim.a;
    const b = sim.b;
    track.ax[n] = a.motion.x;
    track.az[n] = a.motion.z;
    track.avx[n] = a.motion.vx;
    track.loose[n] = !owned(b);
    if (n >= earliest) track.saved[n] = sim.save();
    const am = mode.hold(n, start, a, b);
    track.attacker.push(am);
    sim.step(am, defenderMask(d, n, undefined, b, a));
  }
  return track;
}

interface Candidate {
  readonly followUp: string;
  readonly input: string;
  readonly k: number;
  readonly contact: number;
  readonly loose: boolean;
  readonly attacker: readonly number[];
  readonly grab: boolean;
  readonly run: string;
}

function strike(sim: Sim, d: Defender, track: Track, k: number, mode: Mode, start: number, move: Move, window: number): Candidate | undefined {
  const saved = track.saved[k];
  if (saved === undefined) return undefined;
  sim.load(saved);
  const before = startedOf(sim.a);
  let hits = sim.b.visuals.hit;
  const holds = sim.b.grab.owner;
  const attacker = track.attacker.slice(0, k - 1);
  let loose = track.loose.slice(1, k).some(Boolean);
  let begun = false;
  const grab = move.kind === "grab";
  const found = (n: number): Candidate => ({
    followUp: move === DASH_GRAB ? "grab" : move.name, input: `${mode.name}, ${move.name} pressed ${k} frames after the hit`,
    k, contact: n, loose, attacker, grab, run: `${mode.name} from ${start}`,
  });
  for (let n = k; n <= window; n++) {
    const a = sim.a;
    const b = sim.b;
    loose ||= !owned(b);
    const stick = mode.after(a, b);
    const am = n === k ? move.press(a, b) | (move.kind === "air" && move.style !== AttackStyle.neutralAir ? stick : 0) : stick;
    attacker.push(am);
    sim.step(am, defenderMask(d, n, undefined, b, a));
    if (!begun && started(sim.a, before)) begun = true;
    if (grab && begun && sim.b.grab.owner === 0 && holds === undefined) return found(n);
    if (sim.b.visuals.hit !== hits) {
      if (begun) return found(n);
      hits = sim.b.visuals.hit;
    }
    if (begun && canAttack(sim.a) && !sim.a.projectiles.some((p) => p.life > 0)) return undefined;
  }
  return undefined;
}

function branchStrikes(sim: Sim, d: Defender, idle: Idle, sticks: readonly BranchStick[], add: (found: Candidate | undefined) => void): void {
  const firstBranch = idle.branch.findIndex((open) => open === true);
  if (firstBranch <= 0) return;
  for (let k = firstBranch; k <= idle.window; k += k < firstBranch + FINE_FRAMES ? 1 : 2) {
    if (idle.branch[k] !== true) continue;
    for (const stick of sticks) add(strike(sim, d, idle, k, STAND, firstBranch, branchMove(stick), idle.window));
  }
}

function candidates(sim: Sim, from: Saved, d: Defender, idle: Idle, sticks: readonly BranchStick[]): Map<string, Candidate[]> {
  sim.load(from);
  const byFollowUp = new Map<string, Candidate[]>();
  const add = (found: Candidate | undefined): void => {
    if (found === undefined) return;
    const own = byFollowUp.get(found.followUp) ?? [];
    own.push(found);
    byFollowUp.set(found.followUp, own);
  };
  branchStrikes(sim, d, idle, sticks, add);
  const modes = !idle.actionable ? [] : sim.a.motion.grounded || idle.grounded[idle.start] === true ? LINK_GROUND_MODES : AIR_MODES;
  for (const [mode, start] of modeStarts(modes, idle.start, idle.jumpCancel)) {
    sim.load(from);
    const earliest = mode.earliest(start, sim.a);
    if (earliest > idle.window) continue;
    const track = mode === STAND ? idle : modeTrack(sim, from, d, idle, mode, start, earliest);
    for (let k = earliest; k <= idle.window; k += k < earliest + FINE_FRAMES ? 1 : 2) {
      const saved = track.saved[k];
      if (saved === undefined) continue;
      sim.load(saved);
      for (const move of mode.moves(sim.a)) {
        sim.load(saved);
        if (move.kind === "grab" && !canBeGrabbed(sim.b)) continue;
        const startup = move.style === undefined ? 1 : attackStartupFrames(move.style, sim.a.tuning.moves);
        const contact = k + startup;
        if (contact > idle.window) continue;
        if (move.kind !== "special") {
          const ahead = f32((track.ax[k] ?? 0) + f32((track.avx[k] ?? 0) * startup));
          if (Math.abs((idle.bx[contact] ?? 0) - ahead) > GATE_X || Math.abs((idle.bz[contact] ?? 0) - (track.az[k] ?? 0)) > GATE_Z) continue;
        }
        add(strike(sim, d, track, k, mode, start, move, idle.window));
      }
    }
    if (track !== idle) release(track);
  }
  for (const own of byFollowUp.values()) own.sort((x, y) => x.contact - y.contact);
  return byFollowUp;
}

function landsWithin(sim: Sim, b: Readonly<Fighter>, frames: number): boolean {
  const fall = -totalVelocityZ(b);
  if (b.motion.grounded || fall <= 0) return false;
  const floor = floorBelow(sim.setup.stage, sim.scene.runtime.simulationFrame, b.motion.x, b.motion.z);
  return floor !== undefined && b.motion.z - floor <= fall * frames;
}

function stepVictim(sim: Sim, n: number, d: Defender, am: number, option: VictimOption | undefined, acted: { k: number; away: number }): void {
  const a = sim.a;
  const b = sim.b;
  const acting = option !== undefined && (!owned(b) || (option.beforeLanding === true && landsWithin(sim, b, TECH_LEAD_FRAMES)));
  if (acting && acted.k === 0) acted.away = Math.sign(b.motion.x - a.motion.x) || 1;
  if (acting) acted.k++;
  const bm = defenderMask(d, n, undefined, b, a);
  frameSteered(sim.scene, (slot) => (slot === 0 ? am : slot === 1 ? bm : 0), (controls, slot) => {
    if (slot !== 1 || !acting) return;
    copyControls(controls, NEUTRAL);
    option.press(controls, acted.k, acted.away);
  });
}

function landsAgainst(sim: Sim, from: Saved, d: Defender, candidate: Candidate, option: VictimOption | undefined): boolean {
  sim.load(from);
  const acted = { k: 0, away: 1 };
  let before = startedOf(sim.a);
  let hits = sim.b.visuals.hit;
  let holds = sim.b.grab.owner;
  let begun = false;
  for (let n = 1; n <= candidate.attacker.length; n++) {
    if (n === candidate.k) {
      before = startedOf(sim.a);
      hits = sim.b.visuals.hit;
      holds = sim.b.grab.owner;
    }
    stepVictim(sim, n, d, candidate.attacker[n - 1] ?? 0, option, acted);
    if (n < candidate.k) continue;
    if (!begun && started(sim.a, before)) begun = true;
    if (candidate.grab && begun && sim.b.grab.owner === 0 && holds === undefined) return true;
    if (sim.b.visuals.hit !== hits) {
      if (begun) return true;
      hits = sim.b.visuals.hit;
    }
  }
  return false;
}

function liveOptions(sim: Sim, from: Saved, d: Defender, idle: Idle): VictimOption[] {
  const ends = VICTIM_OPTIONS.map((option) => {
    sim.load(from);
    const acted = { k: 0, away: 1 };
    for (let n = 1; n <= idle.window; n++) stepVictim(sim, n, d, 0, option, acted);
    const saved = sim.save();
    const end = stateChecksum(saved.state);
    free(saved);
    return end;
  });
  return VICTIM_OPTIONS.filter((_, index) => index > 0 && ends[index] !== ends[0]);
}

interface DiOutcome {
  readonly contact: number;
  readonly input: string;
  readonly escapes: readonly string[];
}

interface CellLinks {
  readonly ko: boolean;
  readonly advantage: number;
  readonly byFollowUp: ReadonlyMap<string, DiOutcome>;
}

const shortlist = (own: readonly Candidate[]): Candidate[] =>
  [...Map.groupBy(own, (candidate) => candidate.run).values()].flatMap((run) => run.slice(0, CANDIDATES)).sort((x, y) => x.contact - y.contact);

function linkCell(sim: Sim, from: Saved, d: Defender, sticks: readonly BranchStick[]): CellLinks | undefined {
  const idle = idleTrack(sim, from, d);
  if (idle === undefined) return undefined;
  if (idle === "ko") return { ko: true, advantage: 0, byFollowUp: new Map() };
  const found = candidates(sim, from, d, idle, sticks);
  const options = [...found.values()].some((own) => own.some((candidate) => candidate.loose)) ? liveOptions(sim, from, d, idle) : [];
  const byFollowUp = new Map<string, DiOutcome>();
  for (const [followUp, own] of found) {
    let best: { readonly candidate: Candidate; readonly escapes: readonly string[] } | undefined;
    for (const candidate of shortlist(own)) {
      if (!landsAgainst(sim, from, d, candidate, undefined)) throw new Error(`${followUp} (${candidate.input}) lands in the search but not on replay`);
      const escapes = candidate.loose ? options.filter((option) => !landsAgainst(sim, from, d, candidate, option)).map((option) => option.id) : [];
      if (best === undefined || escapes.length < best.escapes.length) best = { candidate, escapes };
      if (escapes.length === 0) break;
    }
    if (best !== undefined) byFollowUp.set(followUp, { contact: best.candidate.contact, input: best.candidate.input, escapes: best.escapes });
  }
  release(idle);
  return { ko: false, advantage: idle.free - idle.start, byFollowUp };
}

function classOf(outcomes: ReadonlyMap<Di, DiOutcome | undefined>, surviving: readonly Di[]): LinkClass {
  const reaching = surviving.filter((di) => outcomes.get(di) !== undefined);
  const clean = reaching.filter((di) => outcomes.get(di)?.escapes.length === 0);
  if (clean.length > 0 && clean.length === surviving.length) return "true";
  if (clean.length > 0) return "DI-dependent";
  return reaching.length > 0 ? "read" : "none";
}

const launchAngle = (sim: Sim): number | undefined => {
  const { a, b } = sim;
  if (b.motion.grounded) return undefined;
  const away = Math.sign(b.motion.x - a.motion.x) || 1;
  return Math.round((Math.atan2(b.launch.knockbackZ, b.launch.knockbackX * away) * 180) / Math.PI);
};

function koesAt(setup: ComboSetup, opener: Opener, region: Region): boolean {
  const d: Defender = { name: "none", di: "none" };
  const played = openerRoot(setup, opener, d);
  if (played === undefined) return false;
  const idle = landedRegion(played.sim, opener) === region ? idleTrack(played.sim, played.root.saved, d) : undefined;
  free(played.root.saved);
  if (idle === "ko") return true;
  if (idle !== undefined) release(idle);
  return false;
}

function cellRows(attacker: Character, { setup, opener }: Approach, region: Region, percent: number, weight: number): LinkRow[] {
  const sticks = branchFollowUps(attacker, opener);
  let angle: number | undefined;
  const cells = new Map<Di, CellLinks | undefined>();
  for (const di of DIS) {
    const d: Defender = { name: di, di };
    const played = openerRoot({ ...setup, percent, defenderWeight: weight }, opener, d);
    if (played === undefined) continue;
    if (landedRegion(played.sim, opener) === region) {
      if (di === "none") angle = launchAngle(played.sim);
      cells.set(di, linkCell(played.sim, played.root.saved, d, sticks));
    }
    free(played.root.saved);
  }
  const none = cells.get("none");
  if (none === undefined) return [];
  const spacing = f32(setup.defenderX - setup.attackerX);
  const ledge = { ...setupFor(attacker, setup.defender, opener, percent, "ledge", spacing, [setup.attackerZ, setup.defenderZ]), defenderWeight: weight };
  const ledgeKo = koesAt(ledge, opener, region);
  const shield = onShield({ ...setup, defenderWeight: weight }, opener, LIMIT);
  const surviving = DIS.filter((di) => cells.get(di)?.ko !== true);
  return [...FOLLOW_UPS, ...sticks.map((stick) => stick.name)].map((followUp) => {
    const outcomes = new Map<Di, DiOutcome | undefined>(DIS.map((di) => [di, cells.get(di)?.byFollowUp.get(followUp)]));
    const own = outcomes.get("none");
    const escapes = new Set(DIS.flatMap((di) => outcomes.get(di)?.escapes ?? []));
    return {
      fighter: fighterName(attacker), opener: opener.name, region, percent, weight, followUp,
      ...(none.ko ? { ko: true } : { advantage: none.advantage }),
      ...(angle === undefined ? {} : { angle }), ...(ledgeKo ? { ledgeKo: true } : {}),
      ...(shield === undefined ? {} : { shieldAdvantage: shield.shieldAdvantage, shieldDamage: shield.shieldDamage, ...(shield.shieldBreak ? { shieldBreak: true } : {}) }),
      reach: own !== undefined,
      ...(own === undefined ? {} : { contact: own.contact, input: own.input }),
      class: classOf(outcomes, surviving),
      diEscapes: surviving.filter((di) => outcomes.get(di)?.escapes.length !== 0),
      optionEscapes: VICTIM_OPTIONS.map((option) => option.id).filter((id) => escapes.has(id)),
    };
  });
}

function openerAt(index: number): Opener {
  const opener = OPENERS[index];
  if (opener === undefined) throw new Error(`no opener ${index}`);
  return opener;
}

export function measureLinks(unit: LinkUnit): LinkRow[] {
  const approaches = approachesFor(unit.attacker, LINK_VICTIM, openerAt(unit.opener));
  return REGIONS.flatMap((region) => {
    const own = approaches.get(region);
    if (own === undefined) return [];
    return (unit.percents ?? LINK_PERCENTS).flatMap((percent) => LINK_WEIGHTS.flatMap((weight) => approachRows(unit.attacker, own, region, percent, weight)));
  });
}

export interface LinkCell extends LinkOpener {
  readonly victim: Character;
  readonly region: Region;
  readonly percent: number;
  readonly weight: number;
}

export function measureLinkCell(cell: LinkCell): LinkRow[] {
  const own = approachesFor(cell.attacker, cell.victim, openerAt(cell.opener)).get(cell.region);
  return own === undefined ? [] : approachRows(cell.attacker, own, cell.region, cell.percent, cell.weight);
}
