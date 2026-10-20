import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { copyFighterState } from "../../generated/state/fighterState";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { Character, HERO_STATUS_GROUPS, SPECIAL_ACTION_CAPACITY } from "./codes";
import { type Fighter, createFighter, createPlacedObject, placedObject } from "./fighter";
import { FIGHTER_ARRAYS, FIGHTER_FIELDS, type FighterFieldRow } from "./state/fighterSchema";

type Node = Record<string, unknown>;

const ROWS = FIGHTER_FIELDS.filter((row) => row.copy !== "none" && !row.path.startsWith("projectiles[]") && !row.path.startsWith("pack"));
const REALS = [0.0, -0.0, f32(1.5), f32(-2.25), f32(0.001), f32(640.0)];
const SLOT_CHOICES = 6;
const slotChoice = (choice: number) => (choice === 0 ? undefined : choice - 1);
const CAPACITIES: Readonly<Record<string, number>> = { PARTICIPANT_CAPACITY, HERO_STATUS_GROUPS, SPECIAL_ACTION_CAPACITY };

// Lua: an array that may hold nil has no reliable length, so every scalar array is walked to its schema capacity.
function countOf(row: FighterFieldRow): number {
  if (!row.path.endsWith("[]")) return 1;
  const array = FIGHTER_ARRAYS.find((candidate) => candidate.path === row.path.slice(0, -2));
  return CAPACITIES[array?.capacity ?? ""] ?? 0;
}

function read(owner: Node, key: string, row: FighterFieldRow, index: number): unknown {
  return row.path.endsWith("[]") ? (owner[key] as unknown[])[index] : owner[key];
}
const CHARACTERS = [Character.rifleman, Character.demonHunter, Character.kobold];

const exact = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a === b && (a !== 0 || 1 / a === 1 / b) : a === b);

const keptSlot = (mask: number, slot: unknown) =>
  typeof slot === "number" && mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0 ? slot : undefined;

function owners(fighter: Fighter, path: string): { readonly owner: Node; readonly key: string }[] {
  const parts = path.split(".");
  const roots: Node[] = [];
  if (!path.startsWith("placed.")) roots.push(fighter as unknown as Node);
  else for (let animal = 0; animal <= fighter.pack.length; animal++) roots.push(placedObject(fighter, animal) as unknown as Node);
  let level = roots;
  for (const part of parts.slice(path.startsWith("placed.") ? 1 : 0, -1)) {
    const name = part.replace("[]", "");
    level = level.flatMap((node) => {
      const child = node[name];
      return part.endsWith("[]") ? (child as Node[]) : [child as Node];
    });
  }
  const last = parts[parts.length - 1] ?? "";
  return level.map((owner) => ({ owner, key: last.replace("[]", "") }));
}


function scramble(fighter: Fighter, next: (range: number) => number): void {
  for (let animal = next(3); animal > 0; animal--) fighter.pack.push(createPlacedObject());
  for (const row of ROWS) {
    if (next(3) !== 0) continue;
    const pick = (): unknown => {
      switch (row.type) {
        case "real": return REALS[next(REALS.length)];
        case "bool": return next(2) === 0;
        case "slot": return slotChoice(next(SLOT_CHOICES));
        case "int": case "enum": case "optionalInt": case "optionalEnum": return next(9) - 2;
        default: return undefined;
      }
    };
    if (pick() === undefined && row.type !== "slot") continue;
    for (const { owner, key } of owners(fighter, row.path)) {
      if (row.path.endsWith("[]")) {
        const list = owner[key] as unknown[];
        for (let i = 0; i < countOf(row); i++) list[i] = pick();
      } else owner[key] = pick();
    }
  }
}

test("the generated fighter copy writes every copied field as a schema-driven copy would, keeping only slots the mask holds, on 300 scrambled fighters with signed zeros and growing and shrinking packs [k2 property]", () => {
  let state = 9;
  const next = (range: number) => {
    state = floorMod(state * 75 + 74, 65537);
    return floorMod(state, range);
  };
  let compared = 0;
  let dropped = 0;
  for (let run = 0; run < 300; run++) {
    const source = createFighter(CHARACTERS[next(3)] ?? Character.rifleman, f32(next(100) - 50.0), next(2) === 0 ? 1 : -1);
    const target = createFighter(CHARACTERS[next(3)] ?? Character.rifleman, 0.0, 1);
    scramble(source, next);
    scramble(target, next);
    const mask = next(18) - 1;
    copyFighterState(target, source, mask);
    assertEquals(target.pack.length, source.pack.length, `run ${run} pack length`);
    for (const row of ROWS) {
      const sources = owners(source, row.path);
      const targets = owners(target, row.path);
      assertEquals(targets.length, sources.length, `run ${run} ${row.path} owners`);
      for (let o = 0; o < sources.length; o++) {
        const from = at(sources, o);
        const to = at(targets, o);
        for (let i = 0; i < countOf(row); i++) {
          const value = read(from.owner, from.key, row, i);
          const copied = read(to.owner, to.key, row, i);
          const expected = row.copy === "retained" ? keptSlot(mask, value) : value;
          if (row.copy === "retained" && expected === undefined && value !== undefined) dropped++;
          assertEquals(exact(copied, expected), true, `run ${run} mask ${mask} ${row.path}[${i}]: ${String(copied)} vs ${String(expected)}`);
          compared++;
        }
      }
    }
  }
  assertGreaterThan(compared, 300 * ROWS.length);
  assertGreaterThan(dropped, 100);
});
