import { cleansePoisonAndSlow } from "../heroStatus";
import { toggleManaShield } from "../manaShield";
import { toggleAuraOnFrame } from "../toggleAura";
import { gazeAt } from "../gaze";
import { applyItemBuffFor } from "../itemBuffs";
import { duoCastOnFrame, reviveOnFrame } from "../duoPartner";
import { type Fighter } from "../fighter";
import { type Controls, type Roster } from "../roster";
import { PARTICIPANT_CAPACITY } from "../../input/participants";
import { type AuthoredSpecial } from "./schema";
import { stallAir } from "./airFloat";
import { readyEmpowered } from "./empowered";
import { burstProjectiles, spawnHeroProjectile } from "./heroProjectiles";
import { applyMotion, seekTargetSlot, seeks } from "./heroMotion";
import { trackBeam } from "./heroContact";
import { applySelfHeal } from "./selfHeal";

export function applyFrameEffectsBeforeLedge(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  if (move.cleanseFrame === frame) cleansePoisonAndSlow(f);
  if (move.manaShield?.frame === frame) toggleManaShield(f);
  toggleAuraOnFrame(f, move.toggleAura, frame);
}

export function applyFrameEffectsBeforePlacements(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number, stage: number, matchFrame: number, input: Readonly<Controls> | undefined, world: Roster | undefined): void {
  if (move.gaze !== undefined && world !== undefined) gazeAt(world, f, move.gaze, frame);
  if (move.rehits?.includes(frame) === true) for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) f.special.hitTargets[entry] = undefined;
  if (move.buff?.frame === frame) applyItemBuffFor(f, move.buff.kind, move.buff.frames);
  readyEmpowered(f, move, frame);
  applySelfHeal(f, move.selfHeal, frame);
  reviveOnFrame(world, f, move.revive, frame, stage, matchFrame);
  duoCastOnFrame(world, f, move, frame, input);
  if (frame === 1 && world !== undefined && f.special.seekTarget === 0 && seeks(move)) f.special.seekTarget = seekTargetSlot(world, f) + 1;
  if (move.beam !== undefined && world !== undefined) trackBeam(f, world, move.beam, frame);
  applyMotion(f, move, frame, input, world);
  stallAir(f, move, frame, input);
  for (const spec of move.projectiles ?? []) if (spec.spawnFrame === frame) spawnHeroProjectile(f, spec, f.attack.serial + 1, stage, matchFrame, world);
}

export function applyFrameEffectsAfterPlacements(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  if (move.burst?.frame === frame) burstProjectiles(f, move.burst.from, move.burst.into);
  if (move.ritual?.frame === frame) {
    f.status.armorFrames = 0;
    f.status.armorChills = false;
  }
}
