


import type { SoakController } from "wisp/scripts/wisp/soak/types";

export const SOAK_BUTTONS = ["jump", "attack", "special", "grab", "leftTrigger", "rightTrigger", "modX", "modY"] as const;


export const STICK_DEAD_ZONE = 35;

export const SOAK_CONTROLLER: SoakController = {
  buttons: SOAK_BUTTONS,

  weights: [2, 3, 3, 1, 1, 1, 0.5, 0.5],
  axes: ["x", "z"],
  axisLimit: 127,
  deadZone: STICK_DEAD_ZONE,
};
