export interface Gesture { chest?: number; pelvis?: number; arm?: number; elbow?: number; wrist?: number; hand?: number; leftArm?: number; leftElbow?: number; leftWrist?: number; head?: number; thigh?: number; knee?: number; leftThigh?: number; frontThigh?: number; leftFrontThigh?: number; frontKnee?: number; leftFrontKnee?: number; shield?: number; leftShield?: number; shieldTwist?: number; leftShieldTwist?: number; yaw?: number; lean?: number; }
export const forward: Gesture = { chest: 15, pelvis: -8, arm: -95, elbow: 15, leftArm: -35, leftElbow: -20, head: -8, thigh: 12, leftThigh: -8 };
export const overhead: Gesture = { chest: -18, pelvis: 8, arm: -165, elbow: -10, leftArm: -140, head: -18, thigh: -12, leftThigh: 15 };
export const low: Gesture = { chest: 45, pelvis: 18, arm: -45, elbow: 15, leftArm: -60, head: -20, thigh: 45, knee: -55, leftThigh: -25 };
export const back: Gesture = { chest: -12, pelvis: -15, arm: 40, leftArm: -55, head: 20, yaw: 105 };
export const cast: Gesture = { chest: -15, pelvis: 8, arm: -120, elbow: -30, leftArm: -115, leftElbow: -20, head: -12 };
export const brace: Gesture = { chest: 28, pelvis: 12, arm: -50, elbow: -30, leftArm: -70, leftElbow: -25, head: -15, thigh: 38, knee: -65, leftThigh: -35 };
export const upperAir: readonly Gesture[] = [
  { chest: 55, pelvis: 25, lean: 25, arm: -185, elbow: 20, leftArm: -185, head: -25, thigh: 65, knee: -80, leftThigh: -55 },
  { chest: -35, pelvis: -15, lean: -15, arm: 0, elbow: 20, leftArm: 0, thigh: -25, leftThigh: 25 },
  { chest: -30, pelvis: -20, lean: -20, arm: -200, elbow: 20, leftArm: -200, thigh: -35, leftThigh: 35 },
];
export const plunge: readonly Gesture[] = [
  { chest: -30, pelvis: -15, lean: -15, arm: -200, elbow: 20, leftArm: -200, head: -20, thigh: -45, knee: 40, leftThigh: 45, frontThigh: 40, leftFrontThigh: -40 },
  { chest: 35, pelvis: 20, lean: 10, arm: 5, elbow: -10, leftArm: 5, head: 25, thigh: 30, knee: -20, leftThigh: -30, frontThigh: -30, leftFrontThigh: 30 },
  { chest: 40, pelvis: 22, lean: 12, arm: 20, elbow: -5, leftArm: 20, head: 20, thigh: 25, knee: -15, leftThigh: -25, frontThigh: -25, leftFrontThigh: 25 },
];
export const burrowRake: readonly Gesture[] = [
  { chest: 75, pelvis: 35, lean: 25, arm: -185, elbow: 20, leftArm: -185, head: -25, thigh: 65, knee: -80, leftThigh: -55 },
  { chest: -45, pelvis: -15, lean: -15, arm: 0, elbow: 20, leftArm: 0, thigh: -10, leftThigh: 10 },
  { chest: -40, pelvis: -25, lean: -20, arm: -200, elbow: 20, leftArm: -200, thigh: -20, leftThigh: 20 },
];
