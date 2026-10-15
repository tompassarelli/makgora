import { Character, ItemKind, SpecialAction } from "../sim/codes";
import type { SpecialProjectile } from "../sim/specials/schema";
import { FIGHTER_ULTIMATES } from "../sim/ultimates";
import { AVATAR_MODEL } from "./itemLook";

export const VOICED_MODELS: readonly string[] = [AVATAR_MODEL];
export const isVoicedModel = (model: string | undefined): boolean => model !== undefined && VOICED_MODELS.includes(model);

export const AVATAR_CAST: Readonly<SpecialProjectile> | undefined = FIGHTER_ULTIMATES[Character.mountainKing]?.projectiles?.find((spec) => spec.model === AVATAR_MODEL);

export const AvatarView = { hidden: 0, casting: 1, held: 2 } as const;
export type AvatarView = (typeof AvatarView)[keyof typeof AvatarView];

export const carrierDrawsMark = (spec: Readonly<SpecialProjectile> | undefined): boolean => spec !== undefined && spec === AVATAR_CAST;

export function avatarView(character: Character, action: SpecialAction, frame: number, held: boolean): AvatarView {
  if (character === Character.mountainKing && action === SpecialAction.heroUltimate) {
    return AVATAR_CAST !== undefined && frame >= AVATAR_CAST.spawnFrame ? AvatarView.casting : AvatarView.hidden;
  }
  return held ? AvatarView.held : AvatarView.hidden;
}

export function ultimateVoiceCues(character: Character, heldFrames: number): number {
  const ultimate = FIGHTER_ULTIMATES[character];
  if (ultimate === undefined) return 0;
  let cues = 0;
  for (const spec of ultimate.projectiles ?? []) if (isVoicedModel(spec.model) && !carrierDrawsMark(spec)) cues++;
  const buffs = character === Character.mountainKing && ultimate.buff?.kind === ItemKind.heavy;
  let shown = false;
  for (let frame = 1; frame <= ultimate.endFrame + heldFrames; frame++) {
    const casting = frame <= ultimate.endFrame;
    const held = buffs && ultimate.buff !== undefined && frame >= ultimate.buff.frame;
    const view = avatarView(character, casting ? SpecialAction.heroUltimate : SpecialAction.none, frame, held);
    if (view !== AvatarView.hidden && !shown) cues++;
    shown = view !== AvatarView.hidden;
  }
  return cues;
}
