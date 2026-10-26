import { f32 } from "wisp/src/sim/f32";
import { sineTurns } from "../sim/mathTables";

type Colour = readonly [number, number, number];

export interface Fuse {
  readonly z: number;
  readonly hot: Colour;
}

export interface DiscDraw {
  readonly z: number;
  readonly disc?: Colour | undefined;
  readonly fuse?: Fuse | undefined;
}

export interface DiscPose {
  readonly dangerRadius: number;
  readonly armed: boolean;
  readonly poolPulse: number;
  readonly poolSince: number;
  readonly burning: number;
}

export interface DiscLook {
  lift: number;
  radius: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const FUSE_START = f32(0.3);

const heated = (cold: number, hot: number, heat: number) => Math.floor(cold + (hot - cold) * heat);

function colour(look: DiscLook, red: number, green: number, blue: number): void {
  look.red = red;
  look.green = green;
  look.blue = blue;
}

function burn(look: DiscLook, fuse: Readonly<Fuse>, disc: Colour, pose: Readonly<DiscPose>): DiscLook {
  const heat = f32(pose.burning * pose.burning);
  look.lift = fuse.z;
  look.radius = f32(pose.dangerRadius * f32(FUSE_START + f32(f32(1.0 - FUSE_START) * pose.burning)));
  colour(look, heated(disc[0], fuse.hot[0], heat), heated(disc[1], fuse.hot[1], heat), heated(disc[2], fuse.hot[2], heat));
  look.alpha = Math.floor(150 + 105 * pose.burning);
  return look;
}

function glow(look: DiscLook, age: number, since: number): void {
  const flash = since >= 0 && since <= 12 ? 1.0 - since / 12 : 0.0;
  const level = Math.min(1.0, f32(0.72) + f32(0.12) * sineTurns(age / 23) + f32(0.08) * sineTurns(age / 9) + 0.5 * flash);
  colour(look, Math.floor(255 * level), Math.floor(255 * level), 255);
}

function rim(look: DiscLook, pose: Readonly<DiscPose>, frost: boolean): void {
  if (frost) colour(look, 155, 210, 255);
  else if (pose.armed) colour(look, 170 + 85 * pose.poolPulse, 75 + 180 * pose.poolPulse, 255);
  else colour(look, 70, 65, 100);
}

export function discLook(look: DiscLook, draw: Readonly<DiscDraw> | undefined, pose: Readonly<DiscPose>, defile: boolean, frost: boolean, poolAge: number): DiscLook {
  const disc = draw?.disc;
  if (!defile && draw?.fuse !== undefined && disc !== undefined) return burn(look, draw.fuse, disc, pose);
  look.lift = disc === undefined ? 0.0 : draw?.z ?? 0.0;
  look.radius = pose.dangerRadius;
  if (defile && poolAge >= 0) glow(look, poolAge, pose.poolSince);
  else if (disc !== undefined) colour(look, disc[0], disc[1], disc[2]);
  else rim(look, pose, frost);
  look.alpha = pose.armed ? 255 : defile ? 96 : 160;
  return look;
}
