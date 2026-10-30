import { canonicalNumber, canonicalReal, realParts, splitFiniteReal, writeCanonicalNumber } from "./canonicalNumbers";
import { fighterMovesCanonical, fighterSpecialsCanonical } from "./kitCanonical";
import { specialPlacementCanonical, specialProjectileCanonical } from "./specialCanonical";
import { type FighterFieldSink, type FighterKitText, writeFighterFields } from "../../generated/state/fighterState";





import { attackBufferCanonicalState } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, participantActive, type Slots } from "../input/participants";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { BotObservationFrame } from "../match/botPerception";
import type { FighterMoves } from "../sim/heroMoves";
import type { AuthoredSpecial, FighterSpecials, SpecialPlacement } from "../sim/specials/schema";
import { writeMatchItems } from "../match/items";
import { writeMatchOrbs } from "../sim/orbState";
import type { Fighter } from "../sim/fighter";
import { CONTROL_FIELDS, fighterAt, isActive } from "../sim/roster";
import { writeTrainingState } from "../match/trainingState";
import { writeConfiguredRun } from "../classic/runState";
import { CPU_OPPONENT_CHOICES, CPU_OPPONENT_IDS, CPU_TIERS } from "../match/cpuProfiles";
import { botStrategyValues } from "../match/botStrategy";
import type { ReplayState } from "./snapshot";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { HERO_ROSTER } from "../roster/kits";
import { ILLIDAN_MOVES, RIFLEMAN_MOVES } from "../sim/originalMoves";

const REPLAY_CHECKSUM_MODULUS = 1_000_003;

export function canonicalSlot(slot: number | undefined, participantMask: number): number {
  if (slot === undefined) return -1;
  return participantActive(participantMask, slot) ? slot : -2;
}


interface ChecksumLanes {
  valid: boolean;
  first: number;
  second: number;
}

function foldChecksum(lanes: ChecksumLanes, fragment: string): void {
  foldChecksumRange(lanes, fragment, 0, fragment.length);
}


function foldChecksumRange(lanes: ChecksumLanes, text: string, start: number, end: number): void {
  if (!lanes.valid) return;
  let { first, second } = lanes;
  for (let index = start; index < end; index++) {
    const byte = text.charCodeAt(index);
    if (byte < 32 || byte > 126) {
      lanes.valid = false;
      return;
    }

    first = floorMod(first * 257 + byte + 1, REPLAY_CHECKSUM_MODULUS);
    second = floorMod(second * 263 + byte + 1, REPLAY_CHECKSUM_MODULUS);
  }
  lanes.first = first;
  lanes.second = second;
}

const checksumText = ({ valid, first, second }: Readonly<ChecksumLanes>): string => (valid ? `${first}:${second}` : "invalid-ascii");

export function canonicalChecksum(text: string): string {
  const lanes: ChecksumLanes = { valid: true, first: 0, second: 0 };
  foldChecksum(lanes, text);
  return checksumText(lanes);
}


/** Where writeState sends each field: canonical text, or the per-frame state hash. */
interface StateSink extends FighterFieldSink {
  observation(name: string, sample: Readonly<BotObservationFrame>): void;
}


const fieldKeys: Record<string, Record<string, string | undefined> | undefined> = {};

function fieldKey(prefix: string, name: string): string {
  let byName = fieldKeys[prefix];
  if (byName === undefined) {
    byName = {};
    fieldKeys[prefix] = byName;
  }
  let key = byName[name];
  if (key === undefined) {
    key = prefix === "" ? `|${name}=` : `|${prefix}.${name}=`;
    byName[name] = key;
  }
  return key;
}






const MOVES_DIGESTS = new Map<Readonly<FighterMoves>, string>();
const SPECIALS_DIGESTS = new Map<Readonly<FighterSpecials>, string>();
const PLACEMENT_DIGESTS = new Map<Readonly<SpecialPlacement>, string>();
const placedSpecCanonical = (spec: Readonly<SpecialPlacement>): string => specialPlacementCanonical(spec, "placedSpec");
declare global {
  var __smashcraftKitDigests: Record<string, string | undefined> | undefined;
}


const retainedKitDigests: Record<string, string | undefined> = {};

function kitDigestField<K>(name: string, kit: K | undefined, digests: Map<K, string>, text: (kit: K) => string): string {
  if (kit === undefined) return "";
  let digest = digests.get(kit);
  if (digest === undefined) {
    const canonical = text(kit);
    digest = retainedKitDigests[canonical] ?? globalThis.__smashcraftKitDigests?.[canonical];
    if (digest === undefined) digest = canonicalChecksum(canonical);
    retainedKitDigests[canonical] = digest;
    digests.set(kit, digest);
  }
  return `|${name}.digest=${digest}`;
}


const FIGHTER_KITS: FighterKitText = {
  slot: (slot, participantMask) => canonicalSlot(slot, participantMask),
  moves: (name, moves) => kitDigestField(name, moves, MOVES_DIGESTS, fighterMovesCanonical),
  specials: (name, specials) => kitDigestField(name, specials, SPECIALS_DIGESTS, fighterSpecialsCanonical),
  placedSpec: (name, spec) => kitDigestField(name, spec, PLACEMENT_DIGESTS, placedSpecCanonical),
  projectileSpec: (spec, prefix) => specialProjectileCanonical(spec, prefix),
};

export function observedOpponentKitCanonical(fighter: Readonly<Fighter>): string {
  return kitDigestField("moves", fighter.tuning.moves, MOVES_DIGESTS, fighterMovesCanonical)
    + kitDigestField("specials", fighter.tuning.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
}

const absentKit = {};
const kitTexts = new WeakMap<object, WeakMap<object, string>>();

function kitText(f: Readonly<Fighter>): string {
  const moves = f.tuning.moves ?? absentKit;
  const specials = f.tuning.specials ?? absentKit;
  let texts = kitTexts.get(moves);
  if (texts === undefined) {
    texts = new WeakMap<object, string>();
    kitTexts.set(moves, texts);
  }
  let text = texts.get(specials);
  if (text === undefined) {
    text = observedOpponentKitCanonical(f).replaceAll("|", ";");
    texts.set(specials, text);
  }
  return text;
}

export interface ObservationWriter {
  readonly byte: (this: void, code: number) => void;

  readonly number: (this: void, value: number) => void;
  readonly text: (this: void, text: string, repetitions: number) => void;
}
const PROJECTILE_OBSERVATION_FIELDS = ["life", "x", "z", "direction", "velocityX", "velocityZ", "serial"] as const;
interface RepeatedProjectile { readonly values: readonly [number, number, number, number, number, number, number]; readonly text: string }
let repeatedProjectile: RepeatedProjectile | undefined;

function repeatedProjectileText(p: Readonly<Fighter["projectiles"][number]>): string | undefined {
  if (p.life !== 0) return undefined;
  if (repeatedProjectile === undefined) {
    const values: RepeatedProjectile["values"] = [p.life, p.x, p.z, p.direction, p.velocityX, p.velocityZ, p.serial];
    const parts: string[] = [];
    const emit = (code: number) => { parts.push(String.fromCharCode(code)); };
    for (const key of PROJECTILE_OBSERVATION_FIELDS) {
      emit(44); writeCanonicalNumber(emit, p[key]);
    }
    repeatedProjectile = { values, text: parts.join("") };
  }
  const values = repeatedProjectile.values;
  if (p.life !== values[0] || p.x !== values[1] || p.z !== values[2] || p.direction !== values[3]
    || p.velocityX !== values[4] || p.velocityZ !== values[5] || p.serial !== values[6]) return undefined;
  return repeatedProjectile.text;
}

export function writeObservations(writer: ObservationWriter, opponents: Slots<Readonly<Fighter> | undefined>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (slot !== 0) writer.byte(44);
    const f = opponents[slot];
    writeCanonicalNumber(writer.byte, f === undefined ? 0 : 1);
    if (f === undefined) continue;
    writer.byte(44);
    const kit = kitText(f);
    writer.text(kit, 1);
    writer.number(f.tuning.physics.gravity);
    writer.number(f.tuning.physics.terminalSpeed);
    writer.number(f.tuning.tech.ceilingImpulseFrame);
    writer.number(f.character);
    writer.number(f.facing);
    writer.number(f.motion.x);
    writer.number(f.motion.z);
    writer.number(f.motion.deltaX);
    writer.number(f.motion.deltaZ);
    writer.number(f.motion.vx);
    writer.number(f.motion.vz);
    writer.number(f.motion.grounded ? 1 : 0);
    writer.number(f.motion.surface ?? -1);
    writer.number(f.attack.style ?? -1);
    writer.number(f.attack.frame);
    writer.number(f.attack.duration);
    writer.number(f.attack.serial);
    writer.number(f.attack.cooldown);
    writer.number(f.special.action);
    writer.number(f.special.frame);
    writer.number(f.special.duration);
    writer.number(f.special.lockFrames);
    writer.number(f.special.form);
    writer.number(f.special.grabFrame);
    if (f.special.seekTarget !== 0) writer.number(f.special.seekTarget + 300);
    writer.number(f.shield.raised ? 1 : 0);
    writer.number(f.shield.stun);
    writer.number(f.shield.releaseLag);
    writer.number(f.launch.hitstun);
    writer.number(f.launch.hitlag);
    writer.number(f.hits.lastAttacker ?? -1);
    writer.number(f.status.out ? 1 : 0);
    writer.number(f.status.stocks);
    writer.number(f.status.damage);
    writer.number(f.status.invincible);
    writer.number(f.status.frozenFrames);
    writer.number(f.status.condition);
    writer.number(f.status.conditionFrames);
    writer.number(f.status.poisonFrames);
    writer.number(f.landing.lag);
    writer.number(f.down.state);
    writer.number(f.down.frame);
    writer.number(f.down.direction);
    writer.number(f.down.faceUp ? 1 : 0);
    writer.number(f.grab.owner ?? -1);
    writer.number(f.grab.target ?? -1);
    writer.number(f.grab.action);
    writer.number(f.ledge.state);
    writer.number(f.ledge.side);
    writer.number(f.ledge.intangible);
    writer.number(f.dodge.groundFrame);
    writer.number(f.dodge.groundDirection);
    writer.number(f.dodge.airDodging ? 1 : 0);
    writer.number(f.dodge.airFrame);
    writer.number(f.surfaceRecovery.state);
    writer.number(f.surfaceRecovery.frame);
    writer.number(f.cannon.held ?? -1);
    writer.number(f.bear.life);
    writer.number(f.bear.x);
    writer.number(f.bear.z);
    writer.number(f.bear.hitSerial);
    let repeatedCount = 0;
    let repeatedText = "";
    for (const p of f.projectiles) {
      const repeated = repeatedProjectileText(p);
      if (repeated !== undefined) { repeatedText = repeated; repeatedCount++; continue; }
      if (repeatedCount > 0) { writer.text(repeatedText, repeatedCount); repeatedCount = 0; }
      writer.number(p.life);
      writer.number(p.x);
      writer.number(p.z);
      writer.number(p.direction);
      writer.number(p.velocityX);
      writer.number(p.velocityZ);
      writer.number(p.serial);
    }
    if (repeatedCount > 0) writer.text(repeatedText, repeatedCount);
  }
}


const observationTexts = new WeakMap<Readonly<BotObservationFrame>, string>();

/** Drops a sample's text when its storage is reused; a history never changes a sample it holds (settleObservationChecksum). */
export function forgetObservationText(sample: Readonly<BotObservationFrame>): void {
  observationTexts.delete(sample);
}

export function botObservationCanonical(sample: Readonly<BotObservationFrame>): string {
  const known = observationTexts.get(sample);
  if (known !== undefined) return known;
  const parts: string[] = [];
  const byte = (code: number) => { parts.push(String.fromCharCode(code)); };
  writeObservations({ byte,
    number: value => { parts.push(`,${canonicalNumber(value)}`); },
    text: (text, repetitions) => { parts.push(text.repeat(repetitions)); },
  }, sample.opponents);
  const text = parts.join("");
  observationTexts.set(sample, text);
  return text;
}

function writeState(sink: StateSink, state: Readonly<ReplayState>): void {
  const { world, match, controls, runtime } = state;
  const int = (name: string, value: number) => sink.int("", name, value);
  const bool = (name: string, value: boolean) => sink.bool("", name, value);
  const real = (name: string, value: number) => sink.real("", name, value);
  sink.text("SmashcraftReplay2");
  int("participantMask", world.mask);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    writeFighterFields(sink, `fighter[${slot}]`, fighterAt(world, slot), world.mask, FIGHTER_KITS);
    const command = attackBufferCanonicalState(controls.commands[slot]);
    int(`commands[${slot}].windowFrames`, command.graceFrames);
    int(`commands[${slot}].style`, command.style);
    int(`commands[${slot}].facing`, command.facing);
    int(`commands[${slot}].targetFrame`, command.targetFrame);
    int(`commands[${slot}].consumedFacing`, command.consumedFacing);
    bool(`commands[${slot}].mayCharge`, command.mayCharge);
    bool(`commands[${slot}].consumedMayCharge`, command.consumedMayCharge);
    if (command.cStick) bool(`commands[${slot}].cStick`, true);
  }
  int("match.phase", match.phase);
  bool("match.camera.initialized", match.camera.initialized);
  for (const key of ["x", "z", "distance", "tangent", "left", "right", "bottom", "top"] as const) real(`match.camera.${key}`, match.camera[key]);
  for (const slot of PARTICIPANT_SLOTS) for (const key of ["left", "right", "bottom", "top"] as const) real(`match.camera.box${slot}.${key}`, match.camera.boxes[slot][key]);
  int("match.stageChoice", match.stageChoice);
  bool("match.stageResolved", match.stageResolved);
  bool("match.stagePool.only", match.stagePool.only);
  int("match.stagePool.selectedMask", match.stagePool.selectedMask);
  int("match.stagePool.remainingMask", match.stagePool.remainingMask);
  bool("match.hazards", match.hazards);

  int("match.winner", match.winner ?? -1);
  if (match.teamBattle || match.friendlyFire || match.teamChoices[0] !== 0 || match.teamChoices[1] !== 1 || match.teamChoices[2] !== 0 || match.teamChoices[3] !== 1) {
    bool("match.teamBattle", match.teamBattle);
    bool("match.friendlyFire", match.friendlyFire);
    for (const slot of PARTICIPANT_SLOTS) int(`match.slot${slot}.team`, match.teamChoices[slot]);
  }
  if (world.teamBattle || world.friendlyFire || world.teamChoices[0] !== 0 || world.teamChoices[1] !== 1 || world.teamChoices[2] !== 0 || world.teamChoices[3] !== 1) {
    bool("world.teamBattle", world.teamBattle);
    bool("world.friendlyFire", world.friendlyFire);
    for (const slot of PARTICIPANT_SLOTS) int(`world.slot${slot}.team`, world.teamChoices[slot]);
  }
  for (const slot of PARTICIPANT_SLOTS) if (world.linked[slot] !== -1) int(`world.slot${slot}.linked`, world.linked[slot]);
  int("match.humanCount", match.humanCount);
  int("match.humanMask", match.humanMask);
  int("match.humanFighterMask", match.humanFighterMask);
  int("match.computerMask", match.computerMask);
  int("match.departedMask", match.departedMask);
  bool("match.interrupted", match.interrupted);
  for (const slot of PARTICIPANT_SLOTS) {
    const prefix = `match.slot${slot}`;
    int(`${prefix}.character`, match.characterChoices[slot]);
    bool(`${prefix}.ready`, match.characterReadiness[slot]);
    bool(`${prefix}.rematch`, match.rematchReadiness[slot]);
    int(`${prefix}.cpuOpponent`, CPU_OPPONENT_CHOICES.indexOf(match.cpuOpponents[slot]));
    bool(`${prefix}.cpuRandomFighter`, match.cpuRandomFighters[slot]);
    int(`${prefix}.cpuTier`, CPU_TIERS.indexOf(match.cpuTiers[slot]));
    int(`${prefix}.cpuResolvedOpponent`, CPU_OPPONENT_IDS.indexOf(match.cpuResolvedOpponents[slot]));
  }
  int("match.stockCount", match.stockCount);
  int("match.timeLimitMinutes", match.timeLimitMinutes);
  bool("match.endless", match.endless);
  bool("match.automaticRematch", match.automaticRematch);
  int("match.rematchCountdown", match.rematchCountdown);
  int("match.remainingFrames", match.remainingFrames);
  int("match.matchSeed", match.matchSeed);
  int("match.matchFrame", match.matchFrame);

  if (match.startHold !== 0) int("match.startHold", match.startHold);
  writeMatchItems(match.items, int, bool);
  if (match.ultimatesOff) bool("match.ultimatesOff", true);
  writeMatchOrbs(match.orbs, int, bool);
  bool("match.timedOut", match.timedOut);
  bool("match.practice", match.practice);

  if (match.training) {
    bool("match.training", true);
    writeTrainingState(match.trainer, int, bool, real);
  }

  if (match.classic) {
    bool("match.classic", true);
    int("match.classicTier", match.classicTier);
  }
  if (match.lore) {
    bool("match.lore", true);
    int("match.loreBattle", match.loreBattle);
  }
  if (match.run.active) writeConfiguredRun(match.run, int, bool, real, (name, value) => sink.text(`|${name}=${value}`));
  int("runtime.simulationFrame", runtime.simulationFrame);
  for (const slot of PARTICIPANT_SLOTS) real(`runtime.botAttackDelays[${slot}]`, runtime.botAttackDelays[slot]);
  const memory = runtime.botMemory;
  for (const slot of PARTICIPANT_SLOTS) {
    const strategy = runtime.botStrategies[slot];
    if (strategy.observedFrame >= 0) {
      const values = botStrategyValues(strategy);
      for (let index = 0; index < values.length; index++) int(`runtime.botStrategies[${slot}].values[${index}]`, at(values, index));
    }
  }
  if (memory.history.length > 0) {
    for (let index = 0; index < memory.history.length; index++) {
      const observation = at(memory.history, index);
      int(`runtime.botMemory.history[${index}].frame`, observation.frame);
      sink.observation(`runtime.botMemory.history[${index}].values`, observation);
    }
    for (const slot of PARTICIPANT_SLOTS) {
      int(`runtime.botMemory.directions[${slot}]`, memory.directions[slot]);
      int(`runtime.botMemory.directionFrames[${slot}]`, memory.directionFrames[slot]);
    }
  }
}


function partsSink(parts: string[]): StateSink {
  let count = 0;
  return {
    int: (prefix, name, value) => {
      parts[count] = fieldKey(prefix, name);
      parts[count + 1] = canonicalNumber(value);
      count += 2;
    },
    bool: (prefix, name, value) => {
      parts[count] = fieldKey(prefix, name);
      parts[count + 1] = value ? "1" : "0";
      count += 2;
    },
    real: (prefix, name, value) => {
      parts[count] = fieldKey(prefix, name);
      parts[count + 1] = canonicalReal(value);
      count += 2;
    },
    text: fragment => {
      parts[count] = fragment;
      count++;
    },
    observation: (name, sample) => {
      parts[count] = `|${name}=${botObservationCanonical(sample)}`;
      count++;
    },
  };
}

export function canonicalState(state: Readonly<ReplayState>): string {
  const parts: string[] = [];
  writeState(partsSink(parts), state);
  return parts.join("");
}


export function stateChecksum(state: Readonly<ReplayState>): string {
  return canonicalChecksum(canonicalState(state));
}


const hashLanes: ChecksumLanes = { valid: true, first: 0, second: 0 };

function foldHash(value: number): void {
  const code = value >= 0 && value < REPLAY_CHECKSUM_MODULUS ? value : floorMod(value, REPLAY_CHECKSUM_MODULUS);
  hashLanes.first = floorMod(hashLanes.first * 257 + code + 1, REPLAY_CHECKSUM_MODULUS);
  hashLanes.second = floorMod(hashLanes.second * 263 + code + 1, REPLAY_CHECKSUM_MODULUS);
}

// An integer in [-2^31, 2^31) as two 16-bit halves, each below the modulus, so no two integers fold alike.
function foldFlag(value: boolean): void {
  foldHash(value ? -7 : -8);
}

function foldHashWide(value: number): void {
  foldHash(floorDiv(value, 65536) + 32768);
  foldHash(floorMod(value, 65536));
}

// A value with nothing reduced (#400): an integral value as its integer, -0
// marked, any other real as its sign, then splitFiniteReal's exponent and mantissa halves.
function foldHashValue(value: number): void {
  const whole = Math.floor(value);
  if (whole === value && whole >= -2147483648 && whole <= 2147483647) {
    if (whole === 0 && 1 / value < 0) foldHash(-10);
    foldHashWide(whole);
    return;
  }
  if (value !== value || !splitFiniteReal(value < 0 ? -value : value)) {
    foldHash(value !== value ? -1 : value < 0 ? -2 : -3);
    return;
  }
  foldHash(value < 0 ? -4 : -5);
  foldHash(realParts.exponent);
  foldHashWide(realParts.high);
  foldHashWide(realParts.low);
}

// Text a state holds (kit digests, kit observations) recurs, so each one's own lanes are folded in, computed once.
const TEXT_LANES = new Map<string, ChecksumLanes>();
const TEXT_LANES_CAPACITY = 4096;

function foldHashText(text: string): void {
  let lanes = TEXT_LANES.get(text);
  if (lanes === undefined) {
    lanes = { valid: true, first: 0, second: 0 };
    foldChecksumRange(lanes, text, 0, text.length);
    if (TEXT_LANES.size < TEXT_LANES_CAPACITY) TEXT_LANES.set(text, lanes);
  }
  foldHash(text.length);
  foldHash(lanes.valid ? lanes.first : -1);
  foldHash(lanes.second);
}

// An observation's layout is fixed by the values before each field, so its numbers fold untagged.
const HASH_OBSERVATIONS: ObservationWriter = {
  byte: code => foldHash(code),
  number: value => foldHashValue(value),
  text: (text, repetitions) => {
    foldHash(repetitions);
    foldHashText(text);
  },
};

// Each field folds its kind's marker and its name, so a conditional field cannot take another's place (#400).
let hashPrefix: string | undefined;

function foldHashName(prefix: string, name: string): void {
  if (prefix !== hashPrefix) {
    hashPrefix = prefix;
    foldHashText(prefix);
  }
  foldHashText(name);
}

const HASH_SINK: StateSink = {
  int: (prefix, name, value) => { foldHash(-6); foldHashName(prefix, name); foldHashValue(value); },
  bool: (prefix, name, value) => { foldFlag(value); foldHashName(prefix, name); },
  real: (prefix, name, value) => { foldHash(-9); foldHashName(prefix, name); foldHashValue(value); },
  text: fragment => foldHashText(fragment),
  observation: (_name, sample) => writeObservations(HASH_OBSERVATIONS, sample.opponents),
};

// Gameplay state the canonical text leaves out: computer decisions and observation counters, which sameReplayState compares.
function foldHashRuntime(runtime: Readonly<PacingAndPresentation>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    foldHash(-11);
    foldHashValue(runtime.observedLegal[slot]);
    foldHashValue(runtime.observedStarted[slot]);
    const decision = runtime.botDecisions[slot];
    foldFlag(decision.decided);
    if (!decision.decided) continue;
    for (const field of CONTROL_FIELDS) {
      const value = decision.input[field];
      if (value === undefined) foldHash(-12);
      else if (typeof value === "boolean") foldFlag(value);
      else foldHashValue(value);
    }
    const command = attackBufferCanonicalState(decision.commands);
    foldHashValue(command.graceFrames);
    foldHashValue(command.style);
    foldHashValue(command.facing);
    foldHashValue(command.targetFrame);
    foldHashValue(command.consumedFacing);
    foldFlag(command.mayCharge);
    foldFlag(command.consumedMayCharge);
  }
}

/**
 * The per-frame full-state hash (#400): every field the canonical state
 * holds, in its order, with its name and its value unreduced (signed zero
 * apart), then the computer decisions and observation counters
 * sameReplayState also compares. Presentation is left out, as the sim never
 * reads it. Folded as numbers rather than text, so it costs a fraction of
 * stateChecksum. Equal states hash equal in one runtime; it is a diagnostic,
 * never proof of equality, and not the replay tape's checksum.
 */
export function stateHash(state: Readonly<ReplayState>): string {
  hashLanes.valid = true;
  hashLanes.first = 0;
  hashLanes.second = 0;
  hashPrefix = undefined;
  writeState(HASH_SINK, state);
  foldHashRuntime(state.runtime);
  return checksumText(hashLanes);
}


export interface StateChecksumFold {
  readonly text: string;
  position: number;
  readonly lanes: ChecksumLanes;
}


export function beginStateChecksum(state: Readonly<ReplayState>): StateChecksumFold {
  return { text: canonicalState(state), position: 0, lanes: { valid: true, first: 0, second: 0 } };
}


export function foldStateChecksum(fold: StateChecksumFold, characters: number): string | undefined {
  const end = Math.min(fold.text.length, fold.position + characters);
  foldChecksumRange(fold.lanes, fold.text, fold.position, end);
  fold.position = end;
  return end === fold.text.length ? checksumText(fold.lanes) : undefined;
}


export function prepareKitDigests(): void {
  for (const moves of [RIFLEMAN_MOVES, ILLIDAN_MOVES]) kitDigestField("moves", moves, MOVES_DIGESTS, fighterMovesCanonical);
  for (const hero of HERO_ROSTER) {
    kitDigestField("moves", hero.moves, MOVES_DIGESTS, fighterMovesCanonical);
    kitDigestField("specials", hero.specials, SPECIALS_DIGESTS, fighterSpecialsCanonical);
    const specials = hero.specials;
    if (specials === undefined) continue;
    for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
      // Iterate only existing kit forms because a nil stops a Lua list.
      const forms: AuthoredSpecial[] = [kit.ground];
      if (kit.air !== undefined) forms.push(kit.air);
      if (kit.recall !== undefined) forms.push(kit.recall);
      for (const branch of kit.ground.followUps ?? []) forms.push(branch.special);
      for (const branch of kit.air?.followUps ?? []) forms.push(branch.special);
      for (const form of forms) {
        kitDigestField("placedSpec", form.placement, PLACEMENT_DIGESTS, placedSpecCanonical);
      }
    }
  }
  globalThis.__smashcraftKitDigests = retainedKitDigests;
}
