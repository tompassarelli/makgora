import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Character, DownState, GrabAction } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import type { Fighter } from "../src/game/sim/fighter";
import { authoredThrowEffect } from "../src/game/sim/grabs";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { TUMBLE_KNOCKBACK, contactKnockback, fixedHitKnockback } from "../src/game/sim/knockback";
import { WORLD_UNITS_PER_MELEE_UNIT, authoredTuning } from "../src/game/sim/tuning";
import { type Move, moveOption } from "./comboTrees";
import { Timeline } from "./interactions";

export const PARITY_PERCENTS: readonly number[] = [0, 30, 60, 90];
export const THROWS = ["forward", "back", "up", "down"] as const;
export type ThrowName = (typeof THROWS)[number];
const TARGET = Character.kobold;
const TARGET_WEIGHT = 75;
const MELEE_THROW_WEIGHT = 100;
const HORIZON = 200;
const LAUNCH_SPEED_PER_KNOCKBACK = 0.03;
const HITSTUN_PER_KNOCKBACK = 0.4;
const ROOT = join(import.meta.dir, "../..");
const FIGHTCORE = "references/melee-frame-data/fightcore.csv";
const ATTRIBUTES = "references/melee-frame-data/character-attributes.csv";
export const THROW_PARITY_PAGE = join(ROOT, "tools/move-data/interactions/throw-parity.md");

const ACTION: Record<ThrowName, GrabAction> = {
  forward: GrabAction.throwForward, back: GrabAction.throwBack, up: GrabAction.throwUp, down: GrabAction.throwDown,
};

export interface ThrowRow {
  readonly fighter: string;
  readonly throw: ThrowName;
  readonly percent: number;
  readonly release: number;
  readonly endLag: number;
  readonly hitstun: number;
  readonly advantage: number;
  readonly knockback: number;
  readonly angle: number | undefined;
  readonly offset: string;
  readonly tumble: boolean;
  readonly knockdownAt: number | undefined;
  readonly hitstunAtWeight100: number;
  readonly endLagAtFullLength: number;
  readonly fightCoreAdvantage?: number;
}

const toMelee = (worldUnits: number): number => worldUnits / WORLD_UNITS_PER_MELEE_UNIT;
const round = (value: number, places = 1): number => Math.round(value * 10 ** places) / 10 ** places;
const hitstunOf = (knockback: number): number => Math.max(1, Math.floor(HITSTUN_PER_KNOCKBACK * knockback));
const throwKnockback = (percent: number, damage: number, weight: number, growth: number, base: number): number =>
  contactKnockback(percent + damage, damage, weight, growth, base, 1.0);

export function ourThrow(character: Character, name: ThrowName, percent: number): ThrowRow {
  const move: Move = { name: `${name} throw`, throw: name };
  const line = new Timeline({
    placements: [{ character, x: 0, facing: 1 }, { character: TARGET, x: 40, facing: -1 }],
    prepare: (_a, b) => { b.status.damage = percent; },
    policies: [() => [], () => []],
  }, HORIZON, "first");
  let start: number | undefined;
  let release: number | undefined;
  let hitstun = 0, knockback = 0, angle = 0, offsetX = 0, offsetZ = 0, tumble = false;
  let knockdownAt: number | undefined;
  let throwerActs: number | undefined;
  const observe = (n: number, a: Fighter, b: Fighter): boolean => {
    if (release === undefined) {
      if (start === undefined && a.grab.action === ACTION[name]) start = n - a.grab.frame;
      if (start !== undefined && b.visuals.throw > 0) {
        release = n - start;
        hitstun = b.launch.hitstun;
        const vx = a.facing * b.launch.knockbackX, vz = b.launch.knockbackZ;
        knockback = toMelee(Math.hypot(vx, vz)) / LAUNCH_SPEED_PER_KNOCKBACK;
        angle = (Math.atan2(vz, vx) * 180) / Math.PI;
        offsetX = toMelee(a.facing * (b.motion.x - a.motion.x));
        offsetZ = toMelee(b.motion.z - a.motion.z);
        tumble = b.launch.damageLevel === 3;
      }
      return b.status.out;
    }
    const since = n - start! - release;
    if (knockdownAt === undefined && since > 0 && since < hitstun && b.down.state !== DownState.none && b.down.state !== DownState.tumble) knockdownAt = since;
    if (throwerActs === undefined && since > 0 && a.grab.action === GrabAction.none && canAttack(a)) throwerActs = since;
    return throwerActs !== undefined && since >= hitstun;
  };
  line.play([[{ option: moveOption(move, true), start: 1 }], []], HORIZON, observe, true);
  line.release();
  if (release === undefined || throwerActs === undefined) throw new Error(`${fighterName(character)}'s ${name} throw did not release and recover`);
  const effect = authoredThrowEffect(ACTION[name], authoredTuning(character).moves);
  return {
    fighter: fighterName(character), throw: name, percent, release, endLag: throwerActs, hitstun, advantage: hitstun - throwerActs,
    knockback: round(knockback), angle: Math.round(angle), offset: `${round(offsetX)}, ${round(offsetZ)}`, tumble, knockdownAt,
    hitstunAtWeight100: hitstunOf(effect.setKnockback ?? throwKnockback(percent, effect.damage, MELEE_THROW_WEIGHT, effect.growth, effect.base)),
    endLagAtFullLength: throwerActs,
  };
}

export function ourThrows(progress?: (line: string) => void): ThrowRow[] {
  const rows: ThrowRow[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    for (const name of THROWS) for (const percent of PARITY_PERCENTS) rows.push(ourThrow(character, name, percent));
    progress?.(`${fighterName(character)} throws measured`);
  }
  return rows;
}

interface MeleeThrow {
  readonly damage: number;
  readonly angle: number | undefined;
  readonly base: number;
  readonly growth: number;
  readonly release: number;
  readonly animation: number;
}

/** SmashWiki "<Fighter> (SSBM)/<Throw>" pages, read 2026-10-25: the "Throw" row applied to the thrown victim, the release frame and the animation length at full speed. */
const SMASHWIKI: Readonly<Record<string, Readonly<Record<ThrowName, MeleeThrow>>>> = {
  Fox: {
    forward: { damage: 3, angle: 45, base: 35, growth: 130, release: 11, animation: 33 },
    back: { damage: 2, angle: undefined, base: 80, growth: 85, release: 9, animation: 38 },
    up: { damage: 2, angle: 90, base: 75, growth: 110, release: 8, animation: 38 },
    down: { damage: 1, angle: 270, base: 150, growth: 40, release: 33, animation: 43 },
  },
  Falco: {
    forward: { damage: 3, angle: 45, base: 35, growth: 135, release: 11, animation: 33 },
    back: { damage: 2, angle: undefined, base: 80, growth: 85, release: 9, animation: 38 },
    up: { damage: 2, angle: 90, base: 75, growth: 110, release: 7, animation: 38 },
    down: { damage: 1, angle: 270, base: 150, growth: 40, release: 33, animation: 43 },
  },
  Sheik: {
    forward: { damage: 2, angle: 45, base: 40, growth: 140, release: 24, animation: 47 },
    back: { damage: 2, angle: undefined, base: 40, growth: 140, release: 20, animation: 47 },
    up: { damage: 2, angle: 88, base: 90, growth: 30, release: 23, animation: 57 },
    down: { damage: 3, angle: 80, base: 70, growth: 50, release: 36, animation: 57 },
  },
  Marth: {
    forward: { damage: 4, angle: 50, base: 70, growth: 45, release: 14, animation: 31 },
    back: { damage: 4, angle: 117, base: 70, growth: 60, release: 7, animation: 44 },
    up: { damage: 4, angle: 93, base: 60, growth: 130, release: 12, animation: 44 },
    down: { damage: 5, angle: 135, base: 65, growth: 50, release: 14, animation: 42 },
  },
  "Captain Falcon": {
    forward: { damage: 4, angle: 45, base: 105, growth: 0, release: 18, animation: 39 },
    back: { damage: 4, angle: 135, base: 30, growth: 130, release: 20, animation: 49 },
    up: { damage: 3, angle: 85, base: 70, growth: 105, release: 15, animation: 43 },
    down: { damage: 7, angle: 65, base: 75, growth: 34, release: 20, animation: 39 },
  },
};

function csvRows(path: string): string[][] {
  return readFileSync(join(ROOT, path), "utf8").trim().split("\n").map((line) => {
    const cells: string[] = [];
    let cell = "", quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += char;
    }
    cells.push(cell);
    return cells;
  });
}

interface FightCoreThrow { readonly damage: number; readonly base: number; readonly growth: number; readonly set: number | undefined }

function fightCoreThrows(): Map<string, FightCoreThrow> {
  const [head = [], ...rows] = csvRows(FIGHTCORE);
  const cell = (row: readonly string[], name: string) => row[head.indexOf(name)];
  const number = (value: string | undefined) => (value === undefined || value === "-" ? undefined : Number.parseFloat(value));
  const table = new Map<string, FightCoreThrow>();
  for (const row of rows) {
    const name = THROWS.find((throwName) => cell(row, "Move")?.toLowerCase() === `${throwName} throw`);
    if (cell(row, "Section") !== "Grab/Throw" || name === undefined) continue;
    table.set(`${row[0]}|${name}`, {
      damage: number(cell(row, "Damage")) ?? 0, base: number(cell(row, "Base Knockback")) ?? 0,
      growth: number(cell(row, "Knockback Growth")) ?? 0, set: number(cell(row, "Set Knockback")),
    });
  }
  return table;
}

/** "Weight Dependent Throw Speed Flags": a set bit marks a throw whose speed does not depend on weight, in down, up, back, forward order, which agrees with every SmashWiki page above. */
function weightDependentThrows(): Map<string, ReadonlySet<ThrowName>> {
  const [head = [], ...rows] = csvRows(ATTRIBUTES);
  const column = head.indexOf("Weight Dependent Throw Speed Flags");
  const order: readonly ThrowName[] = ["down", "up", "back", "forward"];
  const table = new Map<string, ReadonlySet<ThrowName>>();
  for (const row of rows) {
    const flags = (row[column] ?? "0").padStart(4, "0");
    table.set(row[0] ?? "", new Set(order.filter((_name, index) => flags[index] === "0")));
  }
  return table;
}

export function meleeThrows(): ThrowRow[] {
  const fightCore = fightCoreThrows();
  const weighted = weightDependentThrows();
  const rows: ThrowRow[] = [];
  for (const [fighter, moves] of Object.entries(SMASHWIKI)) for (const name of THROWS) {
    const move = moves[name];
    const speed = weighted.get(fighter)?.has(name) === true ? TARGET_WEIGHT / MELEE_THROW_WEIGHT : 1;
    const endLagAt = (scale: number) => round(scale * (move.animation - move.release) + 1);
    const endLag = endLagAt(speed);
    const fc = fightCore.get(`${fighter}|${name}`);
    for (const percent of PARITY_PERCENTS) {
      const knockback = throwKnockback(percent, move.damage, MELEE_THROW_WEIGHT, move.growth, move.base);
      const hitstun = hitstunOf(knockback);
      const fcKnockback = fc === undefined ? undefined
        : fc.set === undefined ? throwKnockback(percent, fc.damage, MELEE_THROW_WEIGHT, fc.growth, fc.base)
        : fixedHitKnockback(fc.set, MELEE_THROW_WEIGHT, fc.growth, fc.base, 1.0);
      rows.push({
        fighter, throw: name, percent, release: round(speed * move.release), endLag, hitstun, advantage: round(hitstun - endLag),
        knockback: round(knockback), angle: move.angle, offset: "not public", tumble: knockback >= TUMBLE_KNOCKBACK, knockdownAt: undefined,
        hitstunAtWeight100: hitstun, endLagAtFullLength: endLagAt(1),
        ...(fcKnockback === undefined ? {} : { fightCoreAdvantage: round(hitstunOf(fcKnockback) - endLag) }),
      });
    }
  }
  return rows;
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

export interface GapRow {
  readonly throw: ThrowName | "all";
  readonly percent: number | "all";
  readonly ours: number;
  readonly melee: number;
  readonly gap: number;
  readonly knockbackValues: number;
  readonly weightKnockback: number;
  readonly endLag: number;
  readonly weightTiming: number;
}

export function gapRows(ours: readonly ThrowRow[], melee: readonly ThrowRow[]): GapRow[] {
  const cell = (name: ThrowName | "all", percent: number | "all"): GapRow => {
    const pick = (rows: readonly ThrowRow[]) => rows.filter((row) => (name === "all" || row.throw === name) && (percent === "all" || row.percent === percent));
    const o = pick(ours), m = pick(melee);
    const of = (rows: readonly ThrowRow[], key: "advantage" | "hitstun" | "hitstunAtWeight100" | "endLag" | "endLagAtFullLength") => mean(rows.map((row) => row[key]));
    return {
      throw: name, percent, ours: round(of(o, "advantage")), melee: round(of(m, "advantage")), gap: round(of(m, "advantage") - of(o, "advantage")),
      knockbackValues: round(of(m, "hitstun") - of(o, "hitstunAtWeight100")),
      weightKnockback: round(of(o, "hitstunAtWeight100") - of(o, "hitstun")),
      endLag: round(of(o, "endLag") - of(m, "endLagAtFullLength")),
      weightTiming: round(of(m, "endLagAtFullLength") - of(m, "endLag")),
    };
  };
  return [...THROWS.flatMap((name) => [...PARITY_PERCENTS.map((percent) => cell(name, percent)), cell(name, "all")]), cell("all", "all")];
}

const table = (head: readonly string[], body: readonly (readonly (string | number)[])[]): string[] =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((row) => `| ${row.join(" | ")} |`)];

const share = (part: number, whole: number): string => (whole === 0 ? "-" : `${Math.round((100 * part) / whole)}%`);

type GapPart = "gap" | "knockbackValues" | "weightKnockback" | "endLag" | "weightTiming";

function summary(gaps: readonly GapRow[], ours: readonly ThrowRow[], melee: readonly ThrowRow[]): string[] {
  const cells = gaps.filter((gap) => gap.throw !== "all" && gap.percent !== "all");
  const trailing = cells.filter((gap) => gap.gap > 0);
  const sum = (rows: readonly GapRow[], key: GapPart) => round(rows.reduce((total, row) => total + row[key], 0));
  const parts = (rows: readonly GapRow[]) => {
    const whole = sum(rows, "gap");
    return `knockback values ${share(sum(rows, "knockbackValues"), whole)}, weight in knockback ${share(sum(rows, "weightKnockback"), whole)}, thrower end lag ${share(sum(rows, "endLag"), whole)}, weight-dependent timing ${share(sum(rows, "weightTiming"), whole)}`;
  };
  const all = gaps[gaps.length - 1]!;
  const average = (rows: readonly ThrowRow[], key: "hitstun" | "endLag") => round(mean(rows.map((row) => row[key])));
  const knockdowns = ours.flatMap((row) => (row.knockdownAt === undefined ? [] : [row.knockdownAt])).sort((a, b) => a - b);
  return [
    `Mean hitstun after a throw is ${average(ours, "hitstun")} frames for ours and ${average(melee, "hitstun")} for Melee's; mean thrower end lag is ${average(ours, "endLag")} and ${average(melee, "endLag")}. Our throw hitstun is shorter than Melee's, and our shorter end lag hides it in the mean: over every throw and percent the advantage gap is only ${all.gap} frames (${parts([all])}).`, "",
    `Where ours trails Melee (${trailing.length} of ${cells.length} throw and percent cells: ${trailing.map((gap) => `${gap.throw} ${gap.percent}%`).join(", ")}), the gap sums to ${sum(trailing, "gap")} frames: ${parts(trailing)}.`, "",
    `Release position does not enter the frame advantage, but it decides whether the victim reaches the ground first: in ${knockdowns.length} of ${ours.length} of our rows the victim, released level with the thrower's feet on forward, back and down throws, tumbles and lands in knockdown before its hitstun ends (median ${knockdowns[Math.floor(knockdowns.length / 2)] ?? 0} frames after the release), so it can tech before the thrower acts.`,
  ];
}

export function throwParityPage(ours: readonly ThrowRow[], melee: readonly ThrowRow[]): string {
  const gaps = gapRows(ours, melee);
  const rowCells = (row: ThrowRow): (string | number)[] => [
    row.fighter, row.throw, row.percent, row.advantage, row.hitstun, row.endLag, row.release, row.offset,
    `${row.knockback}${row.angle === undefined ? "" : ` at ${row.angle}°`}${row.tumble ? ", tumble" : ""}${row.knockdownAt === undefined ? "" : `, knockdown at +${row.knockdownAt}`}`,
  ];
  const head = ["Fighter", "Throw", "Victim %", "Frame advantage", "Hitstun", "Thrower end lag", "Release frame", "Release offset (x, z)", "Launch"];
  return [
    "# Throw parity", "",
    "Generated by `bun wisp throw-parity` from `ts/scripts/throwParity.ts`; do not edit. Issue #329; plan: [Melee parity](../../../docs/design/melee-parity-plan.md#throws).", "",
    `Victim: Kobold, weight ${TARGET_WEIGHT} (Fox's Melee weight), on the shared reference physics, standing, pressing nothing (no DI), at ${PARITY_PERCENTS.join(", ")}%.`, "",
    "- **Frame advantage**: the victim's first actionable frame minus the thrower's, both counted from the release; positive favours the thrower. The victim acts when hitstun ends; a row marked knockdown lands tumbling first, so it is a tech chase rather than a free punish.",
    "- **Hitstun**: ⌊0.4 × knockback⌋ frames from the release. **Thrower end lag**: frames from the release to the thrower's first actionable frame.",
    "- **Release frame**: frames from the throw input to the release. **Release offset**: victim minus thrower at the release, in Melee units, x toward the thrower's facing. **Launch**: knockback at the launch angle, before DI.", "",
    "Ours are measured on the match frame executor. Melee's are computed with Melee's throw rules (SmashWiki \"Throw\"): every throw computes knockback at weight 100 whatever the victim weighs, and a weight-dependent throw runs at victim weight / 100 of its length, so 0.75× against Fox. Which throws are weight-dependent comes from `references/melee-frame-data/character-attributes.csv` (\"Weight Dependent Throw Speed Flags\": a set bit marks a throw that is not weight-dependent, in down, up, back, forward order, which agrees with every SmashWiki page used). The thrown victim's knockback row, the release frame and the animation length come from SmashWiki's per-throw pages (\"Fox (SSBM)/Forward throw\" and the like, read 2026-10-25), because `references/melee-frame-data/fightcore.csv` lists another hitbox than the throw for 9 of these 20 throws (Fox and Falco forward, all four of Sheik's, Captain Falcon forward, back and up); the last column of the Melee table gives the advantage with FightCore's row. Fox's and Falco's blaster shots after the release are not counted. Melee's release offsets are not public.", "",
    "## The gap and its causes", "",
    "Gap = mean Melee advantage (five references) minus mean ours (26 fighters), in frames. It splits exactly into four parts:", "",
    "- **Knockback values**: Melee's hitstun minus ours, both at weight 100, so only damage, base and growth differ.",
    `- **Weight in knockback**: ours computes throw knockback at the victim's weight; Melee at 100. Against a weight-${TARGET_WEIGHT} victim ours gains hitstun, so this part is negative.`,
    "- **Thrower end lag**: our end lag minus Melee's at full length.",
    "- **Weight-dependent timing**: Melee's weight-dependent throws end sooner against Fox; ours has no such rule.", "",
    ...table(["Throw", "Victim %", "Ours", "Melee", "Gap", "Knockback values", "Weight in knockback", "Thrower end lag", "Weight-dependent timing"],
      gaps.map((gap) => [gap.throw, gap.percent, gap.ours, gap.melee, gap.gap, gap.knockbackValues, gap.weightKnockback, gap.endLag, gap.weightTiming])), "",
    ...summary(gaps, ours, melee), "",
    "## Melee references", "",
    ...table([...head, "Advantage with FightCore's row"], melee.map((row) => [...rowCells(row), row.fightCoreAdvantage ?? "-"])), "",
    "## Our fighters", "",
    ...table(head, ours.map(rowCells)), "",
  ].join("\n");
}
