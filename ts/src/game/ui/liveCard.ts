import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { costumeClipModel, costumeIndex, partnerLook } from "../roster/costumes";
import { PARTNER_COSTUME } from "../presentation/model/costume";
import { DuoRole } from "../sim/codes";
import type { FighterOriginalClip } from "../../generated/clips/fighterOriginalClip";
import { originalClip, originalClipNamed } from "../../generated/clips/fighterOriginalClipInfo";
import { Frame, setFrameModel, setFrameSize, setFrameSpriteAnimation, setFrameSpriteTime, setFrameVisible } from "wisp/game/frames";
import { placeTopLeft } from "./frames";

/** Whether the window draws fighters itself into their cards: set by the native window's game module, never in the Warcraft build. */
export const livePortraits = { enabled: false };

const STAND_NAMES = ["stand", "stand -1", "stand - 1", "stand 1"];

function standClip(character: number): FighterOriginalClip | undefined {
  for (const name of STAND_NAMES) {
    const index = originalClipNamed(character, name);
    const clip = index === undefined ? undefined : originalClip(character, index);
    if (clip !== undefined) return clip;
  }
  return undefined;
}

/** Points a SPRITE frame at `character`'s idle `seconds` into its loop; false (leaving the frame untouched) when the fighter has no idle clip. */
export function showLiveFighter(frame: Frame, character: number, costume: number, seconds: number): boolean {
  const clip = standClip(character);
  if (clip === undefined) return false;
  const duration = clip.endSeconds - clip.startSeconds;
  const into = duration > 0 ? floorMod(seconds, duration) : 0;
  setFrameModel(frame, costumeClipModel(character, costume, clip), 0);
  setFrameSpriteAnimation(frame, 0, 0);
  setFrameSpriteTime(frame, (clip.timeline === true ? clip.startSeconds : 0) + into);
  return true;
}

/** One body a player card draws, in fractions of its square render box. */
export interface LiveBody {
  readonly costume: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** The bodies a player card draws: the fighter alone fills the box; a duo splits it, the lead on the left and the partner on the right at the partner look's match scale, both on the same floor. */
export function liveBodies(character: number, costumeChoice: number): readonly LiveBody[] {
  const costume = costumeIndex(character, costumeChoice);
  const partner = partnerLook(character, DuoRole.partner);
  if (partner === undefined) return [{ costume, left: 0.0, width: 1.0, height: 1.0 }];
  const half = f32(0.5);
  const width = f32(half * partner.scale);
  return [{ costume, left: 0.0, width: half, height: 1.0 }, { costume: PARTNER_COSTUME, left: f32(half + f32(f32(half - width) / 2)), width, height: partner.scale }];
}

export interface RenderBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Shows `character`'s live idle in `renders` (the lead's frame, then the partner's) inside `box` when the window draws fighters itself and hides the baked `portrait` behind them; otherwise hides them. */
export function presentLiveFighter(renders: readonly Frame[], box: RenderBox, portrait: Frame, shown: boolean, character: number | undefined, costumeChoice: number, seconds: number): void {
  const bodies = livePortraits.enabled && shown && character !== undefined && character >= 0 ? liveBodies(character, costumeChoice) : [];
  let live = false;
  renders.forEach((render, index) => {
    const body = bodies[index];
    const drawn = body !== undefined && character !== undefined && showLiveFighter(render, character, body.costume, seconds);
    if (body !== undefined && drawn) {
      placeTopLeft(render, f32(box.x + f32(box.width * body.left)), f32(box.y - f32(box.height * f32(1.0 - body.height))));
      setFrameSize(render, f32(box.width * body.width), f32(box.height * body.height));
      live = live || index === 0;
    }
    setFrameVisible(render, drawn);
  });
  if (live) setFrameVisible(portrait, false);
}
