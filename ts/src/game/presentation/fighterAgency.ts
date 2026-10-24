import { ATTACK_BUFFER_FRAMES } from "../input/attackBuffer";
import { advanceTechInput, techInputEligible, TECH_REPEAT_MINIMUM_AGE_FRAMES, TECH_WINDOW_FRAMES, type TechInput } from "../sim/geometry/techInput";
import { copyFighterState } from "../../generated/state/fighterState";
import { Character, DownState, GrabAction, LedgeState, ShieldBreak, SurfaceContact } from "../sim/codes";
import { inStageCannon } from "../sim/stageHazards";
import { surelyClear } from "./agencyClearance";
import { canAttack, canShieldGrab } from "../sim/conditions";
import { type Fighter, PACK_CAPACITY, createFighter } from "../sim/fighter";
import { advanceGrabs, resolveGrabs } from "../sim/grabs";
import { grabContactFrame } from "../sim/moves";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import { observedActions } from "../sim/observations";
import { createRoster, fighterAt, neutralControls, type Roster } from "../sim/roster";
import { advanceFighterMotion } from "../sim/step";

export type FighterAgency = "none" | "di" | "act";








export const MAX_REUSE_AGE = 3;


const CLEARANCE_RECHECK = 3;


function mayTechWithoutFreshPress(tech: Readonly<TechInput>): boolean {
  return techInputEligible(tech) || (tech.accumulatedPress && tech.pressAge >= TECH_REPEAT_MINIMUM_AGE_FRAMES);
}


function clearFlight(f: Readonly<Fighter>): boolean {
  return f.down.state === DownState.tumble && !f.motion.grounded && f.launch.hitlag === 0 && f.status.frozenFrames === 0 && !f.status.out
    && f.ledge.state === LedgeState.none && f.surfaceRecovery.state === SurfaceContact.none && !inStageCannon(f);
}

export class FighterAgencyForecast {
  private readonly fighter = createFighter(Character.demonHunter, 0.0, 1, PACK_CAPACITY);
  private readonly world = createRoster(1, [this.fighter]);
  private readonly input = neutralControls();
  private readonly pressedTech = { pressAge: 255, previousPressAge: 255, accumulatedPress: false };

  private readonly holder = createFighter(Character.demonHunter, 0.0, 1, PACK_CAPACITY);
  private readonly thrown = createFighter(Character.demonHunter, 0.0, 1, PACK_CAPACITY);
  private readonly throwWorld = createRoster(3, [this.holder, this.thrown]);
  private readonly throwInputs = [neutralControls(), neutralControls()];
  private readonly throwTech = { pressAge: 255, previousPressAge: 255, accumulatedPress: false };
  private throwRunning = false;
  private throwOwner = -1;
  private throwSerial = 0;
  private throwAction: GrabAction = GrabAction.none;
  private throwStage = 0;
  private throwFrame = 0;
  private throwOffset = 0;
  private throwNextCheck = 0;
  private throwResultOwner = -1;
  private throwResultSerial = 0;
  private throwResultAction: GrabAction = GrabAction.none;
  private throwCounts = false;
  private throwSpent = 0;


  private forecastFrame?: number;
  private forecastHit?: number;
  private forecastButtons?: boolean;

  private running?: boolean;
  private runStage = 0;
  private runFrame = 0;
  private runHit = 0;
  private runBuffer = ATTACK_BUFFER_FRAMES;
  private runOffset = 0;
  private runNextCheck = 0;
  private runButtons = false;
  private runDi = false;
  private runLockedHorizon = 0;


  constructor(private readonly bounded = true) {}

  classify(world: Readonly<Roster>, slot: number, stage: number, frame: number, bufferFrames = ATTACK_BUFFER_FRAMES): FighterAgency {
    return this.immediate(world, slot, stage, frame) ?? this.forecast(world, slot, stage, frame, bufferFrames);
  }


  immediate(world: Readonly<Roster>, slot: number, stage: number, frame: number, throwSteps = TECH_WINDOW_FRAMES): FighterAgency | undefined {
    this.throwSpent = 0;
    const f = fighterAt(world, slot);
    if (f.status.out) return "act";
    if (f.status.frozenFrames > 1) return "none";
    if (heroStatusBlocksActions(f) && f.status.conditionFrames > 1) return "none";
    if (f.grab.owner !== undefined) {
      const owner = fighterAt(world, f.grab.owner);
      if (owner.grab.action === GrabAction.hold || owner.grab.action === GrabAction.pummel) {
        return owner.launch.hitlag > 0 || f.launch.hitlag > 0 ? "none" : "act";
      }
      const free = owner.launch.hitlag <= 0 && f.launch.hitlag <= 0;
      const release = grabContactFrame(owner.grab.action, owner.tuning.moves) - owner.grab.frame;

      if (free && release <= TECH_WINDOW_FRAMES && this.techPressCounts(world, f.grab.owner, f, stage, frame, throwSteps)) return "act";
      return free && release === 1 ? "di" : "none";
    }
    if (f.status.frozenFrames === 0 && f.launch.hitlag === 0
      && (f.down.state === DownState.bound || f.down.state === DownState.wait || f.shield.breakState === ShieldBreak.dizzy)) return "act";
    const controlled = f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.status.frozenFrames > 0
      || f.down.state !== DownState.none || f.shield.breakState !== ShieldBreak.none || f.shield.stun > 0;
    if (!controlled) return "act";
    return undefined;
  }





  reuseAge(world: Readonly<Roster>, slot: number, frame: number): number | undefined {
    const f = fighterAt(world, slot);
    const last = this.forecastFrame;
    if (last === undefined || this.forecastHit !== f.visuals.hit || this.fighter.visuals.hit !== f.visuals.hit || frame < last || frame - last > MAX_REUSE_AGE) return undefined;
    return frame - last;
  }


  reused(world: Readonly<Roster>, slot: number): FighterAgency {
    const f = fighterAt(world, slot);
    if (this.forecastButtons === true) return "act";
    return f.launch.hitlag > 0 && f.launch.diPending ? "di" : "none";
  }


  forecast(world: Readonly<Roster>, slot: number, stage: number, frame: number, bufferFrames = ATTACK_BUFFER_FRAMES): FighterAgency {
    this.begin(world, slot, stage, frame, bufferFrames);
    this.advance(TECH_WINDOW_FRAMES);
    return this.result();
  }


  begin(world: Readonly<Roster>, slot: number, stage: number, frame: number, bufferFrames = ATTACK_BUFFER_FRAMES): void {
    const f = fighterAt(world, slot);
    const freshHit = this.fighter.visuals.hit !== f.visuals.hit;
    copyFighterState(this.fighter, f, world.mask);
    this.fighter.grab.owner = undefined;
    this.fighter.grab.target = undefined;
    this.pressedTech.pressAge = f.tech.pressAge;
    this.pressedTech.previousPressAge = f.tech.previousPressAge;
    this.pressedTech.accumulatedPress = f.tech.accumulatedPress;
    this.runStage = stage;
    this.runFrame = frame;
    this.runHit = f.visuals.hit;
    this.runBuffer = bufferFrames;
    this.runOffset = 0;
    this.runNextCheck = 0;
    this.runButtons = false;
    this.runDi = f.launch.hitlag > 0 && f.launch.diPending;
    this.runLockedHorizon = freshHit ? bufferFrames : Math.max(bufferFrames, TECH_WINDOW_FRAMES - f.launch.hitlag - 1);
    this.running = true;
  }


  pendingFor(world: Readonly<Roster>, slot: number): boolean {
    return this.running === true && this.runHit === fighterAt(world, slot).visuals.hit;
  }


  cancel(): void {
    this.running = false;
  }


  advance(maxSteps: number): number {
    if (this.running !== true) return 0;
    const legal = observedActions.legal;
    const started = observedActions.started;
    const stage = this.runStage;
    const frame = this.runFrame;
    const bufferFrames = this.runBuffer;
    let steps = 0;
    let done = true;
    try {
      for (let offset = this.runOffset; offset < TECH_WINDOW_FRAMES; offset++) {
        if (steps >= maxSteps) {
          this.runOffset = offset;
          done = false;
          break;
        }
        steps++;
        const before = this.fighter.down.state;
        const recoverySerial = this.fighter.surfaceRecovery.contactSerial;
        if (this.fighter.status.frozenFrames <= 0) {
          advanceTechInput(this.pressedTech, offset === 0, this.fighter.launch.hitlag > 1);
        }
        advanceFighterMotion(this.world, 0, stage, frame + offset + 1, this.input, 0.0);

        if (offset <= bufferFrames && (canAttack(this.fighter) || canShieldGrab(this.fighter))) {
          this.runButtons = true;
          break;
        }
        const floorContact = before === DownState.tumble && this.fighter.down.state !== DownState.tumble;
        const solidContact = before === DownState.tumble && this.fighter.surfaceRecovery.contactSerial !== recoverySerial;
        if ((floorContact || solidContact) && techInputEligible(this.pressedTech) !== techInputEligible(this.fighter.tech)) {
          this.runButtons = true;
          break;
        }


        if (offset >= bufferFrames && (this.fighter.motion.grounded || this.fighter.down.state !== DownState.tumble)) break;
        if (offset >= this.runLockedHorizon && this.bounded && !mayTechWithoutFreshPress(this.pressedTech) && !mayTechWithoutFreshPress(this.fighter.tech)) break;

        if (offset >= bufferFrames && offset >= this.runNextCheck && this.bounded && clearFlight(this.fighter)) {
          if (surelyClear(this.fighter, stage, frame + offset + 1, TECH_WINDOW_FRAMES - 1 - offset)) break;
          this.runNextCheck = offset + CLEARANCE_RECHECK;
        }
      }
    } finally {
      observedActions.legal = legal;
      observedActions.started = started;
    }
    if (done) {
      this.running = false;
      this.forecastFrame = frame;
      this.forecastHit = this.runHit;
      this.forecastButtons = this.runButtons;
    }
    return steps;
  }


  finished(): boolean {
    return this.running !== true;
  }


  result(): FighterAgency {
    if (this.forecastButtons === true) return "act";
    return this.runDi ? "di" : "none";
  }


  throwStepsSpent(): number {
    return this.throwSpent;
  }


  private techPressCounts(world: Readonly<Roster>, ownerSlot: number, thrown: Readonly<Fighter>, stage: number, frame: number, maxSteps: number): boolean {
    const owner = fighterAt(world, ownerSlot);
    const { serial, action } = owner.grab;
    const sameThrow = this.throwOwner === ownerSlot && this.throwSerial === serial && this.throwAction === action;
    if (!this.throwRunning || !sameThrow || frame < this.throwFrame || frame - this.throwFrame > TECH_WINDOW_FRAMES) {
      copyFighterState(this.holder, owner, world.mask);
      copyFighterState(this.thrown, thrown, world.mask);
      this.holder.grab.target = 1;
      this.thrown.grab.owner = 0;
      this.throwTech.pressAge = thrown.tech.pressAge;
      this.throwTech.previousPressAge = thrown.tech.previousPressAge;
      this.throwTech.accumulatedPress = thrown.tech.accumulatedPress;
      this.throwOwner = ownerSlot;
      this.throwSerial = serial;
      this.throwAction = action;
      this.throwStage = stage;
      this.throwFrame = frame;
      this.throwOffset = 0;
      this.throwNextCheck = 0;
      this.throwRunning = true;
    }
    const counts = this.advanceThrow(maxSteps);
    if (counts !== undefined) {
      this.throwRunning = false;
      this.throwResultOwner = ownerSlot;
      this.throwResultSerial = serial;
      this.throwResultAction = action;
      this.throwCounts = counts;
      return counts;
    }
    return this.throwResultOwner === ownerSlot && this.throwResultSerial === serial && this.throwResultAction === action && this.throwCounts;
  }


  private advanceThrow(maxSteps: number): boolean | undefined {
    const legal = observedActions.legal;
    const started = observedActions.started;
    try {
      for (let offset = this.throwOffset; offset < TECH_WINDOW_FRAMES; offset++) {
        if (this.throwSpent >= maxSteps) {
          this.throwOffset = offset;
          return undefined;
        }
        this.throwSpent++;
        const settled = this.throwStep(offset);
        if (settled !== undefined) return settled;
      }
    } finally {
      observedActions.legal = legal;
      observedActions.started = started;
    }
    return false;
  }


  private throwStep(offset: number): boolean | undefined {
    const stage = this.throwStage;
    const frame = this.throwFrame;
    const before = this.thrown.down.state;
    const recoverySerial = this.thrown.surfaceRecovery.contactSerial;
    advanceTechInput(this.throwTech, offset === 0, this.thrown.launch.hitlag > 1);


    const linked = !this.bounded || this.thrown.grab.owner !== undefined || this.holder.grab.target !== undefined;
    if (linked) advanceFighterMotion(this.throwWorld, 0, stage, frame + offset + 1, this.throwInputs[0] ?? neutralControls(), 0.0);
    advanceFighterMotion(this.throwWorld, 1, stage, frame + offset + 1, this.throwInputs[1] ?? neutralControls(), 0.0);
    if (linked) {
      resolveGrabs(this.throwWorld);
      advanceGrabs(this.throwWorld, this.throwInputs);
      resolveGrabs(this.throwWorld);
    }
    const floorContact = before === DownState.tumble && this.thrown.down.state !== DownState.tumble;
    const solidContact = before === DownState.tumble && this.thrown.surfaceRecovery.contactSerial !== recoverySerial;
    if (floorContact || solidContact) return techInputEligible(this.throwTech) !== techInputEligible(this.thrown.tech);
    if (this.thrown.grab.owner === undefined && this.thrown.down.state !== DownState.tumble) return false;

    if (offset >= this.throwNextCheck && this.bounded && this.thrown.grab.owner === undefined && this.holder.grab.target === undefined && clearFlight(this.thrown)) {
      if (surelyClear(this.thrown, stage, frame + offset + 1, TECH_WINDOW_FRAMES - 1 - offset)) return false;
      this.throwNextCheck = offset + CLEARANCE_RECHECK;
    }
    return undefined;
  }
}
