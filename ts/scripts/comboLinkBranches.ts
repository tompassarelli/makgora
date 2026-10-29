import { Action, bit } from "../src/game/input/actions";
import type { Character } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { heroDefinition } from "../src/game/roster/kits";
import { isHeroSpecialAction, runningHeroSpecial } from "../src/game/sim/specials/runningMove";
import { FOLLOW_UP_FORM, FollowUpInput, specialKit } from "../src/game/sim/specials/schema";
import { type Move, type Opener, away, toward } from "./comboExplorer";

export interface BranchStick {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly auto: boolean;
}

const BRANCH_STICKS = (auto: boolean): readonly BranchStick[] => [
  ["at rest", 0, 0], ["up", 0, 1], ["up toward", 1, 1], ["toward", 1, 0], ["down toward", 1, -1],
  ["down", 0, -1], ["down away", -1, -1], ["away", -1, 0], ["up away", -1, 1],
].map(([label, x, z]) => ({ name: `${auto ? "automatic" : "special"} follow-up, stick ${label}`, x: Number(x), z: Number(z), auto }));

const pressedOrAuto = (branch: { readonly input?: FollowUpInput | undefined }): boolean => (branch.input ?? FollowUpInput.special) === FollowUpInput.special || branch.input === FollowUpInput.auto;

export function branchFollowUps(attacker: Character, opener: Opener): readonly BranchStick[] {
  const slot = opener.move.slot;
  const specials = heroDefinition(attacker)?.specials;
  if (slot === undefined || specials === undefined) return [];
  const kit = specialKit(specials, slot);
  const branches = [...(kit.ground.followUps ?? []), ...(kit.air?.followUps ?? [])].filter(pressedOrAuto);
  return branches.some((branch) => branch.stick !== undefined) ? BRANCH_STICKS(branches.some((branch) => branch.input === FollowUpInput.auto)) : [];
}

export const branchOpen = (a: Readonly<Fighter>): boolean => {
  if (!isHeroSpecialAction(a.special.action) || a.special.form >= FOLLOW_UP_FORM || a.launch.hitlag > 0 || a.launch.hitstun > 0) return false;
  const next = a.special.frame + 1;
  return (runningHeroSpecial(a)?.followUps ?? []).some((branch) => pressedOrAuto(branch) && next >= branch.window.first && next <= branch.window.last);
};

export const branchMove = (stick: BranchStick): Move => ({
  name: stick.name, kind: "special",
  press: (a, b) => (stick.auto ? 0 : bit(Action.special)) | (stick.x > 0 ? toward(a, b) : stick.x < 0 ? away(a, b) : 0)
    | (stick.z > 0 ? bit(Action.moveUp) : stick.z < 0 ? bit(Action.moveDown) : 0),
});
