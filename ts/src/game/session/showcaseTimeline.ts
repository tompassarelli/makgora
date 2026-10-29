import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import type { Character } from "../sim/codes";
import { AttackStyle } from "../sim/codes";
import type { AuthoredMove, MoveRegion } from "../sim/heroMoves";
import { authoredTuning } from "../sim/tuning";
import { heroDefinition } from "../roster/kits";
import { attackDurationFramesForGrounding, attackStartupFrames, isAerialAttack } from "../sim/moves";
import { type AuthoredSpecial, type FighterSpecials, FollowUpInput, SpecialSlot, specialKit } from "../sim/specials/schema";
import { heroCueWindows } from "../presentation/cueWindows";
import { SHIELD_PROJECTILE_SPEED_MULTIPLIER } from "../sim/shield";
import { hurtCapsule } from "../sim/geometry/contactGeometry";
import { ordinaryHitlagFrames } from "../sim/knockback";

export const SHOWCASE_FIRST_FRAME = 40;
export const SHOWCASE_SPECIAL_SLOTS: readonly string[] = ["neutral_b", "side_b", "up_b", "down_b"];
export const SHOWCASE_FACINGS: readonly ("right" | "left")[] = ["right", "left"];
const CHARGED_SHOWCASE_GAP = 70;
const SHOWCASE_DEFAULT_GAP = 500;
const SHOWCASE_DUMMY_MIDDLE = 60;
const INCOMING_GAP = 300;
const INCOMING_BODY = 40;

export interface ShowcaseMove {
  readonly slot: string;
  readonly kind: "normal" | "special" | "ultimate";
  readonly code: number;
  readonly first: number;
  readonly end: number;
  readonly gap?: number | undefined;
  readonly lift?: number | undefined;
  readonly incoming?: { readonly lead: number; readonly gap: number } | undefined;
  readonly again?: { readonly frame: number; readonly gap: number } | undefined;
  readonly charging?: readonly number[] | undefined;
  readonly release?: number | undefined;
  readonly swing?: readonly number[] | undefined;
  readonly cross?: { readonly frame: number; readonly gap: number } | undefined;
  readonly hold?: { readonly frame: number; readonly frames: number } | undefined;
}

export interface ShowcaseRow {
  readonly row: string;
  readonly move: ShowcaseMove;
  readonly facing: "right" | "left";
  readonly frames: number[];
}

export function showcaseMoves(character: Character): ShowcaseMove[] {
  const tuning = authoredTuning(character);
  const original = heroDefinition(character) === undefined;
  const normals = Object.entries(AttackStyle).filter(([, code]) => tuning.moves?.normals[code] !== undefined
    || (original && code !== AttackStyle.grab && code !== AttackStyle.dashAttack));
  const moves: ShowcaseMove[] = normals.map(([slot, code]) => ({ slot, kind: "normal", code, first: attackStartupFrames(code, tuning.moves), end: attackDurationFramesForGrounding(code, !isAerialAttack(code), tuning.moves), ...(isAerialAttack(code) ? { gap: aerialGap(tuning.moves?.normals[code]), lift: aerialLift(tuning.moves?.normals[code]) } : groundPlacement(tuning.moves?.normals[code], code, character)) }));
  SHOWCASE_SPECIAL_SLOTS.forEach((slot, code) => {
    const special = tuning.specials === undefined ? undefined : specialKit(tuning.specials, code).ground;
    const charged = special === undefined ? undefined : chargedShowcase(slot, code, special) ?? channelledShowcase(slot, code, special);
    moves.push(charged ?? { slot, kind: "special", code, first: special === undefined ? 12 : heroCueWindows(special).active.first, end: special?.endFrame ?? 120, gap: special === undefined ? undefined : specialGap(special), ...rushShowcase(special), incoming: special === undefined || tuning.specials === undefined ? undefined : incomingShot(special, tuning.specials) });
  });
  if (tuning.ultimate !== undefined) moves.push({ slot: "ultimate", kind: "ultimate", code: 0, first: heroCueWindows(tuning.ultimate).active.first, end: tuning.ultimate.endFrame, gap: specialGap(tuning.ultimate) });
  return moves;
}

function incomingShot(special: Readonly<AuthoredSpecial>, specials: Readonly<FighterSpecials>): { lead: number; gap: number } | undefined {
  const window = special.reflects;
  const shot = specialKit(specials, SpecialSlot.neutral).ground?.projectiles?.find(projectile => projectile.reflectable && projectile.velocityX > 0.0);
  if (window === undefined || shot === undefined) return undefined;
  const roundTrip = f32(f32(f32(shot.life * shot.velocityX) * SHIELD_PROJECTILE_SPEED_MULTIPLIER) / f32(1.0 + SHIELD_PROJECTILE_SPEED_MULTIPLIER));
  const gap = Math.min(INCOMING_GAP, Math.floor(roundTrip));
  const arrival = shot.spawnFrame + Math.ceil(f32(f32(f32(gap - shot.offsetX) - INCOMING_BODY) / shot.velocityX));
  const lead = arrival - floorDiv(window.first + window.last, 2);
  return lead > 0 ? { lead, gap } : undefined;
}

function chargedShowcase(slot: string, code: number, special: Readonly<AuthoredSpecial>): ShowcaseMove | undefined {
  const charge = special.charge;
  const released = charge?.releases === true;
  const full = charge === undefined ? undefined : special.followUps?.find((followUp) => followUp.chargeStage === charge.stages && (released ? followUp.input === FollowUpInput.release : followUp.input === undefined && followUp.window.first <= charge.hold + 3 && followUp.window.last >= charge.hold + 3))?.special;
  if (charge === undefined || full === undefined) return undefined;
  const frame = charge.hold + charge.full + 2;
  const handful = floorDiv(charge.full, charge.stages);
  const charging = Array.from({ length: charge.stages + 1 }, (_, stage) => charge.hold + stage * handful);
  if (released) {
    const hits = full.regions ?? [], first = frame + 1 + Math.min(...hits.map(region => region.firstFrame)), last = frame + 1 + Math.max(...hits.map(region => region.lastFrame));
    return { slot, kind: "special", code, first, end: frame + full.endFrame, release: frame, charging, swing: [first + floorDiv(last - first, 2), last] };
  }
  return {
    slot, kind: "special", code, first: frame + heroCueWindows(full).active.first, end: frame + full.endFrame, again: { frame, gap: CHARGED_SHOWCASE_GAP },
    charging,
  };
}

function channelledShowcase(slot: string, code: number, special: Readonly<AuthoredSpecial>): ShowcaseMove | undefined {
  const channel = special.channel;
  if (channel === undefined) return undefined;
  const wave = channel.last - channel.first + 1;
  const release = channel.first + channel.rewinds * wave + floorDiv(wave, 2);
  const impacts = Array.from({ length: channel.rewinds + 1 }, (_, index) => channel.first + index * wave + floorDiv(wave * 2, 3));
  const falls = impacts.map(frame => frame - floorDiv(wave, 3));
  return { slot, kind: "special", code, first: channel.first, end: release + special.endFrame - channel.last, release, charging: [...falls, ...impacts], gap: specialGap(special) };
}

const centreX = (region: MoveRegion): number => (region.hit.minX + region.hit.maxX) * 0.5;
const centreZ = (region: MoveRegion): number => (region.hit.minZ + region.hit.maxZ) * 0.5;

function rushShowcase(special: Readonly<AuthoredSpecial> | undefined): Pick<ShowcaseMove, "swing" | "hold"> {
  const rush = special?.motion?.find((segment) => segment.velocityX > 0.0 && segment.stopsAtBody === true);
  if (special === undefined || rush === undefined) return {};
  return { swing: [floorDiv(rush.first + rush.last, 2), rush.last], hold: { frame: rush.first - 1, frames: special.endFrame - rush.first + 1 } };
}

function groundPlacement(move: Readonly<AuthoredMove> | undefined, style: AttackStyle, character: Character): { readonly gap?: number | undefined; readonly lift?: number | undefined; readonly cross?: { readonly frame: number; readonly gap: number } | undefined; readonly swing?: readonly number[] | undefined } {
  if (move === undefined || move.regions.length === 0) return { gap: reachGap(move) };
  if (style === AttackStyle.upTilt || style === AttackStyle.upSmash) return overheadPlacement(move, character);
  if (style !== AttackStyle.downSmash) return { gap: reachGap(move) };
  const ahead = move.regions.filter((region) => centreX(region) > 0.0), behind = move.regions.filter((region) => centreX(region) < 0.0);
  const opens = (regions: readonly MoveRegion[]) => Math.min(...regions.map((region) => region.firstFrame));
  if (ahead.length === 0 || behind.length === 0 || opens(ahead) === opens(behind)) return { gap: reachGap(move) };
  const [early, late] = opens(ahead) < opens(behind) ? [ahead, behind] : [behind, ahead];
  const lateGap = regionGap(late, move.travelX ?? 0.0);
  if (lateGap === undefined || opens(late) - opens(early) < 2) return { gap: lateGap };
  const contact = opens(late) + ordinaryHitlagFrames(Math.max(...early.map((region) => region.hit.effect.damage)));
  return { gap: regionGap(early, move.travelX ?? 0.0), cross: { frame: opens(late) - 1, gap: lateGap }, swing: [contact, contact + 2] };
}

function overheadPlacement(move: Readonly<AuthoredMove>, character: Character): { readonly gap?: number | undefined; readonly lift?: number | undefined } {
  const body = hurtCapsule(character), top = Math.max(body.z1, body.z2) + body.radius;
  const highest = move.regions.reduce((best, region) => centreZ(region) > centreZ(best) ? region : best);
  return centreZ(highest) - top > Math.abs(centreX(highest)) ? { gap: Math.floor(centreX(highest)), lift: Math.floor(centreZ(highest)) } : { gap: reachGap(move) };
}

function reachGap(move: Readonly<AuthoredMove> | undefined): number | undefined {
  return move === undefined ? undefined : regionGap(move.regions, move.travelX ?? 0.0);
}

function furthest(regions: readonly MoveRegion[]): { readonly front: boolean; readonly region: MoveRegion } | undefined {
  if (regions.length === 0) return undefined;
  const front = regions.reduce((best, region) => region.hit.maxX > best.hit.maxX ? region : best);
  const back = regions.reduce((best, region) => region.hit.minX < best.hit.minX ? region : best);
  return front.hit.maxX >= -back.hit.minX ? { front: true, region: front } : { front: false, region: back };
}

function regionGap(regions: readonly MoveRegion[], travel: number): number | undefined {
  const reach = furthest(regions);
  if (reach === undefined) return undefined;
  return reach.front ? Math.floor(travel + reach.region.hit.maxX * 0.75) : Math.floor(reach.region.hit.minX * 0.75);
}

function aerialContact(move: Readonly<AuthoredMove> | undefined): MoveRegion | undefined {
  return move?.regions.reduce<MoveRegion | undefined>((last, region) => last === undefined || region.lastFrame > last.lastFrame ? region : last, undefined);
}

function aerialGap(move: Readonly<AuthoredMove> | undefined): number | undefined {
  const region = aerialContact(move);
  return region === undefined ? undefined : Math.floor((region.hit.minX + region.hit.maxX) * 0.5);
}

function aerialLift(move: Readonly<AuthoredMove> | undefined): number | undefined {
  const region = aerialContact(move);
  return region === undefined ? undefined : Math.floor((region.hit.minZ + region.hit.maxZ) / 2 - SHOWCASE_DUMMY_MIDDLE);
}

function specialGap(special: Readonly<AuthoredSpecial>): number | undefined {
  if (special.radial === true) return radialGap(special);
  let travel = 0.0;
  for (const segment of special.motion ?? []) travel += segment.velocityX * (segment.last - segment.first + 1);
  const projectile = special.projectiles?.[0];
  if ((special.regions ?? []).length === 0 && projectile !== undefined) return Math.floor(Math.min(SHOWCASE_DEFAULT_GAP, projectile.offsetX + Math.abs(projectile.velocityX) * projectile.life * 0.5));
  const grab = special.commandGrab?.strike;
  if ((special.regions ?? []).length === 0 && grab !== undefined) return Math.floor(Math.max(0.0, travel) + (Math.max(grab.x1, grab.x2) + grab.radius) * 0.75);
  return regionGap(special.regions ?? [], Math.max(0.0, travel));
}

function radialGap(special: Readonly<AuthoredSpecial>): number | undefined {
  if (special.radial !== true) return undefined;
  let reach = 0.0;
  for (const region of special.regions ?? []) reach = Math.max(reach, region.hit.strike?.radius ?? 0.0);
  return Math.floor(reach * 0.75);
}

export function showcaseFrames(move: ShowcaseMove): number[] {
  const duration = Math.max(8, move.end);
  const samples = move.kind === "ultimate" ? [1, Math.max(2, floorDiv(move.first, 2)), move.first, Math.round(duration / 3), Math.round(duration * 2 / 3), duration, duration + 2, duration + 300]
    : [...(move.charging ?? []), ...(move.swing ?? []), 1, Math.max(2, floorDiv(move.first, 2)), move.first - 2, move.first, move.first + 1, move.first + 3, Math.round((move.first + 3 + duration) / 2), duration];
  const frames: number[] = [];
  for (const sample of samples.sort((a, b) => a - b)) frames.push(Math.max(SHOWCASE_FIRST_FRAME + sample, (frames[frames.length - 1] ?? SHOWCASE_FIRST_FRAME) + 1));
  return frames;
}

export function showcaseRows(character: Character): ShowcaseRow[] {
  const rows: ShowcaseRow[] = [];
  showcaseMoves(character).forEach((move, index) => {
    SHOWCASE_FACINGS.forEach((facing, side) => {
      rows.push({ row: `R${String(index * 2 + side + 1).padStart(2, "0")}`, move, facing, frames: showcaseFrames(move) });
    });
  });
  return rows;
}
