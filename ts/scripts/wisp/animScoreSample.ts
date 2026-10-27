


import { join } from "node:path";
import { LIMB_STRIKES } from "./animStrikeKinds";
import { fillMeter } from "../../src/game/sim/meter";
import { originalClip, originalClipNames } from "../../src/generated/clips/fighterOriginalClipInfo";
import { advanceFighterPose, createFighterPose } from "../../src/game/presentation/fighterPose";
import { CROUCH_CLIP_FRAMES } from "../../src/game/presentation/crouchPose";
import { extremeCamera } from "../../src/game/presentation/arenaCamera";
import { characterModelScale } from "../../src/game/presentation/modelScale";
import { beginFighterAttack, resolveAttacks } from "../../src/game/sim/attacks";
import { AttackPhase, AttackStyle, Character, GroundAction, LedgeState, SpecialAction } from "../../src/game/sim/codes";
import type { Capsule } from "../../src/game/sim/geometry/contactGeometry";
import type { MoveRegion } from "../../src/game/sim/heroMoves";
import { fighterHurtParts } from "../../src/game/sim/hurtboxes";
import { disjointNormals, normalAreaPose } from "../../src/game/presentation/disjointCues";
import { heroLook } from "../../src/game/roster/looks";
import { snapToLedge } from "../../src/game/sim/ledge";
import { beginDamageContacts, finishDamageContacts } from "../../src/game/sim/contacts";
import { attackPhase } from "../../src/game/sim/conditions";
import { type Fighter, createFighter } from "../../src/game/sim/fighter";
import { advanceHeroStatus } from "../../src/game/sim/specials/engine";
import { runningHeroSpecial } from "../../src/game/sim/specials/runningMove";
import { sampleWithStoredCharge } from "./animScoreCharge";
import { HERO_ROSTER, fighterSlug } from "../../src/game/roster/kits";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../../src/game/sim/hitRegions";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../../src/game/sim/matchCamera";
import { advancePlacedObjects } from "../../src/game/sim/placedObjects";
import { updateProjectiles } from "../../src/game/sim/projectiles";
import { type Controls, createRoster, neutralControls, type Roster } from "../../src/game/sim/roster";
import { advanceSpecials, startFighterSpecial } from "../../src/game/sim/specials";
import { FROZEN_THRONE_STAGE } from "../../src/game/sim/stage";
import { advanceFighter } from "../../src/game/sim/step";
import type { MoveClass, MoveSample, ScoreFrame, ScoreSkeleton } from "./animScore";
import { DrawnModel } from "./drawnModel";
import { capture, type PoseFrame } from "./hurtboxView";
import { hitStarts } from "./animJudgeFrames";


export const SCORED_NORMALS: readonly { readonly move: string; readonly style: AttackStyle; readonly moveClass: MoveClass; readonly aerial: boolean }[] = [
  { move: "jab", style: AttackStyle.jab, moveClass: "jab", aerial: false },
  { move: "jab2", style: AttackStyle.jab2, moveClass: "jab", aerial: false },
  { move: "jab3", style: AttackStyle.jab3, moveClass: "jab", aerial: false },
  { move: "forward-tilt", style: AttackStyle.forwardTilt, moveClass: "tilt", aerial: false },
  { move: "forward-tilt-up", style: AttackStyle.forwardTiltUp, moveClass: "tilt", aerial: false },
  { move: "forward-tilt-down", style: AttackStyle.forwardTiltDown, moveClass: "tilt", aerial: false },
  { move: "up-tilt", style: AttackStyle.upTilt, moveClass: "tilt", aerial: false },
  { move: "down-tilt", style: AttackStyle.downTilt, moveClass: "tilt", aerial: false },
  { move: "dash-attack", style: AttackStyle.dashAttack, moveClass: "dash-attack", aerial: false },
  { move: "forward-smash", style: AttackStyle.forwardSmash, moveClass: "smash", aerial: false },
  { move: "up-smash", style: AttackStyle.upSmash, moveClass: "smash", aerial: false },
  { move: "down-smash", style: AttackStyle.downSmash, moveClass: "smash", aerial: false },
  { move: "neutral-air", style: AttackStyle.neutralAir, moveClass: "aerial", aerial: true },
  { move: "forward-air", style: AttackStyle.forwardAir, moveClass: "aerial", aerial: true },
  { move: "back-air", style: AttackStyle.backAir, moveClass: "aerial", aerial: true },
  { move: "up-air", style: AttackStyle.upAir, moveClass: "aerial", aerial: true },
  { move: "down-air", style: AttackStyle.downAir, moveClass: "aerial", aerial: true },
];


export const SCORED_SPECIALS: readonly { readonly move: string; readonly x: number; readonly z: number; readonly ultimate?: true }[] = [
  { move: "neutral-special", x: 0, z: 0 }, { move: "side-special", x: 1, z: 0 },
  { move: "up-special", x: 0, z: 1 }, { move: "down-special", x: 0, z: -1 },
  { move: "ultimate", x: 0, z: 0, ultimate: true },
];

const PELVIS = [/^bone_pelvis/i, /^pelvis_bind_jnt$/i, /^pelvis$/i, /^hips$/i, /^bone rider waist$/i, /^bone koto waist/i, /^bone_butt$/i, /^spine_c0_0_jnt$/i, /^root$/i, /^bone_root/i];
const CHEST = [/^bone_chest/i, /^chest$/i, /^bone neck$/i, /^bone_neck$/i, /^spine_c0_1_jnt$/i];

const LIMBS: readonly (readonly [string, string, string])[] = [
  ["arm", "^bone_arm1_?{S}$", "^bone_hand_?{S}$"],
  ["arm", "^bone_upperarm{S}$", "^bone_hand{S}$"],
  ["arm", "^bone_arm1{S}$", "^bone_armclaw{S}$"],
  ["arm", "^bone rider {S} arm$", "^bone rider {S} wrist$"],
  ["arm", "^{S}shoulder$", "^{S}hand$"],
  ["arm", "^arm_{S}0_0_jnt$", "^arm_{S}0_end_jnt$"],
  ["arm", "^{S}_upr_arm_bind_jnt$", "^bone_hand_{side}$"],
  ["leg", "^bone_leg1_?{S}$", "^bone_foot_?{S}$"],
  ["leg", "^bone_upperleg{S}$", "^bone_foot{S}$"],
  ["leg", "^{S}hip$", "^{S}foot$"],
  ["leg", "^leg_{S}0_0_jnt$", "^leg_{S}0_end_jnt$"],
  ["leg", "^{S}_leg_01_bind_jnt$", "^bone_leg_{side}$"],
  ["leg", "^bone back {S} leg(01)?$", "^bone (back {S} toe|toe {S})\\s*$"],
  ["foreleg", "^bone front {S} leg(01)?$", "^bone front ?{S} toe(01)?$"],
];

export const SKELETON_EXCEPTIONS: Readonly<Record<string, { readonly pelvis?: string; readonly chest?: string; readonly limbs?: readonly { readonly name: string; readonly root: string; readonly end: string }[] }>> = {};

const AFTER_FRAMES = 2;
export const LIMIT = 150;


export function gameplayPixelsPerUnit(): number {
  const camera = createMatchCamera();
  extremeCamera(camera, FROZEN_THRONE_STAGE, MATCH_CAMERA_ASPECT, "far");
  return 1080 / (2 * camera.distance * camera.tangent);
}


export function bodyPath(assets: string, character: Character): string {
  const clip = originalClip(character, 0);
  if (clip === undefined) throw new Error(`${fighterSlug(character)} has no clip table`);
  const relative = clip.modelPath.replaceAll("\\", "/");
  const root = join(assets, "original-clips-static-lights/imports");
  return join(root, relative);
}

export async function loadBody(assets: string, character: Character): Promise<DrawnModel> {
  return new DrawnModel(await Bun.file(bodyPath(assets, character)).arrayBuffer(), characterModelScale(character));
}

export function skeletonOf(model: DrawnModel, character: Character): ScoreSkeleton {
  const nodes = model.nodes();
  const names = nodes.map((node) => node.name);
  const exception = SKELETON_EXCEPTIONS[fighterSlug(character)];
  const find = (patterns: readonly RegExp[], named: string | undefined) => {
    if (named !== undefined) {
      const index = names.indexOf(named);
      if (index < 0) throw new Error(`${fighterSlug(character)}: no node named ${named}`);
      return index;
    }
    for (const pattern of patterns) {
      const index = names.findIndex((name) => pattern.test(name.replace(/ArchDruid$/, "")));
      if (index >= 0) return index;
    }
    return undefined;
  };
  const index = (name: string) => {
    const found = names.indexOf(name);
    if (found < 0) throw new Error(`${fighterSlug(character)}: no node named ${name}`);
    return found;
  };
  const limbs = exception?.limbs?.map((limb) => ({ name: limb.name, root: index(limb.root), end: index(limb.end) })) ?? (["R", "L"] as const).flatMap((side) => LIMBS.flatMap(([kind, root, end]) => {
    const pattern = (template: string) => new RegExp(template.replaceAll("{S}", side).replaceAll("{side}", side === "R" ? "right" : "left"), "i");
    const rootAt = find([pattern(root)], undefined), endAt = find([pattern(end)], undefined);
    return rootAt === undefined || endAt === undefined ? [] : [{ name: `${kind} ${side}`, root: rootAt, end: endAt }];
  }));
  return { names, pelvis: find(PELVIS, exception?.pelvis), chest: find(CHEST, exception?.chest), limbs };
}

export function timelineSeconds(character: Character, frame: PoseFrame): number {
  const info = frame.clip === undefined ? undefined : originalClip(character, frame.clip);
  if (info === undefined) throw new Error(`${fighterSlug(character)}: frame ${frame.frame} shows no clip`);
  return info.startSeconds + frame.seconds;
}

export function pose(model: DrawnModel, character: Character, frame: PoseFrame): ScoreFrame {
  return { frame: frame.frame, ...model.posed(0, timelineSeconds(character, frame), 1) };
}


export function step(world: Roster, input: Readonly<Controls>): void {
  const f = world.fighters[0];
  if (f === undefined) throw new Error("a sampled world has its fighter");
  advanceFighter(world, 0, 0, input, 0.0);
  beginDamageContacts();
  startFighterSpecial(f, 0, 0, input, world);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advancePlacedObjects(world, 0, 0);
  advanceHeroStatus(f);
}

export interface SampledMove {
  readonly move: string;
  readonly sample: MoveSample;

  readonly endFrame: number;

  readonly seconds: readonly number[];
  readonly heights: readonly number[];
  readonly travels: readonly number[];
  readonly cues: readonly (readonly SampledCue[])[];
  readonly strikes: readonly (readonly Capsule[])[];
  readonly regionFrames: readonly (number | undefined)[];
  readonly regionOwners: readonly (RegionOwner | undefined)[];
}

export interface RegionOwner { readonly regions?: readonly MoveRegion[] | undefined; readonly beam?: unknown }

export interface SampledCue { readonly x: number; readonly z: number; readonly scale: number; readonly age: number }

function readCues(f: Fighter, style: AttackStyle, drop: number, since: number): SampledCue[] {
  if (f.attack.style !== style) return [];
  const region = emptyHitRegion(), out: SampledCue[] = [];
  for (let index = 0; index < authoredHitRegionCount(style, f.tuning.moves); index++) {
    const pose = normalAreaPose(f, style, index, region, { visible: false, x: 0.0, z: 0.0, scale: 1.0 });
    if (pose.visible) out.push({ x: pose.x, z: pose.z - drop, scale: pose.scale, age: since });
  }
  return out;
}

const strikeEnd = (capsule: { readonly x1: number; readonly z1: number; readonly x2: number; readonly z2: number }, chestZ: number) =>
  Math.hypot(capsule.x2, capsule.z2 - chestZ) >= Math.hypot(capsule.x1, capsule.z1 - chestZ) ? { x: capsule.x2, z: capsule.z2 } : { x: capsule.x1, z: capsule.z1 };


const travels = (frames: readonly PoseFrame[]) => frames.map((frame) => (frame.x - (frames[0]?.x ?? 0)) * (frames[0]?.facing ?? 1));

const localStrikes = (frame: PoseFrame): Capsule[] => frame.strikes.map((s) => ({ x1: s.x1 - frame.x, z1: s.z1 - frame.z, x2: s.x2 - frame.x, z2: s.z2 - frame.z, radius: s.radius }));

function openWindows(f: Fighter): number[] {
  const style = f.attack.style;
  if (style === undefined || style === AttackStyle.shot || attackPhase(f) !== AttackPhase.active) return [];
  const region = emptyHitRegion();
  return Array.from({ length: authoredHitRegionCount(style, f.tuning.moves) }, (_, index) => authoredHitRegion(region, f.character, style, f.attack.frame, f.attack.smashChargeFrames, index, f.tuning.moves).window).filter((window) => window > 0);
}


export function sampleNormal(model: DrawnModel, skeleton: ScoreSkeleton, character: Character, entry: (typeof SCORED_NORMALS)[number], pixelsPerUnit: number): SampledMove | undefined {
  const f = createFighter(character, 0.0, 1);
  if (authoredHitRegionCount(entry.style, f.tuning.moves) === 0) return undefined;
  const world = createRoster(1, [f]);
  if (entry.aerial) { f.motion.grounded = false; f.motion.z = 900.0; }
  if (entry.style === AttackStyle.dashAttack) { f.ground.action = GroundAction.run; f.motion.vx = f.tuning.physics.runSpeed; }
  const p = createFighterPose();
  const input = neutralControls();
  beginFighterAttack(world, 0, entry.style, false);
  if (f.attack.style !== entry.style) return undefined;
  advanceFighterPose(p, f, world, input, false, false, true, false);
  const frames: PoseFrame[] = [capture(f, p)];
  const windows = [openWindows(f)];
  const drop = entry.aerial ? 900.0 - 300.0 : 0.0, x0 = f.motion.x, facing = f.facing;
  const reads = heroLook(character)?.cueReadNormals?.includes(entry.style) === true && disjointNormals(f).includes(entry.style);
  const cues: SampledCue[][] = [];
  let since = 0;
  const readFrame = () => {
    const found = reads ? readCues(f, entry.style, drop, since) : [];
    since = found.length > 0 ? since + 1 : 0;
    cues.push(found.map((cue) => ({ ...cue, x: (cue.x - x0) * facing })));
  };
  readFrame();
  let moveFrames = 0;
  while (frames.length < LIMIT) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(p, f, world, input, false, false, false, false);
    if (f.attack.style !== entry.style && moveFrames === 0) moveFrames = frames.length;
    frames.push(capture(f, p));
    windows.push(openWindows(f));
    readFrame();
    if (moveFrames > 0 && frames.length >= moveFrames + AFTER_FRAMES) break;
  }
  if (moveFrames === 0) moveFrames = frames.length;
  const active = frames.slice(0, moveFrames).flatMap((frame, index) => frame.phase === AttackPhase.active && frame.strikes.length > 0 ? [index] : []);
  const first = active[0], last = active.at(-1);
  const strike = first === undefined ? undefined : frames[first]?.strikes[0];
  const contactFrame = first === undefined ? undefined : frames[first];
  if (first === undefined || last === undefined || strike === undefined || contactFrame === undefined) return undefined;
  const local = { x1: strike.x1 - contactFrame.x, z1: strike.z1 - contactFrame.z, x2: strike.x2 - contactFrame.x, z2: strike.z2 - contactFrame.z };
  const posed = frames.map((frame) => pose(model, character, frame));
  const ready = posed[moveFrames];
  if (ready === undefined) return undefined;
  const chestZ = skeleton.chest === undefined ? 50 : posed[first]?.nodes[skeleton.chest * 2 + 1] ?? 50;
  const regions = frames.slice(0, moveFrames).map((frame, index) => active.includes(index) ? localStrikes(frame) : []);
  return {
    move: entry.move, endFrame: moveFrames - 1, seconds: frames.map((frame) => timelineSeconds(character, frame)), heights: frames.map((frame) => frame.z - drop), travels: travels(frames), cues, strikes: frames.map(localStrikes),
    regionFrames: frames.map((frame) => frame.frame), regionOwners: frames.map(() => f.tuning.moves?.normals[entry.style]),
    sample: { moveClass: entry.moveClass, limbStrike: LIMB_STRIKES[fighterSlug(character)]?.includes(entry.move) === true, frames: posed, moveFrames, ready, skeleton, firstActive: first, lastActive: last, hits: hitStarts(windows.slice(0, moveFrames)), strike: strikeEnd(local, chestZ), regions, pixelsPerUnit },
  };
}


export function sampleSpecial(model: DrawnModel, skeleton: ScoreSkeleton, character: Character, entry: (typeof SCORED_SPECIALS)[number], pixelsPerUnit: number, storedCharge = 0): SampledMove | undefined {
  if (!HERO_ROSTER.some((hero) => hero.character === character)) return undefined;
  const f: Fighter = createFighter(character, 0.0, 1);
  f.special.charge = storedCharge;
  fillMeter(f);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const idle = neutralControls();
  for (let frame = 0; frame < 3; frame++) { step(world, idle); advanceFighterPose(p, f, world, idle, false, false, false, false); }
  const press = { ...neutralControls(), specialPressed: true, ultimatePressed: entry.ultimate === true, attackHeld: entry.ultimate === true, specialX: entry.x, specialZ: entry.z };
  const frames: PoseFrame[] = [];
  const activeFrames: number[] = [];
  const windows: number[][] = [];
  const strikes: Capsule[][] = [];
  const regionFrames: (number | undefined)[] = [];
  const regionOwners: (RegionOwner | undefined)[] = [];
  let strike: { x: number; z: number } | undefined;
  let moveFrames = 0;
  for (let tick = 0; tick < LIMIT; tick++) {
    const input = tick === 0 ? press : idle;
    step(world, input);
    advanceFighterPose(p, f, world, input, false, false, false, false);
    const running = f.special.action !== SpecialAction.none;
    if (tick === 0 && !running) return undefined;
    if (!running && f.special.lockFrames <= 0 && moveFrames === 0) moveFrames = frames.length;
    const captured = capture(f, p);
    if (running) {
      const move = runningHeroSpecial(f);
      const frame = f.special.frame - 1;
      const region = move?.regions?.find((candidate) => frame >= candidate.firstFrame && frame <= candidate.lastFrame && candidate.hit.strike !== undefined);
      const projectile = move?.projectiles?.find((candidate) => entry.ultimate !== true ? candidate.spawnFrame - 1 === frame
        : (candidate.activeFrom ?? 0) <= candidate.life ? candidate.spawnFrame - 1 === frame : candidate.expiresInto !== undefined && candidate.spawnFrame - 1 + candidate.life === frame);
      const grab = move?.commandGrab !== undefined && frame >= move.commandGrab.first - 1 && frame <= move.commandGrab.last - 1 ? move.commandGrab : undefined;
      const placed = move?.placement?.frame === frame + 1 ? move.placement : undefined;
      windows[frames.length] = (move?.regions ?? []).filter((candidate) => frame >= candidate.firstFrame && frame <= candidate.lastFrame && candidate.hit.strike !== undefined).map((candidate) => candidate.hit.window);
      regionFrames[frames.length] = frame;
      regionOwners[frames.length] = move;
      strikes[frames.length] = move?.regionOrigin !== undefined ? [] : (move?.regions ?? []).flatMap((candidate) => frame >= candidate.firstFrame && frame <= candidate.lastFrame && candidate.hit.strike !== undefined ? [{ ...candidate.hit.strike }] : []);
      if (region !== undefined || projectile !== undefined || grab !== undefined || placed !== undefined) {
        activeFrames.push(frames.length);
        const weapon = region?.hit.strike?.path === true ? move?.regions?.find((candidate) => candidate.hit.strike !== undefined && candidate.hit.strike.path !== true)?.hit.strike : undefined;
        if (strike === undefined && region?.hit.strike !== undefined) strike = strikeEnd(weapon ?? region.hit.strike, 50);
        else if (strike === undefined && grab !== undefined) strike = strikeEnd(grab.strike, 50);
        else if (strike === undefined && placed !== undefined) strike = { x: placed.offsetX, z: placed.offsetZ ?? 60.0 };
        else if (strike === undefined && projectile !== undefined) {
          const speed = Math.hypot(projectile.velocityX, projectile.velocityZ) || 1;
          strike = { x: projectile.offsetX + projectile.velocityX / speed * 60, z: projectile.offsetZ + projectile.velocityZ / speed * 60 };
        }
      }
    }
    frames.push({ ...captured, frame: frames.length });
    if (moveFrames > 0 && frames.length >= moveFrames + AFTER_FRAMES) break;
  }
  if (moveFrames === 0) moveFrames = frames.length;
  const first = activeFrames[0], last = activeFrames.at(-1);
  if (first === undefined || last === undefined || strike === undefined || frames.some((frame) => frame.clip === undefined)) return undefined;
  const posed = frames.map((frame) => pose(model, character, frame));
  const ready = posed[moveFrames];
  if (ready === undefined) return undefined;
  return {
    move: entry.move, endFrame: moveFrames - 1, seconds: frames.map((frame) => timelineSeconds(character, frame)), heights: frames.map((frame) => frame.z), travels: travels(frames), cues: frames.map(() => []), strikes: frames.map((_, index) => strikes[index] ?? []),
    regionFrames: frames.map((_, index) => regionFrames[index]), regionOwners: frames.map((_, index) => regionOwners[index]),
    sample: { moveClass: "special", limbStrike: LIMB_STRIKES[fighterSlug(character)]?.includes(entry.move) === true, frames: posed, moveFrames, ready, skeleton, firstActive: first, lastActive: last, hits: hitStarts(Array.from({ length: moveFrames }, (_, index) => windows[index] ?? [])), strike, regions: [], pixelsPerUnit },
  };
}


export type CrouchClipKind = "crouch" | "other" | "none";

export interface CrouchSample {
  readonly stand: ScoreFrame;
  readonly crouch: ScoreFrame;
  readonly clip: string;
  readonly kind: CrouchClipKind;
  readonly standSeconds: number;
  readonly crouchSeconds: number;
}

const CROUCH_HOLD_FRAMES = CROUCH_CLIP_FRAMES + 16;

export function clipLabel(character: Character, index: number | undefined): string {
  if (index === undefined) return "none";
  const names = [...originalClipNames(character)].filter(([, at]) => at === index).map(([name]) => name);
  return names.find((name) => /crouch/i.test(name)) ?? names[0] ?? `#${index}`;
}

export function sampleCrouch(model: DrawnModel, character: Character): CrouchSample {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const hold = (down: boolean, frames: number) => {
    const input = { ...neutralControls(), down };
    let frame = capture(f, p);
    for (let tick = 0; tick < frames; tick++) {
      step(world, input);
      advanceFighterPose(p, f, world, input, false, false, false, false);
      frame = capture(f, p);
    }
    return { scored: pose(model, character, frame), clip: frame.clip, seconds: timelineSeconds(character, frame) };
  };
  const stand = hold(false, 30);
  const crouch = hold(true, CROUCH_HOLD_FRAMES);
  const clip = clipLabel(character, crouch.clip);
  const kind = crouch.clip === stand.clip ? "none" : /crouch/i.test(clip) ? "crouch" : "other";
  return { stand: stand.scored, crouch: crouch.scored, clip, kind, standSeconds: stand.seconds, crouchSeconds: crouch.seconds };
}


export interface LedgeSample {
  readonly stand: ScoreFrame;
  readonly hang: readonly ScoreFrame[];
  readonly parts: readonly Capsule[];
  readonly clip: string;
  readonly kind: CrouchClipKind;
  readonly hangSeconds: readonly number[];
}

const LEDGE_HOLD_FRAMES = 60;
const LEDGE_SAMPLE_EVERY = 6;

const hurtCapsules = (f: Fighter): Capsule[] => fighterHurtParts(f).map((part) => ({ x1: part.x1, z1: part.z1, x2: part.x2, z2: part.z2, radius: part.radius }));

export function ledgeHangParts(character: Character): { readonly parts: readonly Capsule[]; readonly standing: PoseFrame } {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const input = neutralControls();
  let standing = capture(f, p);
  for (let tick = 0; tick < 30; tick++) { step(world, input); advanceFighterPose(p, f, world, input, false, false, false, false); standing = capture(f, p); }
  if (!snapToLedge(world, 0, 0, 1)) throw new Error(`${fighterSlug(character)}: the sampled fighter catches the ledge`);
  for (let tick = 1; tick <= LEDGE_HOLD_FRAMES; tick++) step(world, input);
  return { parts: hurtCapsules(f), standing };
}

export function sampleLedgeHang(model: DrawnModel, character: Character): LedgeSample {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const input = neutralControls();
  const advance = () => { step(world, input); advanceFighterPose(p, f, world, input, false, false, false, false); return capture(f, p); };
  let standing = capture(f, p);
  for (let tick = 0; tick < 30; tick++) standing = advance();
  if (!snapToLedge(world, 0, 0, 1)) throw new Error(`${fighterSlug(character)}: the sampled fighter catches the ledge`);
  const hang: ScoreFrame[] = [], hangSeconds: number[] = [];
  let clipIndex: number | undefined;
  for (let tick = 1; tick <= LEDGE_HOLD_FRAMES; tick++) {
    const frame = advance();
    if (f.ledge.state !== LedgeState.hang) throw new Error(`${fighterSlug(character)}: still hanging on frame ${tick}`);
    clipIndex = frame.clip;
    if (tick % LEDGE_SAMPLE_EVERY === 0) { hang.push(pose(model, character, frame)); hangSeconds.push(timelineSeconds(character, frame)); }
  }
  const clip = clipLabel(character, clipIndex);
  const kind = clipIndex === standing.clip ? "none" : /ledge|hang/i.test(clip) ? "crouch" : "other";
  const parts = hurtCapsules(f);
  return { stand: pose(model, character, standing), hang, parts, clip, kind, hangSeconds };
}


export interface JumpSample {
  readonly stand: ScoreFrame;
  readonly first: readonly ScoreFrame[];
  readonly second: readonly ScoreFrame[];
  readonly firstClip: string;
  readonly secondClip: string;
  readonly firstSeconds: readonly number[];
  readonly secondSeconds: readonly number[];
  readonly secondHeights: readonly number[];
}

const JUMP_PHASES = 16;

export type JumpStart = "ground" | "ledge";

const LEDGE_JUMP_HANG_FRAMES = 30;

export function sampleJumps(model: DrawnModel, character: Character, start: JumpStart = "ground"): JumpSample {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const advance = (input: Readonly<Controls>) => {
    const serial = f.jump.serial;
    step(world, input);
    advanceFighterPose(p, f, world, input, false, f.jump.serial !== serial, false, false);
    return capture(f, p);
  };
  const neutral = neutralControls(), held = { ...neutralControls(), jumpHeld: true }, jump = { ...held, jumpPressed: true };
  let standing = capture(f, p);
  for (let tick = 0; tick < 30; tick++) standing = advance(neutral);
  if (start === "ledge") {
    if (!snapToLedge(world, 0, 0, 1)) throw new Error(`${fighterSlug(character)}: the sampled fighter catches the ledge`);
    for (let tick = 0; tick < LEDGE_JUMP_HANG_FRAMES; tick++) advance(neutral);
    if (f.ledge.state !== LedgeState.hang) throw new Error(`${fighterSlug(character)}: still hanging before the ledge jump`);
  }
  const rise = () => {
    const frames: PoseFrame[] = [];
    let input: Readonly<Controls> = jump;
    for (let tick = 0; tick < LIMIT; tick++) {
      const frame = advance(input);
      input = held;
      if (!f.motion.grounded && f.motion.vz > 0.0) frames.push(frame);
      else if (frames.length > 0) break;
    }
    if (frames.length < 2) throw new Error(`${fighterSlug(character)}: the sampled jump rises`);
    return frames;
  };
  const first = rise();
  const remaining = f.jump.remaining;
  const second = rise();
  if (f.jump.remaining >= remaining) throw new Error(`${fighterSlug(character)}: the second jump spends a midair jump`);
  const phases = (frames: readonly PoseFrame[]) => Array.from({ length: JUMP_PHASES }, (_, index) => {
    const frame = frames[Math.round(index * (frames.length - 1) / (JUMP_PHASES - 1))];
    if (frame === undefined) throw new Error("a phase lies within its rise");
    return frame;
  });
  const phased = (frames: readonly PoseFrame[]) => phases(frames).map((frame) => pose(model, character, frame));
  const timeline = (frames: readonly PoseFrame[]) => phases(frames).map((frame) => timelineSeconds(character, frame));
  return { stand: pose(model, character, standing), first: phased(first), second: phased(second), firstSeconds: timeline(first), secondSeconds: timeline(second), secondHeights: phases(second).map((frame) => frame.z),
    firstClip: clipLabel(character, first[Math.floor(first.length / 2)]?.clip), secondClip: clipLabel(character, second[Math.floor(second.length / 2)]?.clip) };
}

export function sampleFighter(model: DrawnModel, character: Character): SampledMove[] {
  const skeleton = skeletonOf(model, character);
  const pixelsPerUnit = gameplayPixelsPerUnit();
  const out: SampledMove[] = [];
  for (const entry of SCORED_NORMALS) {
    const sampled = sampleNormal(model, skeleton, character, entry, pixelsPerUnit);
    if (sampled !== undefined) out.push(sampled);
  }
  for (const entry of SCORED_SPECIALS) {
    const sampled = sampleWithStoredCharge(character, entry.move, (charge) => sampleSpecial(model, skeleton, character, entry, pixelsPerUnit, charge));
    if (sampled !== undefined) out.push(sampled);
  }
  return out;
}
