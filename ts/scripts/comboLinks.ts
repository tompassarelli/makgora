import { f32 } from "wisp/src/sim/f32";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { frameSteered } from "../src/game/match/padScene";
import { stateChecksum } from "../src/game/replay/canonical";
import { AttackStyle, Character, DownState } from "../src/game/sim/codes";
import { canAttack, canBeGrabbed } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { fighterName } from "../src/game/sim/heroes/registry";
import { attackStartupFrames } from "../src/game/sim/moves";
import { copyControls, neutralControls } from "../src/game/sim/roster";
import { DEFAULT_POLICY, VICTIM_OPTIONS, type VictimOption } from "./agencyBranch";
import {
  AERIAL_HEIGHTS, AIR_MODES, DASH_GRAB, DIS, type Defender, type Di, FINE_FRAMES, GATE_X, GATE_Z, GROUND_MODES, type Mode, type Move,
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

export type Region = "clean" | "late" | "sweet" | "sour";
export const REGIONS: readonly Region[] = ["clean", "late", "sweet", "sour"];
export type LinkClass = "true" | "DI-dependent" | "read" | "none";

const SLACK = DEFAULT_POLICY.slack;
const LIMIT = 150;
const CANDIDATES = 4;
const SETUP_SPACINGS: readonly number[] = [...new Set([...SPACINGS, ...Array.from({ length: 30 }, (_, index) => (index + 1) * 10)])];
const SETUP_HEIGHTS: readonly (readonly [number, number])[] = [...AERIAL_HEIGHTS, ...[20, 60, 80, 120, 140, 160].map((height) => [height, 0] as const)];
const NEUTRAL = neutralControls();

export interface LinkRow {
  readonly fighter: string;
  readonly opener: string;
  readonly region: Region;
  readonly percent: number;
  readonly weight: number;
  readonly followUp: string;
  readonly advantage?: number;
  readonly ko?: true;
  readonly reach: boolean;
  readonly contact?: number;
  readonly input?: string;
  readonly class: LinkClass;
  readonly diEscapes: readonly Di[];
  readonly optionEscapes: readonly string[];
}

export interface LinkUnit {
  readonly attacker: Character;
  readonly opener: number;
}

interface Regions {
  readonly strong: Region;
  readonly weak: Region | undefined;
}

function regionsOf(a: Readonly<Fighter>, opener: Opener): Regions {
  const moves = a.tuning.moves;
  const style = opener.move.style === AttackStyle.dashAttack ? moves?.dashAttack : opener.move.style;
  const authored = opener.throw !== undefined || style === undefined ? undefined : moves?.normals[style];
  const strong = authored?.regions.filter((region) => region.hit.effect.strong === true) ?? [];
  const weak = authored?.regions.filter((region) => region.hit.effect.strong !== true) ?? [];
  if (strong.length === 0 || weak.length === 0) return { strong: "clean", weak: undefined };
  const overlap = strong.some((s) => weak.some((w) => s.firstFrame <= w.lastFrame && w.firstFrame <= s.lastFrame));
  return overlap ? { strong: "sweet", weak: "sour" } : { strong: "clean", weak: "late" };
}

const landedRegion = (sim: Sim, opener: Opener): Region => {
  const regions = regionsOf(sim.a, opener);
  return sim.b.visuals.hitStrong ? regions.strong : regions.weak ?? regions.strong;
};

function setupsFor(attacker: Character, opener: Opener): Map<Region, ComboSetup> {
  const found = new Map<Region, ComboSetup>();
  const heights = opener.airborne === true ? SETUP_HEIGHTS : [[0, 0] as const];
  for (const height of heights) for (const spacing of SETUP_SPACINGS) {
    const setup: ComboSetup = { ...setupFor(attacker, LINK_VICTIM, opener, 0, "centre", spacing, height), defenderWeight: 75 };
    const played = openerRoot(setup, opener, { name: "none", di: "none" });
    if (played === undefined) continue;
    const region = landedRegion(played.sim, opener);
    if (!found.has(region)) found.set(region, setup);
    free(played.root.saved);
  }
  return found;
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
  readonly start: number;
  readonly free: number;
  readonly window: number;
}

function idleTrack(sim: Sim, from: Saved, d: Defender): Idle | "ko" | undefined {
  sim.load(from);
  const track = emptyTrack();
  const bx: number[] = [];
  const bz: number[] = [];
  const grounded: boolean[] = [];
  const stocks = sim.b.status.stocks;
  let freeAt = LIMIT + 1;
  let start = -1;
  let wasTumbling = sim.b.down.state === DownState.tumble && !sim.b.motion.grounded;
  for (let n = 1; n <= LIMIT && (start < 0 || n <= freeAt + SLACK); n++) {
    const a = sim.a;
    const b = sim.b;
    if (start < 0 && canAttack(a)) start = n;
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
  if (start < 0) {
    release(track);
    return undefined;
  }
  return { ...track, bx, bz, grounded, start, free: freeAt, window: Math.min(LIMIT, freeAt + SLACK) };
}

function modeTrack(sim: Sim, from: Saved, d: Defender, idle: Idle, mode: Mode, earliest: number): Track {
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
    const am = mode.hold(n, idle.start, a, b);
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
}

function strike(sim: Sim, d: Defender, track: Track, k: number, mode: Mode, move: Move, window: number): Candidate | undefined {
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
    k, contact: n, loose, attacker, grab,
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

function candidates(sim: Sim, from: Saved, d: Defender, idle: Idle): Map<string, Candidate[]> {
  sim.load(from);
  const byFollowUp = new Map<string, Candidate[]>();
  const modes = sim.a.motion.grounded || idle.grounded[idle.start] === true ? GROUND_MODES : AIR_MODES;
  for (const mode of modes) {
    sim.load(from);
    const earliest = mode.earliest(idle.start, sim.a);
    if (earliest > idle.window) continue;
    const track = mode === STAND ? idle : modeTrack(sim, from, d, idle, mode, earliest);
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
        const found = strike(sim, d, track, k, mode, move, idle.window);
        if (found === undefined) continue;
        const own = byFollowUp.get(found.followUp) ?? [];
        own.push(found);
        byFollowUp.set(found.followUp, own);
      }
    }
    if (track !== idle) release(track);
  }
  for (const own of byFollowUp.values()) own.sort((x, y) => x.contact - y.contact);
  return byFollowUp;
}

function stepVictim(sim: Sim, n: number, d: Defender, am: number, option: VictimOption | undefined, acted: { k: number; away: number }): void {
  const a = sim.a;
  const b = sim.b;
  const acting = option !== undefined && !owned(b);
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

function linkCell(sim: Sim, from: Saved, d: Defender): CellLinks | undefined {
  const idle = idleTrack(sim, from, d);
  if (idle === undefined) return undefined;
  if (idle === "ko") return { ko: true, advantage: 0, byFollowUp: new Map() };
  const found = candidates(sim, from, d, idle);
  const options = [...found.values()].some((own) => own.some((candidate) => candidate.loose)) ? liveOptions(sim, from, d, idle) : [];
  const byFollowUp = new Map<string, DiOutcome>();
  for (const [followUp, own] of found) {
    let best: { readonly candidate: Candidate; readonly escapes: readonly string[] } | undefined;
    for (const candidate of own.slice(0, CANDIDATES)) {
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
  if (reaching.length === 0) return "none";
  if (reaching.some((di) => (outcomes.get(di)?.escapes.length ?? 0) > 0)) return "read";
  return reaching.length === surviving.length ? "true" : "DI-dependent";
}

export function measureLinks(unit: LinkUnit): LinkRow[] {
  const opener = OPENERS[unit.opener];
  if (opener === undefined) throw new Error(`no opener ${unit.opener}`);
  const setups = setupsFor(unit.attacker, opener);
  const rows: LinkRow[] = [];
  for (const region of REGIONS) {
    const setup = setups.get(region);
    if (setup === undefined) continue;
    for (const percent of LINK_PERCENTS) for (const weight of LINK_WEIGHTS) {
      const cells = new Map<Di, CellLinks | undefined>();
      for (const di of DIS) {
        const d: Defender = { name: di, di };
        const played = openerRoot({ ...setup, percent, defenderWeight: weight }, opener, d);
        if (played === undefined) continue;
        if (landedRegion(played.sim, opener) === region) cells.set(di, linkCell(played.sim, played.root.saved, d));
        free(played.root.saved);
      }
      const none = cells.get("none");
      if (none === undefined) continue;
      const surviving = DIS.filter((di) => cells.get(di)?.ko !== true);
      for (const followUp of FOLLOW_UPS) {
        const outcomes = new Map<Di, DiOutcome | undefined>(DIS.map((di) => [di, cells.get(di)?.byFollowUp.get(followUp)]));
        const own = outcomes.get("none");
        const escapes = new Set(DIS.flatMap((di) => outcomes.get(di)?.escapes ?? []));
        rows.push({
          fighter: fighterName(unit.attacker), opener: opener.name, region, percent, weight, followUp,
          ...(none.ko ? { ko: true } : { advantage: none.advantage }), reach: own !== undefined,
          ...(own === undefined ? {} : { contact: own.contact, input: own.input }),
          class: classOf(outcomes, surviving),
          diEscapes: surviving.filter((di) => outcomes.get(di) === undefined),
          optionEscapes: VICTIM_OPTIONS.map((option) => option.id).filter((id) => escapes.has(id)),
        });
      }
    }
  }
  return rows;
}

const CLASS_MARK: Readonly<Record<LinkClass, string>> = { true: "T", "DI-dependent": "DI", read: "R", none: "·" };

export function linksPage(fighter: string, rows: readonly LinkRow[]): string {
  const sections = [...new Set(rows.map((row) => `${row.opener}|${row.region}`))];
  const missing = OPENERS.map((opener) => opener.name).filter((name) => !rows.some((row) => row.opener === name));
  return [
    `# ${fighter} links`, "",
    `Generated by \`bun wisp combos --links --fighter ${fighter.split(" ")[0]}\`; do not edit. Each opener hit, by region class, lands on ${fighterName(LINK_VICTIM)} at the stage's centre with its weight set to ${LINK_WEIGHTS.join(", ")} (Melee units; Fox is 75), at ${LINK_PERCENTS[0]}–${LINK_PERCENTS.at(-1)}% before the hit, under DI ${DIS.join(", ")}. For each follow-up the combo explorer's attacker inputs are searched for a hit that lands at most ${SLACK} frames after the victim can act, and the ${CANDIDATES} earliest are replayed against every victim option of the agency measure that changes where the victim ends up.`, "",
    "Classes, over the DIs the opener does not kill through: T true (every DI and every option is hit), DI DI-dependent (only some DI escape), R read (an option other than DI escapes), · none (no DI lets it land). Frame advantage is the victim's first actionable frame minus the attacker's, without DI; KO marks an opener that takes the stock without DI. The rows in the `.jsonl` beside this page add each follow-up's input, contact frame and escapes.", "",
    ...(missing.length === 0 ? [] : [`No setup lands a hit with ${missing.join(", ")}, so ${missing.length === 1 ? "it has" : "they have"} no rows.`, ""]),
    ...sections.flatMap((section) => {
      const [opener, region] = section.split("|");
      const own = rows.filter((row) => row.opener === opener && row.region === region);
      const percents = LINK_PERCENTS.filter((percent) => own.some((row) => row.percent === percent));
      const at = (weight: number, percent: number, followUp?: string) =>
        own.find((row) => row.weight === weight && row.percent === percent && (followUp === undefined || row.followUp === followUp));
      const advantage = (weight: number, percent: number): string => {
        const row = at(weight, percent);
        return row === undefined ? "" : row.advantage === undefined ? "KO" : `${row.advantage > 0 ? "+" : ""}${row.advantage}`;
      };
      const mark = (weight: number, percent: number, followUp: string): string => {
        const row = at(weight, percent, followUp);
        return row === undefined ? "" : CLASS_MARK[row.class];
      };
      return [
        `## ${opener} (${region})`, "",
        `| Link | Weight | ${percents.map((percent) => `${percent}%`).join(" | ")} |`,
        `| --- | --- | ${percents.map(() => "---").join(" | ")} |`,
        ...LINK_WEIGHTS.map((weight) => `| frame advantage | ${weight} | ${percents.map((percent) => advantage(weight, percent)).join(" | ")} |`),
        ...FOLLOW_UPS.flatMap((followUp) => LINK_WEIGHTS.map((weight) => `| ${opener} into ${followUp} | ${weight} | ${percents.map((percent) => mark(weight, percent, followUp)).join(" | ")} |`)),
        "",
      ];
    }),
  ].join("\n");
}
