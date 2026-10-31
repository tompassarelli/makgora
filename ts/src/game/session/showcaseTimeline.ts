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
import { hopShowcases } from "./hopShowcase";
import { runShowcases } from "./runShowcase";

export const SHOWCASE_FIRST_FRAME = 40;
export const SHOWCASE_SPECIAL_SLOTS: readonly string[] = ["neutral_b", "side_b", "up_b", "down_b"];
export const SHOWCASE_FACINGS: readonly ("right" | "left")[] = ["right", "left"];
const CHARGED_SHOWCASE_GAP = 70;
const SHOWCASE_DEFAULT_GAP = 500;
const SHOWCASE_DUMMY_MIDDLE = 60;
const SHOWCASE_WIDE_BODY_RADIUS = 30;
const SHOWCASE_BODY_CLEARANCE = 50;
const SHOWCASE_WIDE_REACH = 4 / 3;
const SHOWCASE_LATE_STRIKE = 8;
const SHOWCASE_FOE_GAP = 220;
const INCOMING_GAP = 300;
const INCOMING_BODY = 40;

export interface ShowcaseMove {
  readonly slot: string;
  readonly kind: "normal" | "special" | "ultimate" | "hop" | "run";
  readonly code: number;
  readonly first: number;
  readonly end: number;
  readonly gap?: number | undefined;
  readonly run?: number | undefined;
  readonly lift?: number | undefined;
  readonly incoming?: { readonly lead: number; readonly gap: number } | undefined;
  readonly again?: { readonly frame: number; readonly gap: number } | undefined;
  readonly charging?: readonly number[] | undefined;
  readonly release?: number | undefined;
  readonly swing?: readonly number[] | undefined;
  readonly cross?: { readonly frame: number; readonly gap: number } | undefined;
  readonly hold?: { readonly frame: number; readonly frames: number } | undefined;
  readonly behind?: number | undefined;
  readonly samples?: readonly number[] | undefined;
  readonly jump?: { readonly frames: number } | undefined;
  readonly aim?: { readonly frame: number; readonly until: number; readonly z: number } | undefined;
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
  const moves: ShowcaseMove[] = normals.map(([slot, code]) => ({ slot, kind: "normal", code, first: attackStartupFrames(code, tuning.moves), end: attackDurationFramesForGrounding(code, !isAerialAttack(code), tuning.moves), ...widened(character, isAerialAttack(code) ? aerialPlacement(tuning.moves?.normals[code], code, character) : groundPlacement(tuning.moves?.normals[code], code, character)) }));
  SHOWCASE_SPECIAL_SLOTS.forEach((slot, code) => {
    const special = tuning.specials === undefined ? undefined : specialKit(tuning.specials, code).ground;
    const charged = special === undefined ? undefined : heldShowcases(slot, code, special);
    if (charged !== undefined) moves.push(...charged);
    else moves.push({ slot, kind: "special", code, first: special === undefined ? 12 : specialFirst(special), end: special?.endFrame ?? 120, gap: special === undefined ? undefined : foeGap(special) ?? clearOfBody(character, specialGap(special), special), behind: special === undefined ? undefined : clearOfBody(character, specialBehind(special), special), ...rushShowcase(special), incoming: special === undefined || tuning.specials === undefined ? undefined : incomingShot(special, tuning.specials) });
  });
  if (tuning.ultimate !== undefined) moves.push({ slot: "ultimate", kind: "ultimate", code: 0, first: heroCueWindows(tuning.ultimate).active.first, end: tuning.ultimate.endFrame, gap: specialGap(tuning.ultimate) });
  moves.push(...hopShowcases(character));
  moves.push(...runShowcases());
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

function heldShowcases(slot: string, code: number, special: Readonly<AuthoredSpecial>): ShowcaseMove[] | undefined {
  const held = chargedShowcase(slot, code, special) ?? channelledShowcase(slot, code, special);
  return held === undefined ? undefined : [...aimedReleases(slot, code, special), held];
}

function strikeFrames(special: Readonly<AuthoredSpecial>): { readonly first: number; readonly last: number } {
  const hits = special.regions ?? [];
  if (hits.length > 0) return { first: Math.min(...hits.map(region => region.firstFrame)), last: Math.max(...hits.map(region => region.lastFrame)) };
  const shots = special.projectiles ?? [];
  return { first: Math.min(...shots.map(shot => shot.spawnFrame)), last: Math.max(...shots.map(shot => shot.spawnFrame + shot.life - 1)) };
}

function releasedShowcase(slot: string, code: number, special: Readonly<AuthoredSpecial>, frame: number, charging: readonly number[] | undefined): ShowcaseMove {
  const strikes = strikeFrames(special), first = frame + 1 + strikes.first, last = frame + 1 + strikes.last;
  return { slot, kind: "special", code, first, end: frame + special.endFrame, release: frame, charging, swing: [first + floorDiv(last - first, 2), last], gap: specialGap(special) };
}

function aimedReleases(slot: string, code: number, special: Readonly<AuthoredSpecial>): ShowcaseMove[] {
  const charge = special.charge;
  const tap = charge?.releases === true ? special.followUps?.find((followUp) => followUp.chargeStage === 0 && followUp.input === FollowUpInput.release)?.special : undefined;
  if (tap?.aimFrames === undefined) return [];
  const thrown = releasedShowcase(slot, code, tap, 1, undefined);
  const aimed = (z: number): ShowcaseMove => ({ ...thrown, aim: { frame: 1, until: 1 + (tap.aimFrames ?? 0), z } });
  return [thrown, aimed(1), aimed(-1)];
}

function chargedShowcase(slot: string, code: number, special: Readonly<AuthoredSpecial>): ShowcaseMove | undefined {
  const charge = special.charge;
  const released = charge?.releases === true;
  const full = charge === undefined ? undefined : special.followUps?.find((followUp) => followUp.chargeStage === charge.stages && (released ? followUp.input === FollowUpInput.release : followUp.input === undefined && followUp.window.first <= charge.hold + 3 && followUp.window.last >= charge.hold + 3))?.special;
  if (charge === undefined || full === undefined) return undefined;
  const frame = charge.hold + charge.full + 2;
  const handful = floorDiv(charge.full, charge.stages);
  const charging = Array.from({ length: charge.stages + 1 }, (_, stage) => charge.hold + stage * handful);
  if (released) return releasedShowcase(slot, code, full, frame, charging);
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
  if (style === AttackStyle.forwardTiltUp) return risenPlacement(move);
  const sides = bothSides(move);
  if (sides === undefined) return twoSided(move);
  if (opens(sides.ahead) === opens(sides.behind)) return crossedPlacement(move, sides) ?? twoSided(move);
  return style === AttackStyle.downSmash ? staggeredPlacement(move, sides) : twoSided(move);
}

interface Sides { readonly ahead: readonly MoveRegion[]; readonly behind: readonly MoveRegion[] }
type Crossing = { readonly gap: number | undefined; readonly cross?: { readonly frame: number; readonly gap: number }; readonly swing?: readonly number[] };

const opens = (regions: readonly MoveRegion[]): number => Math.min(...regions.map((region) => region.firstFrame));
const closes = (regions: readonly MoveRegion[]): number => Math.max(...regions.map((region) => region.lastFrame));

function bothSides(move: Readonly<AuthoredMove>): Sides | undefined {
  const ahead = move.regions.filter((region) => centreX(region) > 0.0), behind = move.regions.filter((region) => centreX(region) < 0.0);
  return ahead.length === 0 || behind.length === 0 ? undefined : { ahead, behind };
}

function staggeredPlacement(move: Readonly<AuthoredMove>, { ahead, behind }: Sides): Crossing {
  const [early, late] = opens(ahead) < opens(behind) ? [ahead, behind] : [behind, ahead];
  const lateGap = regionGap(late, move.travelX ?? 0.0);
  if (lateGap === undefined || opens(late) - opens(early) < 2) return { gap: lateGap };
  const contact = opens(late) + ordinaryHitlagFrames(Math.max(...early.map((region) => region.hit.effect.damage)));
  return { gap: regionGap(early, move.travelX ?? 0.0), cross: { frame: opens(late) - 1, gap: lateGap }, swing: [contact, contact + 2] };
}

function crossedPlacement(move: Readonly<AuthoredMove>, { ahead, behind }: Sides): Crossing | undefined {
  const travel = move.travelX ?? 0.0, backGap = regionGap(behind, travel), frame = opens(behind) + 1;
  if (backGap === undefined || behindGap(move.regions, reachGap(move)) === undefined || closes(behind) < frame || closes(ahead) < frame) return undefined;
  const contact = frame + ordinaryHitlagFrames(Math.max(...ahead.map((region) => region.hit.effect.damage)));
  return { gap: regionGap(ahead, travel), cross: { frame, gap: backGap }, swing: [contact, contact + 2] };
}

function overheadPlacement(move: Readonly<AuthoredMove>, character: Character): { readonly gap?: number | undefined; readonly lift?: number | undefined } {
  const body = hurtCapsule(character), top = Math.max(body.z1, body.z2) + body.radius;
  const highest = move.regions.reduce((best, region) => centreZ(region) > centreZ(best) ? region : best);
  if (centreZ(highest) - top > Math.abs(centreX(highest))) return { gap: Math.floor(centreX(highest)), lift: Math.floor(centreZ(highest)) };
  const tip = move.regions.map((region) => strikeTip(region)).reduce((best, point) => point.z > best.z ? point : best);
  return tip.z > top ? { gap: Math.floor(tip.x), lift: Math.floor(tip.z) } : { gap: reachGap(move) };
}

function strikeTip(region: MoveRegion): { readonly x: number; readonly z: number } {
  const strike = region.hit.strike;
  if (strike === undefined) return { x: centreX(region), z: region.hit.maxZ };
  return strike.z1 > strike.z2 ? { x: strike.x1, z: strike.z1 } : { x: strike.x2, z: strike.z2 };
}

function risenPlacement(move: Readonly<AuthoredMove>): { readonly gap: number; readonly lift: number } {
  const lowest = move.regions.reduce((best, region) => centreZ(region) < centreZ(best) ? region : best);
  return { gap: Math.floor(centreX(lowest)), lift: Math.max(0, Math.floor(centreZ(lowest) - SHOWCASE_DUMMY_MIDDLE)) };
}

function widened<T extends { readonly gap?: number | undefined; readonly cross?: { readonly frame: number; readonly gap: number } | undefined }>(character: Character, placement: T): T {
  if (hurtCapsule(character).radius <= SHOWCASE_WIDE_BODY_RADIUS) return placement;
  const out = (gap: number | undefined): number | undefined => gap === undefined ? undefined : Math.floor(gap * SHOWCASE_WIDE_REACH);
  const cross = placement.cross === undefined ? undefined : { frame: placement.cross.frame, gap: out(placement.cross.gap) ?? placement.cross.gap };
  return { ...placement, gap: out(placement.gap), ...(cross === undefined ? {} : { cross }) };
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

function twoSided(move: Readonly<AuthoredMove>): { readonly gap: number | undefined; readonly behind: number | undefined } {
  const gap = reachGap(move);
  return { gap, behind: behindGap(move.regions, gap) };
}

function behindGap(regions: readonly MoveRegion[], gap: number | undefined): number | undefined {
  const ahead = regions.filter((region) => centreX(region) > 0.0), behind = regions.filter((region) => centreX(region) < 0.0);
  const back = regionGap(behind, 0.0);
  if (gap === undefined || gap <= 0 || ahead.length === 0 || back === undefined || back >= 0) return undefined;
  return -back * 4 >= gap * 3 ? back : undefined;
}

function aerialContact(move: Readonly<AuthoredMove> | undefined, style: AttackStyle): MoveRegion | undefined {
  const better = style === AttackStyle.upAir ? (region: MoveRegion, best: MoveRegion) => centreZ(region) > centreZ(best)
    : style === AttackStyle.downAir ? (region: MoveRegion, best: MoveRegion) => centreZ(region) < centreZ(best)
    : (region: MoveRegion, best: MoveRegion) => region.lastFrame > best.lastFrame;
  return move?.regions.reduce<MoveRegion | undefined>((best, region) => best === undefined || better(region, best) ? region : best, undefined);
}

function aerialPlacement(move: Readonly<AuthoredMove> | undefined, style: AttackStyle, character: Character): { readonly gap: number | undefined; readonly lift: number | undefined } {
  const region = aerialContact(move, style);
  if (region === undefined) return { gap: undefined, lift: undefined };
  const body = hurtCapsule(character).radius;
  const gap = Math.floor(centreX(region)), lift = Math.floor(centreZ(region) - SHOWCASE_DUMMY_MIDDLE);
  const beside = lift > -SHOWCASE_DUMMY_MIDDLE / 2 && lift < hurtCapsule(character).z2 / 2;
  if (beside && Math.abs(gap) < body * 2 && move !== undefined) {
    const reach = outerReach(move.regions, body * 2, region.hit.effect.launchX < 0.0);
    if (reach !== undefined) return { gap: reach.gap, lift: Math.floor(centreZ(reach.region) - SHOWCASE_DUMMY_MIDDLE) };
  }
  return { gap: beside ? clearOfBody(character, gap, move?.regions) : gap, lift };
}

function outerReach(regions: readonly MoveRegion[], clear: number, backward: boolean): { readonly gap: number; readonly region: MoveRegion } | undefined {
  if (regions.length === 0) return undefined;
  const ahead = regions.reduce((best, region) => region.hit.maxX > best.hit.maxX ? region : best);
  const behind = regions.reduce((best, region) => region.hit.minX < best.hit.minX ? region : best);
  const front = { gap: Math.floor(ahead.hit.maxX * 0.75), region: ahead }, back = { gap: Math.floor(behind.hit.minX * 0.75), region: behind };
  return (backward ? [back, front] : [front, back]).find(side => Math.abs(side.gap) >= clear);
}

function clearOfBody(character: Character, gap: number | undefined, source: Readonly<AuthoredSpecial> | readonly MoveRegion[] | undefined): number | undefined {
  const radius = hurtCapsule(character).radius, clear = radius + SHOWCASE_BODY_CLEARANCE;
  if (gap === undefined || radius <= SHOWCASE_WIDE_BODY_RADIUS || Math.abs(gap) >= clear) return gap;
  const regions = source === undefined ? [] : "length" in source ? source : source.regions ?? [];
  const reach = gap < 0 ? Math.max(...regions.map((region) => -region.hit.minX)) : Math.max(...regions.map((region) => region.hit.maxX));
  return reach < clear ? gap : Math.floor(gap < 0 ? -clear : clear);
}

function foeGap(special: Readonly<AuthoredSpecial>): number | undefined {
  return special.projectiles?.some((shot) => shot.atFoe === true) === true ? SHOWCASE_FOE_GAP : undefined;
}

function specialFirst(special: Readonly<AuthoredSpecial>): number {
  const cue = heroCueWindows(special).active.first;
  if ((special.regions ?? []).length === 0) return cue;
  const strike = strikeFrames(special).first;
  return strike - cue >= SHOWCASE_LATE_STRIKE ? strike : cue;
}

function specialGap(special: Readonly<AuthoredSpecial>): number | undefined {
  if (special.radial === true) return radialGap(special);
  if (special.gaze !== undefined) return Math.floor(special.gaze.range * 0.5625);
  let travel = 0.0;
  for (const segment of special.motion ?? []) travel += segment.velocityX * (segment.last - segment.first + 1);
  const projectile = special.projectiles?.[0];
  if ((special.regions ?? []).length === 0 && projectile !== undefined) return Math.floor(Math.min(SHOWCASE_DEFAULT_GAP, projectile.offsetX + Math.abs(projectile.velocityX) * projectile.life * 0.5));
  const grab = special.commandGrab?.strike;
  if ((special.regions ?? []).length === 0 && grab !== undefined) return Math.floor(Math.max(0.0, travel) + (Math.max(grab.x1, grab.x2) + grab.radius) * 0.75);
  return regionGap(special.regions ?? [], Math.max(0.0, travel));
}

function specialBehind(special: Readonly<AuthoredSpecial>): number | undefined {
  const gap = specialGap(special);
  if (special.radial === true) return gap === undefined || gap <= 0 ? undefined : -gap;
  return behindGap(special.regions ?? [], gap);
}

function radialGap(special: Readonly<AuthoredSpecial>): number | undefined {
  if (special.radial !== true) return undefined;
  let reach = 0.0;
  for (const region of special.regions ?? []) reach = Math.max(reach, region.hit.strike?.radius ?? 0.0);
  return Math.floor(reach * 0.75);
}

export function showcaseFrames(move: ShowcaseMove): number[] {
  const duration = Math.max(8, move.end);
  const samples = move.samples !== undefined ? [...move.samples] : move.kind === "ultimate" ? [1, Math.max(2, floorDiv(move.first, 2)), move.first, Math.round(duration / 3), Math.round(duration * 2 / 3), duration, duration + 2, duration + 300]
    : [...(move.charging ?? []), ...(move.swing ?? []), 1, Math.max(2, floorDiv(move.first, 2)), move.first - 2, move.first, move.first + 1, move.first + 3, Math.round((move.first + 3 + duration) / 2), duration];
  const frames: number[] = [];
  for (const sample of samples.sort((a, b) => a - b)) frames.push(Math.max(SHOWCASE_FIRST_FRAME + sample, (frames[frames.length - 1] ?? SHOWCASE_FIRST_FRAME) + 1));
  return frames;
}

export function showcaseRows(character: Character): ShowcaseRow[] {
  const rows: ShowcaseRow[] = [];
  showcaseMoves(character).forEach((move, index) => {
    SHOWCASE_FACINGS.forEach((facing, side) => {
      const placed = side === 1 && move.behind !== undefined ? { ...move, gap: move.behind } : move;
      rows.push({ row: `R${String(index * 2 + side + 1).padStart(2, "0")}`, move: placed, facing, frames: showcaseFrames(placed) });
    });
  });
  return rows;
}
