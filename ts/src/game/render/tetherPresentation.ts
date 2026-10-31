import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { fighterModelScale } from "../presentation/fighterScale";
import { tetheredFoe } from "../presentation/foeTether";
import type { Fighter } from "../sim/fighter";
import type { WorldOrigin } from "./effects";
import { Beam, createBeam, destroyBeam, moveBeam, setBeamColor } from "wisp/game/effects";

const DRAIN_LIFE_LIGHTNING = "DRAL";
const HAND_X = 34.0;
const HAND_Z = 112.0;
const FOE_CHEST = 60.0;

export class TetherPresentation {
  private readonly beams: Beam[] = [];
  private readonly shown: boolean[] = [];

  constructor(private readonly origin: WorldOrigin, private readonly front: number) {
    for (let slot = 0; slot < PARTICIPANT_SLOTS.length; slot++) {
      this.beams.push(createBeam(DRAIN_LIFE_LIGHTNING, origin.x, front, origin.z - 4096.0, origin.x, front, origin.z - 4096.0));
      this.shown.push(true);
    }
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.beams.length; slot++) this.hide(slot);
  }

  hide(slot: number): void {
    const beam = this.beams[slot];
    if (beam === undefined || this.shown[slot] !== true) return;
    setBeamColor(beam, 1.0, 1.0, 1.0, 0.0);
    this.shown[slot] = false;
  }

  present(fighter: Readonly<Fighter>, slot: number, foeX: readonly number[], foeZ: readonly number[]): void {
    const beam = this.beams[slot];
    const foe = tetheredFoe(fighter);
    const x = foeX[foe];
    const z = foeZ[foe];
    if (beam === undefined || foe < 0 || x === undefined || z === undefined) {
      this.hide(slot);
      return;
    }
    const scale = fighterModelScale(fighter);
    const { origin, front } = this;
    moveBeam(beam, origin.x + fighter.motion.x + f32(f32(fighter.facing * HAND_X) * scale), front, origin.z + fighter.motion.z + f32(HAND_Z * scale),
      origin.x + x, front, origin.z + z + FOE_CHEST);
    setBeamColor(beam, 1.0, 1.0, 1.0, 1.0);
    this.shown[slot] = true;
  }

  destroy(): void {
    for (const beam of this.beams) destroyBeam(beam);
  }
}
