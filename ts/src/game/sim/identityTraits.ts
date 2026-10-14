// Identity traits (#148): the effects beyond damage and launch a fighter's
// move may carry. This table is the one place that says which of a fighter's
// moves carry which trait; contacts, command grabs, guards and armour route
// through it, so an ordinary move (no special running) carries none.
import { Character, ContactKind, SpecialAction } from "./codes";
import type { Fighter } from "./fighter";

/** status: an applied hero status (chill, poison, silence, banish, stun...); heal: the move lowers its owner's damage; mana: drains or steals meter; spell: amplified on a Banished target. */
export type Trait = "status" | "heal" | "mana" | "spell";
export const TRAITS: readonly Trait[] = ["status", "heal", "mana", "spell"];
export type TraitSet = Readonly<Partial<Record<Trait, true>>>;

export type TraitMove = "neutral" | "side" | "up" | "down" | "ultimate";
export const TRAIT_MOVES: readonly TraitMove[] = ["neutral", "side", "up", "down", "ultimate"];
export type IdentityTraits = Readonly<Partial<Record<TraitMove, TraitSet>>>;

const SPELL: TraitSet = { spell: true };

/** Each fighter's traits by special. A move absent here carries no trait; ordinary moves are never here. */
export const IDENTITY_TRAITS: Readonly<Record<Character, IdentityTraits>> = {
  [Character.rifleman]: {},
  [Character.demonHunter]: { neutral: { status: true, mana: true }, side: { mana: true }, up: { mana: true }, down: { mana: true } },
  [Character.blademaster]: {},
  [Character.mountainKing]: {},
  [Character.warden]: { neutral: { status: true }, down: { status: true } },
  [Character.lich]: { neutral: { status: true }, down: { status: true }, ultimate: { status: true } },
  [Character.forsakenPaladin]: { side: { status: true } },
  [Character.dreadlord]: { side: { heal: true }, down: { status: true } },
  [Character.shadowHunter]: { down: { status: true } },
  [Character.pitLord]: { ultimate: { status: true } },
  [Character.beastmaster]: {},
  [Character.lichKing]: { side: { status: true } },
  [Character.thrall]: {},
  [Character.jaina]: {},
  [Character.sylvanas]: { side: { status: true }, down: { heal: true } },
  [Character.cairne]: { down: { heal: true } },
  [Character.chen]: { side: { status: true } },
  [Character.peon]: {},
  [Character.tinker]: {},
  [Character.kaelthas]: { neutral: SPELL, side: { mana: true, spell: true }, up: SPELL, down: { status: true, spell: true }, ultimate: SPELL },
  [Character.murloc]: { neutral: { status: true }, down: { status: true } },
  [Character.grom]: {},
  [Character.anubarak]: {},
  [Character.malfurion]: { neutral: { status: true } },
  [Character.medivh]: {},
  [Character.kobold]: {},
};

const NO_TRAITS: TraitSet = {};

/** The special a running action belongs to; undefined while no special runs (an ordinary move). */
export function traitMove(action: SpecialAction): TraitMove | undefined {
  switch (action) {
    case SpecialAction.heroNeutral: case SpecialAction.riflemanBlaster: case SpecialAction.demonHunterManaBurn: return "neutral";
    case SpecialAction.heroSide: case SpecialAction.riflemanBear: case SpecialAction.demonHunterFelRush: return "side";
    case SpecialAction.heroUp: case SpecialAction.riflemanRecovery: case SpecialAction.demonHunterWingAscent: return "up";
    case SpecialAction.heroDown: case SpecialAction.riflemanTrap: case SpecialAction.demonHunterImmolate: return "down";
    case SpecialAction.heroUltimate: return "ultimate";
    default: return undefined;
  }
}

export function moveTraits(character: Character, move: TraitMove | undefined): TraitSet {
  return move === undefined ? NO_TRAITS : IDENTITY_TRAITS[character][move] ?? NO_TRAITS;
}

/** The traits of the move the fighter is performing now. */
export function currentTraits(f: Readonly<Fighter>): TraitSet {
  return moveTraits(f.character, traitMove(f.special.action));
}

// A projectile, summon or placement exists only because a special spawned it, and
// its own spec carries that special's status, mana and heal; the fighter's spell
// trait follows whichever of its specials spawned it.
const SPAWNED_TRAITS: { [character: number]: TraitSet } = {};
for (const key in IDENTITY_TRAITS) {
  const character = Number(key) as Character;
  const spawned: Partial<Record<Trait, true>> = { status: true, heal: true, mana: true };
  for (const move of TRAIT_MOVES) if (moveTraits(character, move).spell === true) spawned.spell = true;
  SPAWNED_TRAITS[character] = spawned;
}

/** The traits a contact may carry: the source's current move for its own body, grabs and throws; its spawned objects otherwise. */
export function contactTraits(source: Readonly<Fighter>, kind: ContactKind, direct: boolean): TraitSet {
  if (direct || kind === ContactKind.throw || kind === ContactKind.pummel) return currentTraits(source);
  return SPAWNED_TRAITS[source.character] ?? NO_TRAITS;
}
