// Action numbers up to modY are bit positions in the companion I4 protocol and must not change; toggleControls is a local presentation action that is bound and saved like the rest but never enters an input mask, the wire or the sim.




export const Action = {
  moveLeft: 0,
  moveRight: 1,
  moveDown: 2,
  moveUp: 3,
  jump: 4,
  attack: 5,
  special: 6,
  grab: 7,
  leftTrigger: 8,
  rightTrigger: 9,
  cLeft: 10,
  cRight: 11,
  cUp: 12,
  cDown: 13,
  modX: 14,
  lightShield: 15,
  shortHop: 16,
  strong: 17,
  modY: 18,
  toggleControls: 19,
} as const;

export type Action = (typeof Action)[keyof typeof Action];

// Saved action order must not depend on Lua table iteration.
export const ACTION_ORDER: readonly Action[] = Object.values(Action).sort((left, right) => left - right);

export const ACTION_COUNT = ACTION_ORDER.length;

/** The actions the sim and the wire know: every bound action except the local toggleControls. */
export const SIM_ACTIONS: readonly Action[] = ACTION_ORDER.filter((action) => action !== Action.toggleControls);

export const SIM_ACTION_COUNT = SIM_ACTIONS.length;


export const ALL_ACTIONS = (1 << SIM_ACTION_COUNT) - 1;

export function bit(action: Action): number {
  return 1 << action;
}

export function maskOf(...actions: Action[]): number {
  let mask = 0;
  for (const action of actions) mask |= bit(action);
  return mask;
}

export function has(mask: number, action: Action): boolean {
  return (mask & (1 << action)) !== 0;
}
