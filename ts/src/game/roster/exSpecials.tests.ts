import { assertEquals, test } from "wisp/src/runtime/testing";
import type { AuthoredSpecial, FrameWindow, SpecialKit } from "../sim/specials/schema";
import { HERO_ROSTER } from "./kits";

const window = (frames: FrameWindow | undefined): string => frames === undefined ? "-" : `${frames.first}-${frames.last}`;

function timing(move: AuthoredSpecial): string {
  return [
    `end ${move.endFrame}`, `landing ${move.landingLag ?? "-"}/${move.fallLandingLag ?? "-"}`, `aim ${move.aimFrames ?? "-"}`,
    `regions ${(move.regions ?? []).map(region => `${region.firstFrame}-${region.lastFrame}`).join(",")}`,
    `shots ${(move.projectiles ?? []).map(shot => shot.spawnFrame).join(",")}`,
    `intangible ${window(move.intangible)}`, `armor ${window(move.armor)}`, `guard ${move.guard?.first ?? "-"}`, `stall ${window(move.airStall)}`,
    `follow-ups ${(move.followUps ?? []).map(branch => `${window(branch.window)}:${timing(branch.special)}`).join(";")}`,
  ].join(" ");
}

function forms(kit: SpecialKit): readonly (readonly [string, AuthoredSpecial])[] {
  const all: (readonly [string, AuthoredSpecial])[] = [];
  const add = (label: string, move: AuthoredSpecial | undefined): void => {
    if (move === undefined) return;
    all.push([label, move]);
    move.variants?.forEach((variant, index) => all.push([`${label} variant ${index}`, variant]));
  };
  add("ground", kit.ground);
  add("air", kit.air);
  add("recall", kit.recall);
  return all;
}

test("Every fighter's EX special keeps its base move's frame data: the same end, landing lag, active windows, shot frames and protection windows (a counter may hold its guard longer), so EX is never faster and never adds armor or invulnerability [k3 measure docs/design/mana.md]", () => {
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
      for (const [label, move] of forms(kit)) {
        if (move.ex === undefined) continue;
        assertEquals(timing(move.ex), timing(move), `${hero.name} ${kit.name} ${label}`);
      }
    }
  }
});
