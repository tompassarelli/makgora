import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../../sim/codes";
import { groundHit } from "../../sim/heroes/groundNormals";
import { HERO_REFERENCE_HEIGHT, heroRegion } from "../../sim/heroMoves";
import { type AuthoredSpecial, type SpecialKit, FollowUpInput, frames } from "../../sim/specials/schema";

const h = (n: number): number => f32(HERO_REFERENCE_HEIGHT * f32(n));

export const STEP_DISSOLVE = 12;
export const STEP_INTANGIBLE_FROM = 8;
export const STEP_FRAMES = 10;
export const STEP_SPEED = h(0.25);
export const SECOND_STEP_SHARE = f32(0.6);
export const SECOND_STEP_FRAMES = 6;
export const STEP_AIM_FRAMES = 8;
export const ARRIVAL_DAMAGE = 6.0;
export const ARRIVAL_ANGLE = 20;
export const ARRIVAL_FRAMES = 3;
export const STEP_HOLD_CHECK = 3;
export const STEP_RECOVERY = 10;
export const STEP_LANDING_LAG = 24;


const arrival = (first: number) => heroRegion(first, first + ARRIVAL_FRAMES - 1,
  { x1: 25.0, z1: 55.0, x2: 95.0, z2: 50.0, radius: 32.0 },
  groundHit(ARRIVAL_DAMAGE, ARRIVAL_ANGLE, 30.0, 20.0, HitElement.normal));

interface Leg { readonly aim: number; readonly vanishFrom: number; readonly travel: number; readonly steps: number }

const leg = ({ aim, vanishFrom, travel, steps }: Leg): AuthoredSpecial => {
  const arrivalFrame = travel + steps;
  return {
    endFrame: arrivalFrame + ARRIVAL_FRAMES + STEP_RECOVERY,
    aimFrames: aim,
    intangible: frames(vanishFrom, arrivalFrame - 2),
    oncePerAirtime: true, helpless: true, catchesLedge: true, landingLag: STEP_LANDING_LAG,
    motion: [
      { ...frames(1, travel - 1), velocityX: 0.0, velocityZ: 0.0 },
      { ...frames(travel, arrivalFrame - 1), velocityX: 0.0, velocityZ: STEP_SPEED, aimedSpeed: STEP_SPEED, freeAim: true, throughEdge: true },
      { ...frames(arrivalFrame, arrivalFrame + ARRIVAL_FRAMES + STEP_RECOVERY), velocityX: 0.0, velocityZ: 0.0 },
    ],
    regions: [arrival(arrivalFrame)],
  };
};

const SECOND_DISSOLVE = 4;
const secondStep = leg({ aim: STEP_AIM_FRAMES, vanishFrom: STEP_AIM_FRAMES + 2, travel: STEP_AIM_FRAMES + SECOND_DISSOLVE + 1, steps: SECOND_STEP_FRAMES });
const FIRST_TRAVEL = STEP_DISSOLVE + 1;
const FIRST_CHECK = FIRST_TRAVEL + STEP_FRAMES + STEP_HOLD_CHECK;

export const SHADOW_STEP: SpecialKit = {
  name: "Shadow Step",
  description: "Dissolve into shadow and slip the way the stick points, then slash on arrival. Still holding special as he reappears, he lingers to aim and slips once more, shorter, in a new direction. Two steps at most, then a helpless fall.",
  ground: {
    ...leg({ aim: STEP_DISSOLVE, vanishFrom: STEP_INTANGIBLE_FROM, travel: FIRST_TRAVEL, steps: STEP_FRAMES }),
    followUps: [{ window: frames(FIRST_CHECK, FIRST_CHECK), input: FollowUpInput.held, special: secondStep }],
  },
};
