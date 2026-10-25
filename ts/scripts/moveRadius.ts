import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { AttackStyle, type Character } from "../src/game/sim/codes";
import { attackCapsule, emptyCapsule } from "../src/game/sim/geometry/contactGeometry";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { fighterShield } from "../src/game/sim/heroes/heroBodies";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { attackDurationFramesForGrounding } from "../src/game/sim/moves";
import { authoredTuning } from "../src/game/sim/tuning";

const MELEE = join(import.meta.dir, "../../references/melee-frame-data");
export const RADIUS_EXCEPTIONS_FILE = join(import.meta.dir, "../../tools/move-data/move-radius-exceptions.json");

export const MOVE_TYPES = [
  { name: "jab", melee: "jab1", styles: [AttackStyle.jab], grounded: true },
  { name: "forward tilt", melee: "ftilt", styles: [AttackStyle.forwardTilt], grounded: true },
  { name: "up tilt", melee: "utilt", styles: [AttackStyle.upTilt], grounded: true },
  { name: "down tilt", melee: "dtilt", styles: [AttackStyle.downTilt], grounded: true },
  { name: "dash attack", melee: "dattack", styles: [AttackStyle.dashAttack, AttackStyle.demonHunterDashAttack], grounded: true },
  { name: "forward smash", melee: "fsmash", styles: [AttackStyle.forwardSmash], grounded: true },
  { name: "up smash", melee: "usmash", styles: [AttackStyle.upSmash], grounded: true },
  { name: "down smash", melee: "dsmash", styles: [AttackStyle.downSmash], grounded: true },
  { name: "neutral air", melee: "nair", styles: [AttackStyle.neutralAir], grounded: false },
  { name: "forward air", melee: "fair", styles: [AttackStyle.forwardAir], grounded: false },
  { name: "back air", melee: "bair", styles: [AttackStyle.backAir], grounded: false },
  { name: "up air", melee: "uair", styles: [AttackStyle.upAir], grounded: false },
  { name: "down air", melee: "dair", styles: [AttackStyle.downAir], grounded: false },
] as const;
export type MoveType = (typeof MOVE_TYPES)[number]["name"];

const LIBMELEE_NAMES: Readonly<Record<string, string>> = { "dr._mario": "Dr Mario", "mr._game_&_watch": "Game & Watch" };
const attributeName = (character: string): string =>
  LIBMELEE_NAMES[character] ?? character.split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

export function meleeShields(): ReadonlyMap<string, number> {
  const [header, ...rows] = readFileSync(join(MELEE, "character-attributes.csv"), "utf8").trim().split("\n").map((l) => l.split(","));
  const scale = header!.indexOf("Model Scaling");
  const size = header!.indexOf("Shield Size");
  return new Map(rows.map((r) => [r[0]!, Number(r[size]) * Number(r[scale])]));
}

export interface MeleeRadius { readonly fighter: string; readonly move: MoveType; readonly radius: number; readonly shield: number; readonly relative: number }

export function meleeRadii(): MeleeRadius[] {
  const shields = meleeShields();
  const out: MeleeRadius[] = [];
  for (const line of readFileSync(join(MELEE, "libmelee.jsonl"), "utf8").trim().split("\n")) {
    const record = JSON.parse(line) as { character: string; action: string; hitbox_frames: { hitboxes: { size: number }[] }[] };
    const type = MOVE_TYPES.find((t) => t.melee === record.action);
    if (type === undefined) continue;
    const sizes = record.hitbox_frames.flatMap((f) => f.hitboxes.map((h) => h.size));
    if (sizes.length === 0) continue;
    const fighter = attributeName(record.character);
    const shield = shields.get(fighter);
    if (shield === undefined) throw new Error(`no shield size for ${record.character} in character-attributes.csv`);
    const radius = Math.max(...sizes);
    out.push({ fighter, move: type.name, radius, shield, relative: radius / shield });
  }
  return out;
}

const quantile = (sorted: readonly number[], q: number): number => {
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (at - lo);
};

export interface Band { readonly move: MoveType; readonly fighters: number; readonly radius: number; readonly low: number; readonly median: number; readonly high: number }

export function meleeBands(radii = meleeRadii()): Band[] {
  return MOVE_TYPES.map(({ name }) => {
    const of = radii.filter((r) => r.move === name);
    const relative = of.map((r) => r.relative).sort((a, b) => a - b);
    const radius = of.map((r) => r.radius).sort((a, b) => a - b);
    return { move: name, fighters: of.length, radius: quantile(radius, 0.5), low: quantile(relative, 0.25), median: quantile(relative, 0.5), high: quantile(relative, 0.75) };
  });
}

export function bandsTable(bands = meleeBands()): string {
  const f = (v: number, d = 3): string => v.toFixed(d);
  return [
    "| Move | Fighters | Median radius | Lower quartile | Median | Upper quartile |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...bands.map((b) => `| ${b.move} | ${b.fighters} | ${f(b.radius, 2)} | ${f(b.low)} | ${f(b.median)} | ${f(b.high)} |`),
  ].join("\n");
}

export const BANDS_DOC = join(import.meta.dir, "../../docs/design/melee/attacks.md");

export function documentedBands(file = BANDS_DOC): string | undefined {
  return /<!-- table:radiusBands -->\n([\s\S]*?)\n<!-- \/table -->/.exec(readFileSync(file, "utf8"))?.[1];
}

const capsule = emptyCapsule();

export function largestRadius(character: Character, style: AttackStyle, grounded: boolean): number | undefined {
  const moves = authoredTuning(character).moves;
  const region = emptyHitRegion();
  let largest: number | undefined;
  for (let frame = 0; frame < attackDurationFramesForGrounding(style, grounded, moves); frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
      authoredHitRegion(region, character, style, frame, 0, index, moves);
      if (region.effect.damage <= 0) continue;
      const radius = attackCapsule(capsule, style, region).radius;
      if (largest === undefined || radius > largest) largest = radius;
    }
  }
  return largest;
}

export interface RadiusRow { readonly fighter: string; readonly move: MoveType; readonly radius: number; readonly shield: number; readonly relative: number; readonly band: Band; readonly pass: boolean }

export function rosterRadii(bands = meleeBands()): RadiusRow[] {
  return SELECTABLE_CHARACTERS.flatMap((character) => {
    const shield = fighterShield(character);
    if (shield === undefined) throw new Error(`${fighterSlug(character)} has no shield in heroBodies.ts`);
    return MOVE_TYPES.flatMap((type) => {
      const radius = type.styles.map((s) => largestRadius(character, s, type.grounded)).find((r) => r !== undefined);
      if (radius === undefined) return [];
      const band = bands.find((b) => b.move === type.name)!;
      const relative = radius / shield.radius;
      return [{ fighter: fighterSlug(character), move: type.name, radius, shield: shield.radius, relative, band, pass: relative >= band.low && relative <= band.high }];
    });
  });
}

const RadiusException = Schema.Struct({ fighter: Schema.String, moves: Schema.Array(Schema.Literals(MOVE_TYPES.map((t) => t.name))), issue: Schema.String, reason: Schema.String });
export type RadiusException = typeof RadiusException.Type;

export function readRadiusExceptions(file = RADIUS_EXCEPTIONS_FILE): readonly RadiusException[] {
  return Schema.decodeUnknownSync(Schema.Array(RadiusException))(JSON.parse(readFileSync(file, "utf8")));
}

export interface ExceptedMove { readonly fighter: string; readonly move: MoveType }
export interface RadiusCheck { readonly failures: readonly RadiusRow[]; readonly excused: readonly RadiusRow[]; readonly stale: readonly ExceptedMove[] }

export function checkRadii(rows: readonly RadiusRow[], exceptions: readonly RadiusException[]): RadiusCheck {
  const failing = rows.filter((r) => !r.pass);
  const excepted = exceptions.flatMap((e) => e.moves.map((move) => ({ fighter: e.fighter, move })));
  const same = (a: ExceptedMove, b: ExceptedMove): boolean => a.fighter === b.fighter && a.move === b.move;
  return {
    failures: failing.filter((r) => !excepted.some((e) => same(e, r))),
    excused: failing.filter((r) => excepted.some((e) => same(e, r))),
    stale: excepted.filter((e) => !failing.some((r) => same(e, r))),
  };
}

if (import.meta.main) console.log(bandsTable());
