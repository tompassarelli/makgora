import { join, resolve } from 'node:path';
import { type FighterRules, fighterArt } from '../../ts/src/generated/fighterArtData';

const RULES = resolve(import.meta.dir, '../../ts/src/generated/fighter-art');

// Loaded by path, not imported, so each derive step's key covers only its own fighter's rules (ts/scripts/wisp/fighterArt.ts).
export const fighterRules = (character: number): FighterRules => (require(join(RULES, `${fighterArt(character).slug}.ts`)) as { readonly rules: FighterRules }).rules;
