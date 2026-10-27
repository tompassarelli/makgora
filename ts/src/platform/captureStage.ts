import { extremeCamera } from "../game/presentation/arenaCamera";
import type { MatchCamera } from "../game/sim/matchCamera";
import { advanceFighterPose, createFighterPose, type FighterPose } from "../game/presentation/fighterPose";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../game/input/participants";
import { beginFighterAttack } from "../game/sim/attacks";
import { AttackPhase, AttackStyle, type Character, SpecialAction } from "../game/sim/codes";
import { attackPhase } from "../game/sim/conditions";
import { type Fighter, createFighter } from "../game/sim/fighter";
import { advancePlacedObjects } from "../game/sim/placedObjects";
import { updateProjectiles } from "../game/sim/projectiles";
import { type Controls, type Roster, createRoster, neutralControls } from "../game/sim/roster";
import { advanceSpecials, startFighterSpecial } from "../game/sim/specials";
import { advanceHeroStatus } from "../game/sim/specials/engine";
import { advanceFighter } from "../game/sim/step";

export const CAPTURE_SLOT_X: Readonly<Slots<number>> = [-450.0, -150.0, 150.0, 450.0];
export const CAPTURE_AERIAL_HEIGHT = 220.0;
export const CAPTURE_HOLD_FRAMES = 30;
export const CAPTURE_MOVE_LIMIT = 600;

export type CaptureMove =
  | { readonly name: string; readonly kind: "normal"; readonly style: AttackStyle; readonly aerial: boolean }
  | { readonly name: string; readonly kind: "special"; readonly x: number; readonly z: number; readonly ultimate: boolean };

const normal = (name: string, style: AttackStyle, aerial = false): CaptureMove => ({ name, kind: "normal", style, aerial });
const special = (name: string, x: number, z: number, ultimate = false): CaptureMove => ({ name, kind: "special", x, z, ultimate });

export const CAPTURE_MOVES: readonly CaptureMove[] = [
  normal("jab", AttackStyle.jab), normal("jab2", AttackStyle.jab2), normal("jab3", AttackStyle.jab3),
  normal("forward-tilt", AttackStyle.forwardTilt), normal("forward-tilt-up", AttackStyle.forwardTiltUp), normal("forward-tilt-down", AttackStyle.forwardTiltDown),
  normal("up-tilt", AttackStyle.upTilt), normal("down-tilt", AttackStyle.downTilt), normal("dash-attack", AttackStyle.dashAttack),
  normal("forward-smash", AttackStyle.forwardSmash), normal("up-smash", AttackStyle.upSmash), normal("down-smash", AttackStyle.downSmash),
  normal("neutral-air", AttackStyle.neutralAir, true), normal("forward-air", AttackStyle.forwardAir, true), normal("back-air", AttackStyle.backAir, true),
  normal("up-air", AttackStyle.upAir, true), normal("down-air", AttackStyle.downAir, true),
  special("neutral-special", 0, 0), special("side-special", 1, 0), special("up-special", 0, 1), special("down-special", 0, -1), special("ultimate", 0, 0, true),
];

export const captureMove = (name: string): CaptureMove | undefined => CAPTURE_MOVES.find(move => move.name === name);

export interface CaptureLane {
  readonly character: Character;
  readonly move: CaptureMove;
  readonly facing: 1 | -1;
  readonly slot: ParticipantSlot;
  readonly stage: number;
  fighter: Fighter;
  world: Roster;
  pose: FighterPose;
  frame: number;
  ended: number;
  loops: number;
}

const NEUTRAL = neutralControls();

function moveRunning(lane: Readonly<CaptureLane>): boolean {
  const { fighter, move } = lane;
  if (move.kind === "normal") return attackPhase(fighter) !== AttackPhase.none;
  return fighter.special.action !== SpecialAction.none || fighter.special.lockFrames > 0;
}

function holdAerial(lane: CaptureLane): void {
  const { fighter, move } = lane;
  if (move.kind === "normal" && move.aerial) {
    fighter.motion.grounded = false;
    fighter.motion.z = CAPTURE_AERIAL_HEIGHT;
    fighter.motion.vz = 0.0;
  }
  fighter.motion.x = CAPTURE_SLOT_X[lane.slot];
}

function stepLane(lane: CaptureLane, input: Readonly<Controls>): void {
  const { world, fighter, stage } = lane;
  advanceFighter(world, 0, stage, input, CAPTURE_SLOT_X[lane.slot]);
  startFighterSpecial(fighter, stage, 0, input, world);
  advanceSpecials(world, stage, 0);
  updateProjectiles(world, stage);
  advancePlacedObjects(world);
  advanceHeroStatus(fighter);
  holdAerial(lane);
}

function startLane(lane: CaptureLane): boolean {
  const fighter = createFighter(lane.character, CAPTURE_SLOT_X[lane.slot], lane.facing);
  fighter.mana.points = 100;
  lane.fighter = fighter;
  lane.world = createRoster(1, [fighter]);
  lane.pose = createFighterPose();
  lane.frame = 0;
  lane.ended = 0;
  const { move } = lane;
  holdAerial(lane);
  if (move.kind === "normal") {
    beginFighterAttack(lane.world, 0, move.style, false);
    advanceFighterPose(lane.pose, fighter, lane.world, NEUTRAL, false, false, true, false);
    return fighter.attack.style === move.style;
  }
  const press = { ...neutralControls(), specialPressed: true, ultimatePressed: move.ultimate, attackHeld: move.ultimate, specialX: move.x * lane.facing, specialZ: move.z };
  stepLane(lane, press);
  advanceFighterPose(lane.pose, fighter, lane.world, press, false, false, false, false);
  return fighter.special.action !== SpecialAction.none;
}

export function createCaptureLane(character: Character, move: CaptureMove, facing: 1 | -1, slot: ParticipantSlot, stage: number): CaptureLane | undefined {
  const fighter = createFighter(character, CAPTURE_SLOT_X[slot], facing);
  const lane: CaptureLane = { character, move, facing, slot, stage, fighter, world: createRoster(1, [fighter]), pose: createFighterPose(), frame: 0, ended: 0, loops: 0 };
  return startLane(lane) ? lane : undefined;
}

export function advanceCaptureLane(lane: CaptureLane): void {
  if (lane.ended >= CAPTURE_HOLD_FRAMES || lane.frame >= CAPTURE_MOVE_LIMIT) {
    lane.loops++;
    startLane(lane);
    return;
  }
  const running = moveRunning(lane);
  if (lane.ended > 0 || !running) {
    lane.ended++;
    if (lane.ended > 1) return;
  }
  stepLane(lane, NEUTRAL);
  advanceFighterPose(lane.pose, lane.fighter, lane.world, NEUTRAL, false, false, false, false);
  lane.frame++;
}

export interface CaptureStage {
  readonly lanes: Slots<CaptureLane | undefined>;
}

export const createCaptureStage = (): CaptureStage => ({ lanes: [undefined, undefined, undefined, undefined] });

export function advanceCaptureStage(stage: CaptureStage): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const lane = stage.lanes[slot];
    if (lane !== undefined) advanceCaptureLane(lane);
  }
}

export const captureStaged = (stage: Readonly<CaptureStage>): boolean => stage.lanes.some(lane => lane !== undefined);

export function frameCaptureStage(stage: Readonly<CaptureStage>, camera: MatchCamera, inMatch: boolean, stageChoice: number, aspect: number): void {
  if (inMatch && captureStaged(stage)) extremeCamera(camera, stageChoice, aspect, "far");
}
