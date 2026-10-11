import { addFloat32 } from "wisp/src/sim/binary32";
import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, ContactKind, HeroStatusKind, SpecialAction } from "./codes";
import { CHILL } from "./chill";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import type { HitEffect } from "./hitRegions";
import { applyAttackHit } from "./hits";
import { TRAITS, TRAIT_MOVES, type Trait, type TraitMove, moveTraits } from "./identityTraits";
import { type Roster, createRoster } from "./roster";
import { FIGHTER_ULTIMATES } from "./ultimates";

// One contact carrying every contact trait: a status, meter drain and steal, met by
// a Banished target beside a plain one so a spell amplification shows as a gap.
const LADEN: Readonly<HitEffect> = { damage: 8.0, growth: 0.0, base: 0.0, launchX: 1.0, launchZ: 0.0, electric: false, manaDrain: 5, manaSteal: 5 };
const HITS = 5;
const SOURCE_DAMAGE = 40.0;
const TARGET_MANA = 50;

const ORDINARY_STYLES: readonly AttackStyle[] = (Object.values(AttackStyle) as AttackStyle[]).filter((style) => style !== AttackStyle.grab);
const ORDINARY_GRAB_KINDS: readonly ContactKind[] = [ContactKind.throw, ContactKind.pummel];

const BUILT_IN_ACTIONS: { readonly [character: number]: Readonly<Record<Exclude<TraitMove, "ultimate">, SpecialAction>> | undefined } = {
  [Character.rifleman]: { neutral: SpecialAction.riflemanBlaster, side: SpecialAction.riflemanBear, up: SpecialAction.riflemanRecovery, down: SpecialAction.riflemanTrap },
  [Character.demonHunter]: { neutral: SpecialAction.demonHunterManaBurn, side: SpecialAction.demonHunterFelRush, up: SpecialAction.demonHunterWingAscent, down: SpecialAction.demonHunterImmolate },
};
const HERO_ACTIONS = { neutral: SpecialAction.heroNeutral, side: SpecialAction.heroSide, up: SpecialAction.heroUp, down: SpecialAction.heroDown };

function actionFor(character: Character, move: TraitMove): SpecialAction {
  return move === "ultimate" ? SpecialAction.heroUltimate : (BUILT_IN_ACTIONS[character] ?? HERO_ACTIONS)[move];
}

interface Bout { readonly world: Roster; readonly source: Fighter; readonly banished: Fighter; readonly plain: Fighter }

function bout(character: Character): Bout {
  const source = createFighter(character, 0.0, 1);
  const banished = createFighter(Character.rifleman, 40.0, -1);
  const plain = createFighter(Character.rifleman, 40.0, -1);
  source.status.damage = SOURCE_DAMAGE;
  source.motion.grounded = false;
  source.jump.remaining = 0;
  banished.status.condition = HeroStatusKind.banish;
  banished.status.conditionFrames = 600;
  banished.mana.points = TARGET_MANA;
  plain.mana.points = TARGET_MANA;
  return { world: createRoster(7, [source, banished, plain]), source, banished, plain };
}

/** Lands one laden contact on both targets and returns what traits it showed. */
function strike(b: Bout, contact: (target: number) => void): { damage: number; traits: Partial<Record<Trait, boolean>> } {
  const before = b.plain.status.damage;
  const banishedBefore = b.banished.status.damage;
  const sourceBefore = b.source.status.damage;
  beginDamageContacts();
  contact(1);
  contact(2);
  finishDamageContacts(b.world);
  const damage = b.plain.status.damage - before;
  return {
    damage,
    traits: {
      status: b.plain.status.condition !== HeroStatusKind.none,
      mana: b.plain.visuals.manaDrained > 0 || b.banished.visuals.manaDrained > 0,
      spell: b.banished.status.damage - banishedBefore !== damage,
      heal: b.source.status.damage < sourceBefore,
    },
  };
}

// The traits a kit authors on a move, read from its data (heal, status, meter).
function authoredTraits(data: unknown, found: Partial<Record<Trait, true>> = {}, seen: unknown[] = []): Partial<Record<Trait, true>> {
  if (data === null || typeof data !== "object" || seen.includes(data)) return found;
  seen.push(data);
  for (const [key, value] of Object.entries(data)) {
    if ((key === "status" || key === "strikeStatus" || key === "catchHeal") && value !== undefined) found[key === "catchHeal" ? "heal" : "status"] = true;
    if (key === "chillsStriker" && value === true) found.status = true;
    if (key === "heal" && ((typeof value === "number" && value > 0) || (typeof value === "object" && value !== null && (value as { heal: number }).heal > 0))) found.heal = true;
    if ((key === "manaDrain" || key === "manaSteal") && typeof value === "number" && value > 0) found.mana = true;
    authoredTraits(value, found, seen);
  }
  return found;
}

test("ordinary moves carry no identity trait on any fighter, and each declared trait fires on its declared special and matches the kit [k2 property]", () => {
  for (const character of Object.values(Character) as Character[]) {
    for (const style of ORDINARY_STYLES) {
      const b = bout(character);
      b.source.attack.style = style;
      let first: number | undefined;
      for (let hit = 1; hit <= HITS; hit++) {
        b.source.attack.serial = hit;
        const before = b.plain.status.damage;
        const seen = strike(b, (target) => applyAttackHit(b.world, 0, target, style, 1, LADEN, true, false, CHILL));
        first ??= b.plain.status.damage;
        assertEquals(b.plain.status.damage, addFloat32(before, first), `fighter ${character} style ${style} hit ${hit}: counted damage`);
        for (const trait of TRAITS) assertEquals(seen.traits[trait], false, `fighter ${character} style ${style} hit ${hit}: ${trait}`);
        assertEquals(b.source.jump.remaining, 0, `fighter ${character} style ${style} hit ${hit}: jump refund`);
        assertEquals(b.source.status.condition, HeroStatusKind.none, `fighter ${character} style ${style} hit ${hit}: reactive status`);
      }
    }
    for (const kind of ORDINARY_GRAB_KINDS) {
      const b = bout(character);
      const seen = strike(b, (target) => collectDamageContact(b.world, 0, target, LADEN, 1, kind, kind === ContactKind.pummel, undefined, false, CHILL));
      for (const trait of TRAITS) assertEquals(seen.traits[trait], false, `fighter ${character} contact ${kind}: ${trait}`);
    }
    const hero = HERO_ROSTER.find((candidate) => candidate.character === character);
    for (const move of TRAIT_MOVES) {
      const declared = moveTraits(character, move);
      const b = bout(character);
      b.source.special.action = actionFor(character, move);
      const seen = strike(b, (target) => applyAttackHit(b.world, 0, target, AttackStyle.jab, 1, LADEN, true, false, CHILL));
      for (const trait of ["status", "mana", "spell"] as const) assertEquals(seen.traits[trait], declared[trait] === true, `fighter ${character} ${move}: ${trait}`);
      const kit = move === "ultimate" ? FIGHTER_ULTIMATES[character] : hero?.specials?.[move];
      if (kit === undefined && move !== "ultimate" && BUILT_IN_ACTIONS[character] !== undefined) continue;
      const authored = authoredTraits(kit);
      for (const trait of ["status", "heal", "mana"] as const) assertEquals(authored[trait] === true, declared[trait] === true, `fighter ${character} ${move}: authored ${trait}`);
    }
  }
});
