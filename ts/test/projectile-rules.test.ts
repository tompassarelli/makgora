// The projectile rules (smashcraft:docs/gameplay-design.md, "Projectiles and
// powershield", #98) as one table, measured as one property over every
// fighter's projectiles, the original three and each registered hero, through
// the interaction graph's projectile situations (interactions.ts). A fighter
// that breaks a rule on purpose names a departure below and in that section.
import { expect, test } from "bun:test";
import { sweep } from "./sweep";
import { Character } from "../src/game/sim/codes";
import { HERO_ROSTER } from "../src/game/sim/heroes/registry";
import { PROJECTILE_SPACINGS, outOfShieldStarts, projectileRows } from "../scripts/interactions";

type Row = ReturnType<typeof projectileRows>[number];
type Start = ReturnType<typeof outOfShieldStarts>[number];

const POINT_BLANK = PROJECTILE_SPACINGS[0];
const MIN_POWERSHIELD_PRESSES = 2;
const MAX_TRAVELING_OUT = 3;
const MAX_PERSISTENT_OUT = 2;
const MAX_FLIGHT = 90;

/** Each rule once: what a projectile situation that breaks it shows, or undefined. */
const PROJECTILE_RULES: readonly { readonly rule: number; readonly broken: (row: Row) => string | undefined }[] = [
  { rule: 1, broken: (row) => row.traveling && row.arrives !== undefined && row.powershield.length < MIN_POWERSHIELD_PRESSES ? `${row.variant}: powershield presses ${row.powershield.join(",") || "none"}` : undefined },
  { rule: 2, broken: (row) => row.distance === POINT_BLANK && row.arrives !== undefined && !row.pokes && row.punishes.length === 0 ? `${row.variant}: no out-of-shield punish (advantage ${row.advantage})` : undefined },
  { rule: 3, broken: (row) => row.mostOut > (row.traveling ? MAX_TRAVELING_OUT : MAX_PERSISTENT_OUT) ? `${row.mostOut} out at once` : undefined },
  { rule: 4, broken: (row) => row.traveling && row.flight > MAX_FLIGHT ? `flies ${row.flight} frames` : undefined },
  { rule: 5, broken: (row) => row.hitsIdle && row.powershield.length === 0 && row.answers.every((answer) => answer.starts.length === 0) ? `${row.variant}: no answer but holding shield` : undefined },
];
/** Rule 6: every out-of-shield option starts from shield. */
const SHIELD_RULE = { rule: 6, broken: (start: Start) => start.start === undefined ? `${start.option} never starts from shield` : undefined };

/** "fighter source rule N" to its reason; each is also named in gameplay-design.md. A departure that no longer occurs fails. */
const SUMMON_SHOT = "a placed summon's shot: the commitment is the placement, the summon can be hit or destroyed, and the summoner's recovery is past when the shot reaches the shield";
const DEPARTURES: Readonly<Record<string, string>> = {
  "Beastmaster down special rule 2": SUMMON_SHOT,
  "Jaina Proudmoore down special rule 2": SUMMON_SHOT,
  "Goblin Tinker down special rule 2": SUMMON_SHOT,
};

const FIGHTERS: readonly { readonly character: Character; readonly name: string }[] = [
  { character: Character.rifleman, name: "Rifleman" },
  { character: Character.demonHunter, name: "Illidan" },
  ...HERO_ROSTER.map((hero) => ({ character: hero.character, name: hero.name })),
];

function violations(character: Character, name: string): Map<string, string> {
  const found = new Map<string, string>();
  const add = (source: string, rule: number, detail: string | undefined): void => {
    const key = `${name} ${source} rule ${rule}`;
    if (detail !== undefined && !found.has(key)) found.set(key, detail);
  };
  for (const row of projectileRows(character, name)) for (const { rule, broken } of PROJECTILE_RULES) add(row.source, rule, broken(row));
  for (const start of outOfShieldStarts(character)) add("out of shield", SHIELD_RULE.rule, SHIELD_RULE.broken(start));
  return found;
}

/** Every listed fighter's breaks are declared departures, and every departure for them still occurs. */
function followRules(fighters: readonly { readonly character: Character; readonly name: string }[]): void {
  const found = new Map(fighters.flatMap((fighter) => [...violations(fighter.character, fighter.name)]));
  expect([...found].filter(([key]) => DEPARTURES[key] === undefined).map(([key, detail]) => `${key}: ${detail}`)).toEqual([]);
  expect(Object.keys(DEPARTURES).filter((key) => fighters.some((fighter) => key.startsWith(`${fighter.name} `)) && !found.has(key))).toEqual([]);
}

// The whole roster runs as a sweep; its smallest form, the original two fighters, runs in the suite.
sweep("every fighter's projectiles follow the projectile rules or name a departure [k2 property]", () => followRules(FIGHTERS), 600_000);
// About 1.5 s and 53,400 frames; a loaded host takes several times that, past Bun's 5 s default.
test("the original two fighters' projectiles follow the projectile rules or name a departure [k2 property]", () => followRules(FIGHTERS.slice(0, 2)), 30_000);
