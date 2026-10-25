import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { AttackStyle, type Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { authoredTuning } from "../src/game/sim/tuning";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { authoredHurtboxes, HurtState, type HurtPart } from "../src/game/sim/hurtboxes";
import { attackDurationFramesForGrounding, attackStartupFrames } from "../src/game/sim/moves";
import { cancelsJumpSquat } from "../src/game/sim/conditions";
import { type LinkEvidence, type LinkOption, linkOptions, readLinkTable } from "./linkTable";

export const EXCEPTIONS_FILE = join(import.meta.dir, "../../tools/move-data/move-shape-exceptions.json");

export const DIRECTIONS = [
  { name: "forward", smash: AttackStyle.forwardSmash, tilt: AttackStyle.forwardTilt },
  { name: "up", smash: AttackStyle.upSmash, tilt: AttackStyle.upTilt },
  { name: "down", smash: AttackStyle.downSmash, tilt: AttackStyle.downTilt },
] as const;
export type Direction = (typeof DIRECTIONS)[number]["name"];

export const OPTIONS = ["a reach", "b active", "f damage", "h coverage", "i disjoint", "j intangible", "l sweetspot", "m out of shield"] as const;
export type Option = (typeof OPTIONS)[number] | LinkOption;

const GEOMETRY_TIE = 4;
const SWEETSPOT = 1.2;

export interface Shape {
  readonly startup: number;
  readonly total: number;
  readonly active: number;
  readonly reach: number;
  readonly behind: number;
  readonly height: number;
  readonly disjoint: number;
  readonly damage: number;
  readonly sweetspot: number;
  readonly intangible: boolean;
  readonly outOfShield: boolean;
}

const front = (parts: readonly HurtPart[]): number => Math.max(...parts.map((p) => Math.max(p.x1, p.x2) + p.radius));
const top = (parts: readonly HurtPart[]): number => Math.max(...parts.map((p) => Math.max(p.z1, p.z2) + p.radius));

export function moveShape(character: Character, style: AttackStyle): Shape {
  const moves = authoredTuning(character).moves;
  const hurt = authoredHurtboxes(character, moves);
  const poses = hurt.attacks[style] ?? [];
  const partsAt = (frame: number): readonly HurtPart[] => poses.find((p) => frame >= p.firstFrame && frame <= p.lastFrame)?.parts ?? hurt.stand;
  const total = attackDurationFramesForGrounding(style, true, moves);
  const travel = moves?.normals[style]?.startupTravelX ?? 0;
  const hits: { frame: number; minX: number; maxX: number; maxZ: number; damage: number; overFront: number; overTop: number }[] = [];
  for (let frame = 0; frame < total; frame++) {
    for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
      const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index, moves);
      if (hit.effect.damage <= 0) continue;
      const parts = partsAt(frame);
      hits.push({ frame, minX: hit.minX, maxX: hit.maxX, maxZ: hit.maxZ, damage: hit.effect.damage, overFront: hit.maxX - front(parts), overTop: hit.maxZ - top(parts) });
    }
  }
  if (hits.length === 0) throw new Error(`${fighterSlug(character)} style ${style} has no hit`);
  const most = (pick: (h: (typeof hits)[number]) => number): number => Math.max(...hits.map(pick));
  const damages = hits.map((h) => h.damage);
  const standFront = front(hurt.stand);
  const intangible = poses.some((p) => p.parts.some((part) => (part.state ?? HurtState.normal) !== HurtState.normal) || front(p.parts) < standFront - GEOMETRY_TIE);
  return {
    startup: attackStartupFrames(style, moves) + 1, total, active: new Set(hits.map((h) => h.frame)).size,
    reach: travel + most((h) => h.maxX), behind: most((h) => -h.minX), height: most((h) => h.maxZ),
    disjoint: style === AttackStyle.upSmash || style === AttackStyle.upTilt ? most((h) => h.overTop) : most((h) => h.overFront),
    damage: Math.max(...damages), sweetspot: Math.max(...damages) / Math.min(...damages), intangible, outOfShield: cancelsJumpSquat(style),
  };
}

const more = (a: number, b: number, tie = 0): boolean => a > b + tie;

export function optionsWon(direction: Direction, s: Shape, t: Shape): Option[] {
  const won: Option[] = [];
  const reach = (x: Shape): number => (direction === "up" ? x.height : x.reach);
  if (reach(s) >= reach(t) - GEOMETRY_TIE) won.push("a reach");
  if (more(s.active, t.active)) won.push("b active");
  if (more(s.damage, t.damage)) won.push("f damage");
  if (direction === "up" ? more(s.height, t.height, GEOMETRY_TIE) : more(s.behind, Math.max(t.behind, 0), GEOMETRY_TIE)) won.push("h coverage");
  if (s.disjoint > GEOMETRY_TIE && more(s.disjoint, t.disjoint, GEOMETRY_TIE)) won.push("i disjoint");
  if (s.intangible && !t.intangible) won.push("j intangible");
  if (s.sweetspot >= Math.max(t.sweetspot, SWEETSPOT)) won.push("l sweetspot");
  if (s.outOfShield && !t.outOfShield) won.push("m out of shield");
  return won;
}

export type Rule = "range triangle" | "smash budget";
export interface Verdict { readonly fighter: string; readonly direction: Direction; readonly rule: Rule; readonly pass: boolean; readonly detail: string }
export interface Row { readonly fighter: string; readonly direction: Direction; readonly jab: number; readonly smash: Shape; readonly tilt: Shape; readonly won: readonly Option[]; readonly links: readonly LinkEvidence[] | undefined; readonly verdicts: readonly Verdict[] }

export function judge(fighter: string, direction: Direction, jab: number, smash: Shape, tilt: Shape, links?: readonly LinkEvidence[]): Row {
  const won = [...optionsWon(direction, smash, tilt), ...(links ?? []).filter((l) => l.won).map((l) => l.option)].sort();
  const triangle = jab < tilt.startup && tilt.startup < smash.startup;
  const committal = smash.startup > tilt.startup && smash.total > tilt.total;
  return {
    fighter, direction, jab, smash, tilt, won, links,
    verdicts: [
      { fighter, direction, rule: "range triangle", pass: triangle, detail: `jab ${jab}, tilt ${tilt.startup}, smash ${smash.startup}` },
      { fighter, direction, rule: "smash budget", pass: !committal || won.length > 0, detail: committal ? `more committal, wins on ${won.join(", ") || "no option"}` : "not more committal" },
    ],
  };
}

export function rosterShapes(): Row[] {
  return SELECTABLE_CHARACTERS.flatMap((character) => {
    const jab = attackStartupFrames(AttackStyle.jab, authoredTuning(character).moves) + 1;
    const table = readLinkTable(character);
    return DIRECTIONS.map((d) => judge(fighterSlug(character), d.name, jab, moveShape(character, d.smash), moveShape(character, d.tilt), table && linkOptions(table, `${d.name} smash`, `${d.name} tilt`)));
  });
}

const ShapeException = Schema.Struct({ fighter: Schema.String, direction: Schema.Literals(["forward", "up", "down"]), rule: Schema.Literals(["range triangle", "smash budget"]), issue: Schema.String, reason: Schema.String });
export type ShapeException = typeof ShapeException.Type;

export function readExceptions(file = EXCEPTIONS_FILE): readonly ShapeException[] {
  return Schema.decodeUnknownSync(Schema.Array(ShapeException))(JSON.parse(readFileSync(file, "utf8")));
}

const sameMove = (a: { fighter: string; direction: string; rule: string }, b: { fighter: string; direction: string; rule: string }): boolean =>
  a.fighter === b.fighter && a.direction === b.direction && a.rule === b.rule;

export interface CheckResult { readonly failures: readonly Verdict[]; readonly excused: readonly Verdict[]; readonly stale: readonly ShapeException[] }

export function check(rows: readonly Row[], exceptions: readonly ShapeException[]): CheckResult {
  const failing = rows.flatMap((r) => r.verdicts.filter((v) => !v.pass));
  return {
    failures: failing.filter((v) => !exceptions.some((e) => sameMove(e, v))),
    excused: failing.filter((v) => exceptions.some((e) => sameMove(e, v))),
    stale: exceptions.filter((e) => !failing.some((v) => sameMove(e, v))),
  };
}
