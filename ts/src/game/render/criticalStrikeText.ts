import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { floorMod } from "wisp/src/sim/intMath";
import { CRITICAL_STRIKE_COLOUR, CRITICAL_STRIKE_FRAMES, CRITICAL_STRIKE_HEAD, CRITICAL_STRIKE_RISE, criticalStrikeAlpha, criticalStrikeHeight, criticalStrikeText } from "../presentation/criticalStrike";
import type { WorldOrigin } from "./effects";

const POOL = 4;

interface ShownCritical { age: number; x: number; z: number }

export class CriticalStrikeText {
  private readonly tags: texttag[] = [];
  private readonly shown: (ShownCritical | undefined)[] = [];
  private next = 0;

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    for (let index = 0; index < POOL; index++) {
      const tag = CreateTextTag();
      SetTextTagPermanent(tag, true);
      SetTextTagVisibility(tag, false);
      this.tags.push(tag);
      this.shown.push(undefined);
    }
  }

  show(x: number, z: number, damage: number): void {
    const index = this.next;
    this.next = floorMod(this.next + 1, POOL);
    const tag = at(this.tags, index);
    SetTextTagText(tag, criticalStrikeText(damage), criticalStrikeHeight(damage));
    this.shown[index] = { age: 0, x, z };
    this.place(index);
    SetTextTagVisibility(tag, true);
  }

  tick(): void {
    for (let index = 0; index < POOL; index++) {
      const shown = this.shown[index];
      if (shown === undefined) continue;
      shown.age++;
      if (shown.age >= CRITICAL_STRIKE_FRAMES) this.hideAt(index);
      else this.place(index);
    }
  }

  clear(): void {
    for (let index = 0; index < POOL; index++) this.hideAt(index);
  }

  private place(index: number): void {
    const shown = this.shown[index];
    if (shown === undefined) return;
    const tag = at(this.tags, index);
    SetTextTagPos(tag, this.origin.x + shown.x, this.origin.y, this.origin.z + shown.z + CRITICAL_STRIKE_HEAD + f32(shown.age * CRITICAL_STRIKE_RISE));
    SetTextTagColor(tag, CRITICAL_STRIKE_COLOUR.red, CRITICAL_STRIKE_COLOUR.green, CRITICAL_STRIKE_COLOUR.blue, criticalStrikeAlpha(shown.age));
  }

  private hideAt(index: number): void {
    if (this.shown[index] === undefined) return;
    this.shown[index] = undefined;
    SetTextTagVisibility(at(this.tags, index), false);
  }
}
