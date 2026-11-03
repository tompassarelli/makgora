import { canonicalNumber, writeCanonicalNumber } from "./canonicalNumbers";
import { observedOpponentKitCanonical } from "./kitDigests";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import type { Fighter } from "../sim/fighter";

export interface ObservedOpponents {
  readonly opponents: Slots<Readonly<Fighter> | undefined>;
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
    writeObservedFighter(writer, f);
    writeObservedProjectiles(writer, f.projectiles);
  }
}

function writeObservedFighter(writer: ObservationWriter, f: Readonly<Fighter>): void {
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
}

function writeObservedProjectiles(writer: ObservationWriter, projectiles: Readonly<Fighter>["projectiles"]): void {
  let repeatedCount = 0;
  let repeatedText = "";
  for (const p of projectiles) {
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


const observationTexts = new WeakMap<Readonly<ObservedOpponents>, string>();

/** Drops a sample's text when its storage is reused; a history never changes a sample it holds (settleObservationChecksum). */
export function forgetObservationText(sample: Readonly<ObservedOpponents>): void {
  observationTexts.delete(sample);
}

export function botObservationCanonical(sample: Readonly<ObservedOpponents>): string {
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
