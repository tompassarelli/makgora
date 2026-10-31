import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import { type EyeBeamStreak, eyeBeamStreak } from "../presentation/eyeBeamStreak";
import type { WorldOrigin } from "./effects";
import { createBeam, destroyBeam, moveBeam, setBeamColor } from "wisp/game/effects";

const EYE_BEAM_LIGHTNING = "CLPB";
const PARKED_LINE_DEPTH = 4096.0;

/** Illidan's Eye Beam streak: one fel-green lightning from his eyes to the live beam's head. */
export class EyeBeamLine {
  private readonly line: lightning;
  private shown = false;
  private readonly streak: EyeBeamStreak = { tailX: 0.0, headX: 0.0, z: 0.0 };

  constructor(private readonly origin: WorldOrigin) {
    this.line = createBeam(EYE_BEAM_LIGHTNING, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH, origin.x, origin.y, origin.z - PARKED_LINE_DEPTH);
    setBeamColor(this.line, 1.0, 1.0, 1.0, 0.0);
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    const { x, y, z } = this.origin;
    if (playing && eyeBeamStreak(fighter, this.streak)) {
      const { tailX, headX, z: beamZ } = this.streak;
      moveBeam(this.line, x + tailX, y - 12.0, z + beamZ, x + headX, y - 12.0, z + beamZ);
      setBeamColor(this.line, f32(0.35), 1.0, f32(0.2), 1.0);
      this.shown = true;
      return;
    }
    if (!this.shown) return;
    moveBeam(this.line, x, y, z - PARKED_LINE_DEPTH, x, y, z - PARKED_LINE_DEPTH);
    setBeamColor(this.line, 1.0, 1.0, 1.0, 0.0);
    this.shown = false;
  }

  destroy(): void {
    destroyBeam(this.line);
  }
}
