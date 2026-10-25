import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIGHTCORE_PHASES_FILE = "references/melee-frame-data/fightcore-phases.jsonl";
export const FIGHTCORE_THRESHOLDS_FILE = "references/melee-frame-data/fightcore-thresholds.jsonl";

export interface PhaseHitbox {
  readonly name: string;
  readonly damage: number;
  readonly base_knockback: number;
  readonly knockback_growth: number;
  readonly set_knockback: number;
  readonly weight_independent: boolean;
}

export interface Phase {
  readonly character: string;
  readonly move: string;
  readonly phase: number;
  readonly hitboxes: readonly PhaseHitbox[];
}

export const THRESHOLD_KNOCKBACKS = [80, 120, 32, 48] as const;
export type ThresholdKnockback = (typeof THRESHOLD_KNOCKBACKS)[number];

export type ThresholdPercent = number | "never";

export interface Threshold {
  readonly character: string;
  readonly move: string;
  readonly phase: number;
  readonly hitboxes: readonly string[];
  readonly target: string;
  readonly target_weight: number;
  readonly staleness: readonly number[];
  readonly percent: { readonly [knockback in ThresholdKnockback]?: readonly ThresholdPercent[] };
}

type Json = Readonly<Record<string, unknown>>;

const object = (value: unknown, where: string): Json => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where}: expected an object`);
  return value as Json;
};
const list = (value: unknown, where: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array`);
  return value;
};
const text = (value: unknown, where: string): string => {
  if (typeof value !== "string") throw new Error(`${where}: expected a string`);
  return value;
};
const finite = (value: unknown, where: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${where}: expected a finite number`);
  return value;
};
const flag = (value: unknown, where: string): boolean => {
  if (typeof value !== "boolean") throw new Error(`${where}: expected a boolean`);
  return value;
};
const percent = (value: unknown, where: string): ThresholdPercent => {
  if (value === "never" || (typeof value === "number" && Number.isInteger(value) && value >= 0)) return value;
  throw new Error(`${where}: expected a whole percent or "never"`);
};

function readJsonl<A>(root: string, file: string, decode: (record: Json, where: string) => A): A[] {
  return readFileSync(join(root, file), "utf8").trim().split("\n").map((line, index) => decode(object(JSON.parse(line), `${file}:${index + 1}`), `${file}:${index + 1}`));
}

const phase = (record: Json, where: string): Phase => ({
  character: text(record.character, `${where} character`), move: text(record.move, `${where} move`), phase: finite(record.phase, `${where} phase`),
  hitboxes: list(record.hitboxes, `${where} hitboxes`).map((entry, index) => {
    const hitbox = object(entry, `${where} hitbox ${index}`);
    const at = (field: string): string => `${where} hitbox ${index} ${field}`;
    return {
      name: text(hitbox.name, at("name")), damage: finite(hitbox.damage, at("damage")), base_knockback: finite(hitbox.base_knockback, at("base_knockback")),
      knockback_growth: finite(hitbox.knockback_growth, at("knockback_growth")), set_knockback: finite(hitbox.set_knockback, at("set_knockback")),
      weight_independent: flag(hitbox.weight_independent, at("weight_independent")),
    };
  }),
});

function threshold(record: Json, where: string): Threshold {
  const percents = object(record.percent, `${where} percent`);
  const unknown = Object.keys(percents).filter((key) => !(THRESHOLD_KNOCKBACKS as readonly number[]).includes(Number(key)));
  if (unknown.length > 0) throw new Error(`${where} percent: unknown knockback ${unknown.join(", ")}`);
  return {
    character: text(record.character, `${where} character`), move: text(record.move, `${where} move`), phase: finite(record.phase, `${where} phase`),
    hitboxes: list(record.hitboxes, `${where} hitboxes`).map((id, index) => text(id, `${where} hitboxes ${index}`)),
    target: text(record.target, `${where} target`), target_weight: finite(record.target_weight, `${where} target_weight`),
    staleness: list(record.staleness, `${where} staleness`).map((level, index) => finite(level, `${where} staleness ${index}`)),
    percent: Object.fromEntries(Object.entries(percents).map(([knockback, values]) =>
      [knockback, list(values, `${where} percent ${knockback}`).map((value, index) => percent(value, `${where} percent ${knockback} ${index}`))])),
  };
}

export const readFightCorePhases = (root: string): Phase[] => readJsonl(root, FIGHTCORE_PHASES_FILE, phase);
export const readFightCoreThresholds = (root: string): Threshold[] => readJsonl(root, FIGHTCORE_THRESHOLDS_FILE, threshold);
