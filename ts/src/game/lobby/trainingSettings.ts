import { floorMod } from "wisp/src/sim/intMath";
import { PARTNER_BEHAVIOURS, PARTNER_DAMAGE_MAX, PARTNER_DAMAGE_STEP, PARTNER_ESCAPES, PARTNER_TECHS, TRAINING_SPEEDS } from "../match/trainingState";
import { type MatchState } from "./lobbyState";
import { settingRules } from "./matchRules";

export function setTutorialLesson(game: MatchState, slot: number, lesson: number, lessons: number): void {
  if (settingRules(game, slot) && lesson >= -1 && lesson < lessons) game.trainer.lesson = lesson;
}

const cycle = (value: number, count: number, direction: number): number => floorMod(value + direction, count);

export function stepPartnerBehaviour(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.behaviour = cycle(game.trainer.behaviour, PARTNER_BEHAVIOURS, direction);
}

export function stepPartnerEscape(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.escape = cycle(game.trainer.escape, PARTNER_ESCAPES, direction);
}

export function stepPartnerTech(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.tech = cycle(game.trainer.tech, PARTNER_TECHS, direction);
}

export function setPartnerDamage(game: MatchState, slot: number, damage: number): void {
  if (settingRules(game, slot) && damage >= 0 && damage <= PARTNER_DAMAGE_MAX && floorMod(damage, PARTNER_DAMAGE_STEP) === 0) game.trainer.damage = damage;
}

export function stepTrainingSpeed(game: MatchState, slot: number, direction: number): void {
  if (!settingRules(game, slot)) return;
  const index = TRAINING_SPEEDS.indexOf(game.trainer.speed);
  game.trainer.speed = TRAINING_SPEEDS[cycle(index < 0 ? 0 : index, TRAINING_SPEEDS.length, direction)] ?? 1;
}

export function setHitAreas(game: MatchState, slot: number, shown: boolean): void {
  if (settingRules(game, slot)) game.trainer.showHitAreas = shown;
}
