import type { Cue } from "./cue";

/** Where a held cue stands in the world, the way it faces and its drawn scale. */
export interface CuePlace {
  x: number;
  y: number;
  z: number;
  facing: number;
  scale: number;
}

const copyPlace = (target: CuePlace, source: Readonly<CuePlace>): void => {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.facing = source.facing;
  target.scale = source.scale;
};

/**
 * A held cue with `lingerFrames` keeps playing where it last stood, facing the way it was cast, when its move ends early
 * (a jump cancel, #551) until that many frames after it first showed; the fighter goes on to whatever comes next.
 */
export class CueLinger {
  /** The cue still playing after its move ended, or undefined. */
  lingering: Cue | undefined = undefined;
  readonly place: CuePlace = { x: 0.0, y: 0.0, z: 0.0, facing: 1, scale: 1.0 };
  private live: Cue | undefined = undefined;
  private born = 0.0;
  private lingerBorn = 0.0;
  private readonly livePlace: CuePlace = { x: 0.0, y: 0.0, z: 0.0, facing: 1, scale: 1.0 };

  /** Called once per presented frame with the held cue the fighter shows and where it stands, `now` in seconds. */
  show(cue: Cue | undefined, at: Readonly<CuePlace> | undefined, now: number, out: boolean): void {
    if (cue !== this.live) {
      const ended = this.live;
      if (ended?.lingerFrames !== undefined) {
        this.lingering = ended;
        this.lingerBorn = this.born;
        copyPlace(this.place, this.livePlace);
      }
      this.live = cue;
      this.born = now;
    }
    if (cue !== undefined && at !== undefined) copyPlace(this.livePlace, at);
    const lingering = this.lingering;
    // Half a frame of slack keeps a 60 Hz clock's rounding from adding or dropping the last frame.
    if (lingering !== undefined && (out || lingering === cue || now >= this.lingerBorn + ((lingering.lingerFrames ?? 0) - 0.5) / 60.0)) this.lingering = undefined;
  }

  clear(): void {
    this.lingering = undefined;
    this.live = undefined;
  }
}
