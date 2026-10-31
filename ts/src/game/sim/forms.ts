import type { Character } from "./codes";
import type { Fighter } from "./fighter";
import { authoredTuning, catalogHero } from "./tuning";

export function becomeForm(f: Fighter, character: Character): void {
  const next = authoredTuning(character);
  const { tuning } = f;
  f.character = character;
  tuning.moves = next.moves;
  tuning.specials = next.specials;
  tuning.ultimate = next.ultimate;
  tuning.physics = next.physics;
  tuning.surface = next.surface;
  tuning.ground = next.ground;
  tuning.dashGrab = next.dashGrab;
  tuning.shield = next.shield;
  tuning.tech = next.tech;
  tuning.shieldBreak = next.shieldBreak;
}

export function restoreHomeForm(f: Fighter): void {
  const home = catalogHero(f.character)?.homeForm;
  if (home !== undefined && home !== f.character) becomeForm(f, home);
}
