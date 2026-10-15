import { parseArgs } from "node:util";
import { stateChecksum } from "../src/game/replay/canonical";
import { type ReplayState, captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot } from "../src/game/replay/snapshot";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { captureFrame, executeMatchFrame } from "../src/game/match/frameInput";
import { produceComputerInput } from "../src/game/match/botPlay";
import { isCpuTier } from "../src/game/match/cpuProfiles";
import { observeDamageContacts } from "../src/game/sim/contacts";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { type Controls, copyControls, fighterAt, neutralControls } from "../src/game/sim/roster";
import { type OptionWeights, type BranchOutcome, conversion, linkEscape } from "./agencyCore";
import { type FieldMatch, openFieldMatch } from "./cpuField";
import { DEFAULT_CONFIG, type Combo, type MatchSpec, planMatches } from "./playtestCore";
import { ROSTER, playReal } from "./playtest";

const NEUTRAL = neutralControls();

type Slot = 0 | 1;

/** A victim's scripted option: how it fills the victim's controls on the k-th frame (1-based) of a branch, `away` being the horizontal sign from the attacker. */
export interface VictimOption {
  readonly id: string;
  readonly press: (input: Controls, k: number, away: number) => void;
}

const DIRECTIONS: readonly (readonly [string, number, number])[] = [
  ["left", -1, 0], ["right", 1, 0], ["up", 0, 1], ["down", 0, -1], ["up-left", -1, 1], ["up-right", 1, 1], ["down-left", -1, -1], ["down-right", 1, -1],
];
const PULSE = 4;
const pulse = (k: number, every = PULSE): boolean => k % every === 1;

const sides: readonly (readonly [string, number])[] = [["in-place", 0], ["away", 1], ["toward", -1]];

/** Every control the victim can use, each held or pulsed for the whole branch; options the sim ignores at that state collapse into neutral and are dropped. */
export const VICTIM_OPTIONS: readonly VictimOption[] = [
  { id: "neutral", press: () => {} },
  ...DIRECTIONS.map(([name, x, z]): VictimOption => ({ id: `hold-${name}`, press: (input) => { input.direction = x; input.verticalDirection = z; } })),
  { id: "jump", press: (input, k) => { input.jumpPressed = pulse(k); } },
  ...sides.map(([name, side]): VictimOption => ({
    id: `air-dodge-${name}`,
    press: (input, k, away) => { input.airDodgePressed = pulse(k); input.direction = side * away; input.dodgeX = side * away; },
  })),
  { id: "shield", press: (input, k) => { input.shield = true; input.shieldTriggerActive = true; input.shieldPressed = pulse(k); input.shieldStrength = 1.0; } },
  ...sides.map(([name, side]): VictimOption => ({
    id: `tech-${name}`,
    press: (input, k, away) => { input.techPressed = pulse(k, 3); input.direction = side * away; },
  })),
  { id: "getup-stand", press: (input, k) => { input.getupStandPressed = pulse(k); } },
  { id: "getup-attack", press: (input, k) => { input.getupAttackPressed = pulse(k); } },
  ...sides.filter(([, side]) => side !== 0).map(([name, side]): VictimOption => ({
    id: `getup-roll-${name}`,
    press: (input, k, away) => { input.getupDirectionPressed = pulse(k); input.getupDirection = side * away; },
  })),
  { id: "attack", press: (input, k) => { input.attackPressed = pulse(k); input.attackRequested = true; } },
  { id: "special", press: (input, k) => { input.specialPressed = pulse(k); } },
];

/** The measurement policy: a link escapes when the attacker's next hit does not land within the recorded gap to it plus `slack` frames, with the attacker's computer re-planning in every branch. */
export interface BranchPolicy {
  readonly slack: number;
  readonly maxHorizon: number;
  readonly weights: OptionWeights;
}

export const DEFAULT_POLICY: BranchPolicy = { slack: 12, maxHorizon: 120, weights: {} };

export interface LinkMeasure {
  /** Index of the hit that opens the link; the link runs to hit `link + 1`. */
  readonly link: number;
  readonly frame: number;
  readonly nextFrame: number;
  readonly horizon: number;
  /** The recorded gap to the next hit plus slack exceeded the policy cap, so the escape is measured over a shorter window than the string itself waited. */
  readonly truncated: boolean;
  /** Whether the victim computer's own play escaped, which the recorded string says it did not. */
  readonly computerEscaped: boolean;
  readonly options: readonly BranchOutcome[];
  /** Options whose branch ended in the neutral branch's exact state: they changed nothing at this frame. */
  readonly inert: readonly string[];
  readonly escape: number;
}

export interface StringMeasure {
  readonly spec: MatchSpec;
  readonly moves: readonly string[];
  readonly links: readonly LinkMeasure[];
  readonly conversion: number;
}

const advance = (opened: FieldMatch, victim: Slot, press: ((input: Controls) => void) | undefined): number => {
  const { match, world, controls, produced, runtime, row } = opened;
  const frame = runtime.simulationFrame + 1;
  for (const slot of PARTICIPANT_SLOTS) {
    copyControls(produced.inputs[slot], NEUTRAL);
    clearAttackBuffer(produced.commands[slot]);
    if (slot === 0 || slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot], undefined);
  }
  if (press !== undefined) {
    copyControls(produced.inputs[victim], NEUTRAL);
    clearAttackBuffer(produced.commands[victim]);
    press(produced.inputs[victim]);
  }
  if (!captureFrame(row, frame, world.mask, produced, runtime)) throw new Error(`capture refused frame ${frame}`);
  if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
  return frame;
};

interface Branch {
  readonly escaped: boolean;
  readonly end: string;
}

/** Plays `horizon` frames from `from` with the victim's controls scripted and reports whether the victim was hit again and the state reached. */
function runBranch(opened: FieldMatch, from: ReplayState, scratch: ReplayState, victim: Slot, horizon: number, hit: () => boolean, option: VictimOption | undefined): Branch {
  const { match, world, controls, runtime } = opened;
  restoreReplaySnapshot(from, world, match, controls, runtime);
  const away = Math.sign(fighterAt(world, victim).motion.x - fighterAt(world, 1 - victim as Slot).motion.x) || 1;
  let hitAgain = false;
  for (let k = 1; k <= horizon && !hitAgain; k++) {
    advance(opened, victim, option === undefined ? undefined : (input) => option.press(input, k, away));
    hitAgain = hit();
  }
  captureReplaySnapshot(scratch, world, match, controls, runtime);
  return { escaped: !hitAgain, end: stateChecksum(scratch) };
}

/** Replays the recorded match to each hit of the string, then branches every victim option from the state just after it. */
export function measureString(spec: MatchSpec, combo: Combo, frameCap: number, policy: BranchPolicy = DEFAULT_POLICY): StringMeasure {
  const a = selectableCharacterBySlug(spec.a);
  const b = selectableCharacterBySlug(spec.b);
  if (a === undefined || b === undefined || !isCpuTier(spec.tier)) throw new Error(`cannot play ${spec.a} against ${spec.b} at ${spec.tier}`);
  const opened = openFieldMatch(a, b, spec.stage, 0, { tiers: [spec.tier, spec.tier], frameCap, playtest: true }, spec.seed);
  if (opened === undefined) throw new Error(`no spawn for ${spec.stage}`);
  const victim: Slot = combo.victim === 0 ? 0 : 1;
  const linkFrames = combo.hitFrames.slice(0, -1);
  const last = combo.hitFrames.at(-1) ?? 0;
  const snapshots = new Map<number, ReplayState>();
  let contact = false;
  observeDamageContacts((source, target) => {
    if (target === victim && source !== target) contact = true;
  });
  try {
    const hits = new Set<number>();
    let frame = 0;
    while (frame < last) {
      contact = false;
      frame = advance(opened, victim, undefined);
      if (contact) hits.add(frame);
      if (linkFrames.includes(frame)) {
        const snapshot = createReplaySnapshot();
        captureReplaySnapshot(snapshot, opened.world, opened.match, opened.controls, opened.runtime);
        snapshots.set(frame, snapshot);
      }
    }
    const missing = combo.hitFrames.filter((at) => !hits.has(at));
    if (missing.length > 0) throw new Error(`replay of ${spec.a} v ${spec.b} seed ${spec.seed} lost hits at frames ${missing.join(", ")}`);
    const scratch = createReplaySnapshot();
    const links: LinkMeasure[] = [];
    for (const [link, frame] of linkFrames.entries()) {
      const from = snapshots.get(frame);
      const nextFrame = combo.hitFrames[link + 1];
      if (from === undefined || nextFrame === undefined) continue;
      const wanted = nextFrame - frame + policy.slack;
      const horizon = Math.min(policy.maxHorizon, wanted);
      const play = (option: VictimOption | undefined): Branch => {
        contact = false;
        return runBranch(opened, from, scratch, victim, horizon, () => contact, option);
      };
      const computer = play(undefined);
      const neutral = play(VICTIM_OPTIONS[0]);
      const options: BranchOutcome[] = [{ option: "neutral", escaped: neutral.escaped }];
      const inert: string[] = [];
      for (const option of VICTIM_OPTIONS.slice(1)) {
        const branch = play(option);
        if (branch.end === neutral.end) inert.push(option.id);
        else options.push({ option: option.id, escaped: branch.escaped });
      }
      links.push({ link, frame, nextFrame, horizon, truncated: wanted > horizon, computerEscaped: computer.escaped, options, inert, escape: linkEscape(options, policy.weights) });
    }
    return { spec, moves: combo.moves, links, conversion: conversion(links.map((link) => link.escape)) };
  } finally {
    observeDamageContacts(undefined);
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { first: { type: "string" }, count: { type: "string" }, repro: { type: "string" }, "min-hits": { type: "string" }, "max-strings": { type: "string" }, slack: { type: "string" }, horizon: { type: "string" }, out: { type: "string" } },
    strict: true,
  });
  const policy: BranchPolicy = { ...DEFAULT_POLICY, slack: Number(values.slack ?? DEFAULT_POLICY.slack), maxHorizon: Number(values.horizon ?? DEFAULT_POLICY.maxHorizon) };
  const specs = values.repro === undefined ? planMatches(ROSTER, Number(values.first ?? 0), Number(values.count ?? 1)) : planMatches(ROSTER, Number(values.repro), 1);
  const minHits = Number(values["min-hits"] ?? 2);
  let budget = Number(values["max-strings"] ?? 20);
  const measured: StringMeasure[] = [];
  for (const spec of specs) {
    const observed = playReal(spec, DEFAULT_CONFIG.frameCap);
    for (const combo of observed.combos) {
      if (budget <= 0 || combo.hitFrames.length < minHits) continue;
      budget--;
      measured.push(measureString(spec, combo, DEFAULT_CONFIG.frameCap, policy));
    }
  }
  const text = JSON.stringify(measured, null, 1);
  if (values.out === undefined) console.log(text);
  else await Bun.write(values.out, `${text}\n`);
  console.error(`${measured.length} strings, ${measured.reduce((sum, string) => sum + string.links.length, 0)} links`);
}
