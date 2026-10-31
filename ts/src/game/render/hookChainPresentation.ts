import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { type Roster, fighterAt } from "../sim/roster";
import { HOOK_LINK_COUNT, HOOK_LINK_LENGTH, HOOK_LINK_MODEL, HOOK_LINK_ROLL, HOOK_LINK_SCALE, HOOK_LINK_SPACING, type HookChainSpan, emptyHookChainSpan, hookChainLength, hookChainSpan, hookLinkCount } from "../presentation/hookChain";
import { meleeAtan2 } from "../core/math/meleeScalarMath";
import { hideEffect, placeEffect, type WorldOrigin } from "./effects";
import { createEffect, destroyEffect, Effect, setEffectPitch, setEffectRoll, setEffectScale } from "wisp/game/effects";

/** The Butcher's hook chain: evenly spaced links from his hand to the hook, or to the foe he reels in. */
export class HookChainPresentation {
  // Online, Warcraft handles must be born on the same turn on every client, so every link is made at setup and only placed and hidden on presented frames.
  private readonly links: Effect[] = [];
  private shown = 0;
  private readonly span: HookChainSpan = emptyHookChainSpan();

  constructor(private readonly origin: Readonly<WorldOrigin>) {
    for (let index = 0; index < HOOK_LINK_COUNT; index++) {
      const link = createEffect(HOOK_LINK_MODEL, origin.x, origin.y);
      hideEffect(link, origin);
      this.links.push(link);
    }
  }

  present(owner: Readonly<Fighter> | undefined, roster: Roster, playing: boolean): void {
    const held = owner === undefined || owner.grab.target === undefined ? undefined : fighterAt(roster, owner.grab.target);
    if (!playing || !hookChainSpan(owner, held, this.span)) {
      this.hide();
      return;
    }
    const { fromX, fromZ, toX, toZ } = this.span;
    const dx = f32(toX - fromX), dz = f32(toZ - fromZ);
    const length = hookChainLength(this.span);
    const count = Math.min(HOOK_LINK_COUNT, hookLinkCount(length));
    const backward = dx < 0.0;
    const pitch = backward ? meleeAtan2(f32(-dx), f32(-dz)) : meleeAtan2(dx, dz);
    const scale = f32(f32(length / count) / HOOK_LINK_LENGTH);
    for (let index = 0; index < HOOK_LINK_COUNT; index++) {
      const link = this.links[index];
      if (link === undefined) continue;
      if (index >= count) {
        if (index < this.shown) hideEffect(link, this.origin);
        continue;
      }
      const along = f32((backward ? index + 1 : index) / count);
      setEffectScale(link, scale);
      setEffectPitch(link, pitch);
      setEffectRoll(link, HOOK_LINK_ROLL);
      placeEffect(link, this.origin.x + f32(fromX + f32(dx * along)), this.origin.y, this.origin.z + f32(fromZ + f32(dz * along)));
    }
    this.shown = count;
  }

  drawnEffects(into: Effect[]): void {
    for (let index = 0; index < this.shown; index++) {
      const link = this.links[index];
      if (link !== undefined) into.push(link);
    }
  }

  hide(): void {
    for (let index = 0; index < this.shown; index++) {
      const link = this.links[index];
      if (link !== undefined) hideEffect(link, this.origin);
    }
    this.shown = 0;
  }

  destroy(): void {
    this.hide();
    for (const link of this.links) destroyEffect(link);
    this.links.length = 0;
  }
}
