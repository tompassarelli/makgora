import type { model as mdx } from "war3-model";
import { ensure } from "./original-clips";

export const WARDEN_LUNGE: Readonly<Record<string, readonly number[]>> = {
  upSmash: [5, 10, 10, 1, 0], upAir: [0, 0, 0, 1, 0], jab3: [40, 50, 15, 0, 0, 1], dashAttack: [40, 50, 15, 0, 0, 1], forwardTiltUp: [80, 100, 15, 0, 0, 1], forwardSmash: [40, 50, 15, 0, 0, 1], neutralSpecial: [10, 20, 10, 0, 0, 1], ultimate: [15, 35, 5, 0, 0, 1], sideSpecial: [80, 90, 12, 1, 60],
};

export const WARDEN_TARGETS: Readonly<Record<string, readonly [number[], number[]]>> = {
  jab3: [[58,-27,99],[108,-28,99]],
  forwardTiltDown: [[50,-27,66],[95,-28,35]],
  downTilt: [[39,-27,64],[79,-28,28]],
  dashAttack: [[58,-27,89],[105,-28,74]],
  upSmash: [[8,-27,150],[8,-28,210]],
  upTilt: [[12,-27,137],[12,-28,190]],
  upAir: [[18,-27,148],[36,-28,205]],
  forwardTiltUp: [[28,-27,128],[63,-28,168]],
  jab: [[40,-27,95],[82,-28,95]],
  jab2: [[42,-27,100],[84,-28,101]],
  forwardTilt: [[75,-27,100],[125,-28,101]],
  forwardSmash: [[90,-27,108],[140,-28,112]],
  neutralSpecial: [[70,-27,105],[118,-28,108]],
  ultimate: [[-40,-27,105],[-88,-28,110]],
  sideSpecial: [[78,-27,62],[128,-28,50]],
};

export interface WardenWindup {
  readonly hand: readonly number[];
  readonly tip: readonly number[];
  readonly settle: number;
  readonly knee: number;
  readonly lunge: number;
  readonly drive: number;
}

export const WARDEN_WINDUP: Readonly<Record<string, WardenWindup>> = {
  sideSpecial: { hand: [-20, -27, 56], tip: [-70, -28, 62], settle: 6, knee: 40, lunge: 0.45, drive: 9 },
};

export interface CrouchRig {
  readonly named: (name: string) => mdx.Node;
  readonly position: (node: mdx.Node) => number[];
  readonly turnAt: (node: mdx.Node, axis: number[], full: number, at: number) => void;
  readonly seek: (at: number) => void;
}

export function crouchWindup(windup: WardenWindup, rig: CrouchRig, start: number, contact: number, total: number): void {
  const { named, position, turnAt, seek } = rig;
  const thighs = [named("Bone_Leg1_L"), named("Bone_Leg1_R")], shins = [named("Bone_Leg2_L"), named("Bone_Leg2_R")], feet = [named("Bone_Foot_L"), named("Bone_Foot_R")];
  const root = named("Bone_Root"), anticipation = Math.max(1, contact-2);
  const bend = (frame: number) => frame < windup.settle ? Math.sin(frame/windup.settle*Math.PI/2) : frame <= anticipation ? 1
    : frame <= contact ? 1+(windup.lunge-1)*(frame-anticipation)/(contact-anticipation) : windup.lunge*Math.max(0,1-(frame-contact)/(total-contact));
  seek(start);
  const floor = Math.min(...feet.map(foot => position(foot)[2]!));
  for (let frame = 1; frame <= total; frame++) {
    const at = start + Math.round(frame*1000/60), knee = windup.knee*bend(frame)*Math.PI/180;
    seek(at);
    for (const thigh of thighs) turnAt(thigh, [0,1,0], -knee, at);
    for (const shin of shins) turnAt(shin, [0,1,0], 2*knee, at);
    for (const foot of feet) turnAt(foot, [0,1,0], -knee, at);
    const drop = floor - Math.min(...feet.map(foot => position(foot)[2]!));
    const key = root.Translation?.Keys.find(k => k.Frame === at); ensure(key, "Bone_Root: missing crouch key");
    key.Vector = key.Vector.map((v,i) => i === 2 ? v+drop : v); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
    seek(at);
  }
}
