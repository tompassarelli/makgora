import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { type Fighter, PROJECTILE_CAPACITY, createFighter } from "../sim/fighter";
import { firstFighterDifference, sameReplayState } from "./difference";
import { copyFighterState, sameFighterState } from "../../generated/state/fighterState";
import { createRoster } from "../sim/roster";
import { type FighterTuning } from "../sim/tuning";
import { HERO_ROSTER, SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import type { AuthoredSpecial, SpecialPlacement, SpecialProjectile } from "../sim/specials/schema";
import { FIGHTER_FIELDS, type FighterFieldRow } from "../sim/state/fighterSchema";
import { stateHash } from "./canonical";
import { type ReplayState, createReplaySnapshot } from "./snapshot";

interface LeafPair {
  readonly path: string;
  left(): unknown;
  right(): unknown;
  setLeft(value: unknown): void;
  setRight(value: unknown): void;
}

type Field = Record<string, unknown>;






function walk(left: object, right: object, path: string, leaves: LeafPair[], records: [object, object][]): void {
  if (!path.startsWith(".projectiles[")) records.push([left, right]);
  const child = (childPath: string, get: (side: object) => unknown, set: (side: object, value: unknown) => void) => {
    const value = get(left);
    const other = get(right);
    if (typeof value === "object" && value !== null && typeof other === "object" && other !== null) walk(value, other, childPath, leaves, records);
    else leaves.push({ path: childPath, left: () => get(left), right: () => get(right), setLeft: next => set(left, next), setRight: next => set(right, next) });
  };
  if (Array.isArray(left)) {
    // Lua closures share a loop variable; capture through a callback parameter.
    const elements: unknown[] = left;
    elements.forEach((_, index) => {
      child(`${path}[${index}]`, side => (side as unknown[])[index], (side, value) => { (side as unknown[])[index] = value; });
    });
    return;
  }
  for (const key of Object.keys(left)) {
    if (path === "" && (key === "tuning" || key === "projectileSlots" || key === "restingGroups")) continue;
    child(`${path}.${key}`, side => (side as Field)[key], (side, value) => { (side as Field)[key] = value; });
  }
}

function fighterLeaves(left: Fighter, right: Fighter): { leaves: LeafPair[]; records: [object, object][] } {
  left.projectileSlots = PROJECTILE_CAPACITY;
  right.projectileSlots = PROJECTILE_CAPACITY;
  left.restingGroups = 0;
  right.restingGroups = 0;
  const leaves: LeafPair[] = [];
  const records: [object, object][] = [];
  walk(left, right, "", leaves, records);
  return { leaves, records };
}


function changed(value: unknown, seed: number): unknown {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + seed;
  return 1;
}

test("fighter replay copies preserve every field, absent hit targets included, and detach mutable records [k2 property]", () => {
  const source = createFighter(Character.rifleman, -12.0, 1);
  const target = createFighter(Character.rifleman, 4.0, -1);
  const { leaves } = fighterLeaves(target, source);
  leaves.forEach((leaf, index) => leaf.setRight(changed(leaf.right(), index + 1)));
  source.tuning.physics = createFighter(Character.demonHunter, 0.0, 1).tuning.physics;
  copyFighterState(target, source, 15);
  const copied = fighterLeaves(target, source);
  for (const leaf of copied.leaves) assertEquals(leaf.left(), leaf.right(), leaf.path);
  for (const [copy, original] of copied.records) assertFalse(copy === original);
  assertTrue(target.tuning.physics === source.tuning.physics);
  assertFalse(target.tuning === source.tuning);
  // Absent special hit targets: the walk sees them only in Bun, since in Lua a table of nils has no keys (#59).
  const hitting = createFighter(Character.rifleman, 0.0, 1);
  const fresh = createFighter(Character.rifleman, 0.0, 1);
  hitting.special.hitTargets[0] = 2;
  hitting.special.hitTargets[2] = 3;
  copyFighterState(fresh, hitting, 15);
  assertEquals([0, 1, 2, 3].map(i => fresh.special.hitTargets[i] ?? -1).join(","), "2,-1,3,-1");
  hitting.special.hitTargets[0] = undefined;
  hitting.special.hitTargets[2] = undefined;
  copyFighterState(fresh, hitting, 15);
  assertEquals([0, 1, 2, 3].map(i => fresh.special.hitTargets[i] ?? -1).join(","), "-1,-1,-1,-1");
  const candleSlots = (fighter: Fighter) => [0, 1, 2, 3].map(i => fighter.candle.struck[i] ?? -1).join(",") + `;${fighter.candle.surface ?? -1}`;
  const cycleCandle = (set: (value: number | undefined) => void, first: number, second: number) => {
    // -1 stands for absent: a Lua array literal stops at nil.
    for (const value of [first, -1, second]) {
      set(value === -1 ? undefined : value);
      assertFalse(sameFighterState(fresh, hitting));
      copyFighterState(fresh, hitting, 15);
      assertEquals(candleSlots(fresh), candleSlots(hitting));
      assertTrue(sameFighterState(fresh, hitting));
    }
  };
  for (let slot = 0; slot < 4; slot++) cycleCandle(value => { hitting.candle.struck[slot] = value; }, slot + 4, slot + 8);
  cycleCandle(value => { hitting.candle.surface = value; }, 2, 0);
  assertEquals(candleSlots(fresh), "8,9,10,11;0");
  for (const variant of [3, 0]) {
    hitting.special.variant = variant;
    assertFalse(sameFighterState(fresh, hitting));
    copyFighterState(fresh, hitting, 15);
    assertEquals(fresh.special.variant, variant);
    assertTrue(sameFighterState(fresh, hitting));
  }
});

test("every mutable fighter field participates in replay equality [k2 property]", () => {
  const expected = createFighter(Character.rifleman, 0.0, 1);
  const actual = createFighter(Character.rifleman, 0.0, 1);
  const { leaves } = fighterLeaves(expected, actual);
  assertEquals(firstFighterDifference(expected, actual, 15, 15), undefined);
  for (const leaf of leaves) {
    const original = leaf.right();
    leaf.setRight(changed(original, 1));
    assertEquals(firstFighterDifference(expected, actual, 15, 15) !== undefined, true, leaf.path);
    leaf.setRight(original);
  }
  assertEquals(firstFighterDifference(expected, actual, 15, 15), undefined);
});

// Every reference a fighter's tuning holds.
const TUNING_FIELDS = ["physics", "surface", "ground", "dashGrab", "shield", "tech", "shieldBreak", "moves", "specials", "ultimate"] as const satisfies readonly (keyof FighterTuning)[];

// Integer codes, counts and frames: Lua integers have no -0, so their comparisons skip the signed-zero test.
const INTEGER_FIELDS = [
  ".character", ".special.seekTarget", ".launch.hitlagFrames", ".launch.hitlagEndAge", ".water.hydraStrikeFrame", ".platform.downAge", ".status.conditionImmunity[]",
  ".projectiles[].life", ".projectiles[].direction", ".projectiles[].kind", ".projectiles[].visualFamily", ".projectiles[].serial", ".projectiles[].poolHits", ".projectiles[].poolWait",
];
// Dense number lists, read as `?? 0`, which never hold undefined.
const DENSE_FIELDS = [".special.cooldowns[]", ".status.conditionImmunity[]"];
// A path with its indices dropped: `.pack[1].x` is `.pack[].x`.
function field(path: string): string {
  let kind = "";
  let index = false;
  for (let at = 0; at < path.length; at++) {
    const character = path.charAt(at);
    if (character === "]") index = false;
    if (!index) kind += character;
    if (character === "[") index = true;
  }
  return kind;
}

/** A state holding `fighter` in slot 0, as repair compares it. */
function holding(fighter: Fighter): ReplayState {
  const others = [createFighter(Character.rifleman, 0.0, -1), createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, 0.0, -1)];
  return { ...createReplaySnapshot(), world: createRoster(1, [fighter, ...others]) };
}

test("the comparators repair trusts tell apart every changed fighter field, and a copy satisfies them [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const key of Object.keys(createFighter(character, 0.0, 1).tuning)) assertTrue((TUNING_FIELDS as readonly string[]).includes(key));
  }
  // A Beastmaster holds a pack, specials and an ultimate.
  const expected = createFighter(Character.beastmaster, 0.0, 1);
  const actual = createFighter(Character.beastmaster, 0.0, 1);
  const copy = createFighter(Character.rifleman, 7.0, -1);
  const expectedState = holding(expected);
  const actualState = holding(actual);
  const { leaves } = fighterLeaves(expected, actual);
  const misses: string[] = [];
  const same = (): boolean => {
    const fighters = sameFighterState(expected, actual);
    if (fighters !== sameReplayState(expectedState, actualState)) misses.push("sameReplayState disagrees with sameFighterState");
    return fighters;
  };
  // `actual` changed: the comparators tell it apart, and a copy of it, over whatever the target held, satisfies them.
  const differs = (path: string) => {
    if (same()) misses.push(path);
    copyFighterState(copy, expected, 1);
    copyFighterState(copy, actual, 1);
    if (!sameFighterState(copy, actual)) misses.push(`${path}: copy`);
  };
  assertTrue(same());
  const tuning = (fighter: Fighter) => fighter.tuning as unknown as Record<string, unknown>;
  for (const field of TUNING_FIELDS) {
    const original = actual.tuning[field];
    tuning(actual)[field] = {};
    differs(`tuning.${field} replaced`);
    tuning(actual)[field] = undefined;
    differs(`tuning.${field} -> undefined`);
    tuning(expected)[field] = undefined;
    if (!same()) misses.push(`tuning.${field} both undefined`);
    tuning(actual)[field] = {};
    differs(`tuning.${field} undefined -> value`);
    tuning(expected)[field] = original;
    tuning(actual)[field] = original;
  }
  for (const leaf of leaves) {
    const original = leaf.right();
    if (typeof original !== "boolean" && typeof original !== "number") continue;
    const kind = field(leaf.path);
    leaf.setRight(typeof original === "boolean" ? !original : original + 1);
    differs(`${leaf.path} changed`);
    if (typeof original === "number") {
      leaf.setRight(original + 0.5);
      differs(`${leaf.path} + 0.5`);
    }
    if (!DENSE_FIELDS.includes(kind)) {
      leaf.setRight(undefined);
      differs(`${leaf.path} -> undefined`);
      leaf.setLeft(undefined);
      if (!same()) misses.push(`${leaf.path} both undefined`);
      leaf.setRight(original);
      differs(`${leaf.path} undefined -> value`);
      leaf.setLeft(original);
    }
    if (typeof original === "number") {
      // A Lua integer and the equal float are one value; signed zeros are two.
      leaf.setRight(original + 0.5 - 0.5);
      if (!same()) misses.push(`${leaf.path} as float`);
      if (!INTEGER_FIELDS.includes(kind)) {
        leaf.setLeft(0.0);
        leaf.setRight(-0.0);
        differs(`${leaf.path} -0`);
        leaf.setLeft(original);
      }
    }
    leaf.setRight(original);
  }
  assertTrue(same());
  assertEquals(misses.join("; "), "");
});

interface SchemaLeaf {
  readonly list: unknown[] | undefined;
  readonly record: Field | undefined;
  readonly key: string;
  readonly index: number;
}

// `[]` takes the last element, or the first where Lua reads a list of undefined slots as empty.
function schemaLeaf(fighter: Fighter, path: string): SchemaLeaf {
  const parts = path.split(".");
  let holder: Field = fighter as unknown as Field;
  for (let at = 0; at < parts.length; at++) {
    const part = parts[at] ?? "";
    const indexed = part.endsWith("[]");
    const key = indexed ? part.slice(0, -2) : part;
    const last = at === parts.length - 1;
    if (indexed) {
      const list = holder[key] as unknown[];
      if (last) return { list, record: undefined, key, index: Math.max(0, list.length - 1) };
      holder = list[list.length - 1] as Field;
      continue;
    }
    if (last) return { list: undefined, record: holder, key, index: 0 };
    if (at > 0 && parts[0] === "tuning") holder[key] = { ...(holder[key] as Field) };
    holder = holder[key] as Field;
  }
  throw new Error(`${path} names no leaf`);
}

const leafValue = (leaf: SchemaLeaf): unknown => (leaf.list === undefined ? leaf.record?.[leaf.key] : leaf.list[leaf.index]);

function setLeaf(leaf: SchemaLeaf, value: unknown): void {
  if (leaf.list !== undefined) leaf.list[leaf.index] = value;
  else if (leaf.record !== undefined) leaf.record[leaf.key] = value;
}

function specialForms(): AuthoredSpecial[] {
  const forms: AuthoredSpecial[] = [];
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
      forms.push(kit.ground);
      if (kit.air !== undefined) forms.push(kit.air);
    }
  }
  return forms;
}

function companionPlacement(): SpecialPlacement {
  for (const form of specialForms()) if (form.placement?.companion !== undefined) return form.placement;
  throw new Error("no authored placement has a companion");
}

function authoredProjectile(): SpecialProjectile {
  for (const form of specialForms()) {
    const projectile = form.projectiles?.[0];
    if (projectile !== undefined) return projectile;
  }
  throw new Error("no authored special has a projectile");
}

function mutatedValue(row: FighterFieldRow, value: unknown): unknown {
  if (typeof value === "boolean") return !value;
  if (row.type === "ref" || row.type === "optionalRef") {
    const writer = row.canon === "none" ? undefined : row.canon.writer;
    if (writer === "digest" || writer === "specText") {
      if (value !== undefined) return undefined;
      return row.path.startsWith("projectiles") ? authoredProjectile() : companionPlacement();
    }
    return value === undefined ? {} : { ...(value as Field) };
  }
  if (typeof value === "number") return row.type === "real" ? value + 0.5 : value + 1;
  if (value === undefined) return 1;
  return undefined;
}

interface Armed {
  readonly base: Fighter;
  readonly changed: Fighter;
  readonly hash: string;
}

const alone = (snapshot: ReplayState, fighter: Fighter): ReplayState => ({ ...snapshot, world: createRoster(1, [fighter]) });

function armedFighters(row: FighterFieldRow, armed: Map<string, Armed>, snapshot: ReplayState): Armed {
  const when = (row.canon === "none" ? [] : row.canon.when ?? []).filter((guard) => ["kobold", "condition", "poison", "buff", "companion"].includes(guard));
  const key = when.join();
  const known = armed.get(key);
  if (known !== undefined) return known;
  const base = createFighter(when.includes("kobold") ? Character.kobold : Character.beastmaster, 0.0, 1);
  if (when.includes("condition")) base.status.condition = 1;
  if (when.includes("poison")) base.status.poisonFrames = 3;
  if (when.includes("buff")) base.status.buff = 1;
  if (when.includes("companion")) {
    base.placed.spec = companionPlacement();
    for (const animal of base.pack) animal.spec = base.placed.spec;
  }
  base.projectileSlots = PROJECTILE_CAPACITY;
  base.restingGroups = 0;
  const fighters = { base, changed: createFighter(base.character, 0.0, 1), hash: stateHash(alone(snapshot, base)) };
  armed.set(key, fighters);
  return fighters;
}

test("every Fighter schema row, changed alone, is told apart by sameFighterState and changes stateHash unless its canon is none [k2 property]", () => {
  const misses: string[] = [];
  const armed = new Map<string, Armed>();
  const snapshot = createReplaySnapshot();
  let rows = 0;
  for (const row of FIGHTER_FIELDS) {
    const { base, changed, hash } = armedFighters(row, armed, snapshot);
    copyFighterState(changed, base, 1);
    if (!sameFighterState(changed, base)) misses.push(`${row.path}: the copy differs`);
    if (row.path === "projectileSlots") {
      changed.projectileSlots--;
      if (!sameFighterState(changed, base) || stateHash(alone(snapshot, changed)) !== hash) misses.push(`${row.path}: a lower bound over resting slots changed the state`);
      rows++;
      continue;
    }
    if (row.path === "restingGroups") {
      const resting = createFighter(base.character, 0.0, 1);
      const awake = createFighter(base.character, 0.0, 1);
      awake.restingGroups = 0;
      if (!sameFighterState(awake, resting) || stateHash(alone(snapshot, awake)) !== stateHash(alone(snapshot, resting))) misses.push(`${row.path}: a weaker resting claim over spawn groups changed the state`);
      rows++;
      continue;
    }
    if (row.type === "length") {
      const list = leafValue(schemaLeaf(changed, row.path.slice(0, -".length".length))) as unknown[];
      list.length = list.length - 1;
    } else {
      const leaf = schemaLeaf(changed, row.path);
      setLeaf(leaf, mutatedValue(row, leafValue(leaf)));
    }
    if (sameFighterState(changed, base)) misses.push(`${row.path}: sameFighterState`);
    const hashed = row.canon !== "none" || row.type === "length";
    if ((stateHash(alone(snapshot, changed)) !== hash) !== hashed) misses.push(`${row.path}: stateHash ${hashed ? "unchanged" : "changed"}`);
    rows++;
  }
  assertEquals(rows, FIGHTER_FIELDS.length);
  assertEquals(misses.join("; "), "");
});
